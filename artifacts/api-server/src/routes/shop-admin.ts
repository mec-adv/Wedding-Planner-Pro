import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db, ordersTable, orderItemsTable, orderTransitionsTable, muralMessagesTable,
  giftCategoriesTable, giftsTable, guestsTable, weddingsTable,
  eq, and, sql, asc,
} from "@workspace/db";
import { authMiddleware, requireWeddingRole, type AuthRequest } from "../lib/auth";
import { loadGatewayConfig } from "../lib/payment-gateway/load-config";
import { getGateway } from "../lib/payment-gateway/registry";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function routeParam(p: string | string[] | undefined): string {
  if (p == null) return "";
  return Array.isArray(p) ? (p[0] ?? "") : p;
}

function wId(req: AuthRequest): number {
  return parseInt(routeParam(req.params.weddingId), 10);
}

// ---------------------------------------------------------------------------
// GET /weddings/:weddingId/orders  — listagem paginada e filtrável
// ---------------------------------------------------------------------------
router.get(
  "/weddings/:weddingId/orders",
  authMiddleware,
  requireWeddingRole("admin", "planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const { status, paymentMethod, buyerName, page = "1", limit = "20" } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pageNum - 1) * pageSize;

    const conditions = [eq(ordersTable.weddingId, weddingId)];
    if (status) conditions.push(eq(ordersTable.status, status as never));
    if (paymentMethod) conditions.push(eq(ordersTable.paymentMethod, paymentMethod as never));
    if (buyerName) conditions.push(sql`lower(${ordersTable.buyerName}) like ${"%" + buyerName.toLowerCase() + "%"}`);

    const where = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [orders, [{ total }]] = await Promise.all([
      db.select().from(ordersTable).where(where)
        .orderBy(sql`${ordersTable.createdAt} desc`)
        .limit(pageSize).offset(offset),
      db.select({ total: sql<number>`count(*)::int` }).from(ordersTable).where(where),
    ]);

    res.json({ orders, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) });
  },
);

// ---------------------------------------------------------------------------
// GET /weddings/:weddingId/orders/summary  — resumo financeiro
// ---------------------------------------------------------------------------
router.get(
  "/weddings/:weddingId/orders/summary",
  authMiddleware,
  requireWeddingRole("admin", "planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);

    const [summary] = await db.select({
      totalPaid: sql<number>`coalesce(sum(case when status = 'paid' then total_amount else 0 end),0)::numeric`,
      totalPending: sql<number>`coalesce(sum(case when status = 'pending' then total_amount else 0 end),0)::numeric`,
      countTotal: sql<number>`count(*)::int`,
      countPaid: sql<number>`count(case when status = 'paid' then 1 end)::int`,
    }).from(ordersTable).where(eq(ordersTable.weddingId, weddingId));

    const avgTicket = summary.countPaid > 0
      ? parseFloat(String(summary.totalPaid)) / summary.countPaid
      : 0;

    res.json({
      totalPaid: parseFloat(String(summary.totalPaid)),
      totalPending: parseFloat(String(summary.totalPending)),
      countTotal: summary.countTotal,
      countPaid: summary.countPaid,
      avgTicket: Math.round(avgTicket * 100) / 100,
    });
  },
);

// ---------------------------------------------------------------------------
// GET /weddings/:weddingId/orders/:orderId  — detalhe do pedido
// ---------------------------------------------------------------------------
router.get(
  "/weddings/:weddingId/orders/:orderId",
  authMiddleware,
  requireWeddingRole("admin", "planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const orderId = parseInt(routeParam(req.params.orderId), 10);

    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.weddingId, weddingId))).limit(1);
    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

    const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
    let guest = null;
    if (order.guestId) {
      const [g] = await db.select({ name: guestsTable.name, email: guestsTable.email, phone: guestsTable.phone })
        .from(guestsTable).where(eq(guestsTable.id, order.guestId)).limit(1);
      guest = g ?? null;
    }

    res.json({ order, items, guest });
  },
);

// ---------------------------------------------------------------------------
// POST /weddings/:weddingId/orders/:orderId/cancel  — cancelamento/estorno
// Restrito a admin e planner (cerimonialista)
// ---------------------------------------------------------------------------
router.post(
  "/weddings/:weddingId/orders/:orderId/cancel",
  authMiddleware,
  requireWeddingRole("admin", "planner"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const orderId = parseInt(routeParam(req.params.orderId), 10);

    const [order] = await db.select().from(ordersTable)
      .where(and(eq(ordersTable.id, orderId), eq(ordersTable.weddingId, weddingId))).limit(1);

    if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }
    if (order.status !== "paid") {
      res.status(400).json({ error: "Apenas pedidos com status 'paid' podem ser estornados" });
      return;
    }

    if (order.gatewayPaymentId) {
      try {
        const gatewayConfig = await loadGatewayConfig(weddingId);
        if (gatewayConfig) {
          const gateway = getGateway(gatewayConfig.gatewayName);
          await gateway.cancelPayment(gatewayConfig, order.gatewayPaymentId);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao estornar no gateway";
        res.status(502).json({ error: msg });
        return;
      }
    }

    await db.transaction(async (tx) => {
      await tx.update(ordersTable).set({
        status: "refunded",
        cancelledAt: new Date(),
        cancelledBy: authReq.userId,
      }).where(eq(ordersTable.id, orderId));

      await tx.insert(orderTransitionsTable).values({
        orderId,
        fromStatus: "paid",
        toStatus: "refunded",
        gatewayEvent: "manual_refund",
        actor: `admin:${authReq.userId}`,
      });
    });

    res.json({ success: true, orderId, status: "refunded" });
  },
);

// ---------------------------------------------------------------------------
// GET /weddings/:weddingId/orders/export  — exportação XLSX/CSV
// ---------------------------------------------------------------------------
router.get(
  "/weddings/:weddingId/orders/export",
  authMiddleware,
  requireWeddingRole("admin", "planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const format = (req.query.format as string) === "csv" ? "csv" : "xlsx";
    const { status, paymentMethod, buyerName } = req.query as Record<string, string>;

    const conditions = [
      eq(ordersTable.weddingId, weddingId),
      sql`${ordersTable.status} in ('paid','pending')`,
    ];
    if (status && ["paid", "pending"].includes(status)) conditions.push(eq(ordersTable.status, status as never));
    if (paymentMethod) conditions.push(eq(ordersTable.paymentMethod, paymentMethod as never));
    if (buyerName) conditions.push(sql`lower(${ordersTable.buyerName}) like ${"%" + buyerName.toLowerCase() + "%"}`);

    const orders = await db.select().from(ordersTable)
      .where(and(...conditions))
      .orderBy(sql`${ordersTable.createdAt} desc`);

    const orderIds = orders.map((o) => o.id);
    const allItems = orderIds.length
      ? await db.select().from(orderItemsTable)
          .where(sql`${orderItemsTable.orderId} = ANY(${sql.raw(`ARRAY[${orderIds.join(",")}]::int[]`)})`)
      : [];

    const itemsByOrder = new Map<number, typeof allItems>();
    for (const item of allItems) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    if (format === "csv") {
      const rows: string[] = [
        "Pedido,Data,Comprador,Status,Forma Pagamento,Parcelas,Presentes,Total",
      ];
      for (const o of orders) {
        const items = itemsByOrder.get(o.id) ?? [];
        const itemsStr = items.map((i) => `${i.giftNameSnapshot} x${i.quantity}`).join(" | ");
        rows.push([
          o.id,
          o.createdAt.toLocaleDateString("pt-BR"),
          `"${o.buyerName}"`,
          o.status,
          o.paymentMethod,
          o.installments,
          `"${itemsStr}"`,
          parseFloat(o.totalAmount).toFixed(2),
        ].join(","));
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=pedidos.csv");
      res.send("\uFEFF" + rows.join("\n")); // BOM for Excel UTF-8
      return;
    }

    // XLSX via exceljs
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Pedidos");

    ws.columns = [
      { header: "Pedido #", key: "id", width: 10 },
      { header: "Data/Hora", key: "date", width: 18 },
      { header: "Comprador", key: "buyer", width: 25 },
      { header: "Status", key: "status", width: 12 },
      { header: "Pagamento", key: "payment", width: 14 },
      { header: "Parcelas", key: "installments", width: 10 },
      { header: "Presentes", key: "items", width: 40 },
      { header: "Total (R$)", key: "total", width: 14 },
    ];

    for (const o of orders) {
      const items = itemsByOrder.get(o.id) ?? [];
      ws.addRow({
        id: o.id,
        date: o.createdAt.toLocaleString("pt-BR"),
        buyer: o.buyerName,
        status: o.status,
        payment: o.paymentMethod,
        installments: o.installments,
        items: items.map((i) => `${i.giftNameSnapshot} x${i.quantity}`).join(", "),
        total: parseFloat(o.totalAmount),
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=pedidos.xlsx");
    await wb.xlsx.write(res);
    res.end();
  },
);

// ---------------------------------------------------------------------------
// GET /weddings/:weddingId/mural-messages  — listagem do mural
// ---------------------------------------------------------------------------
router.get(
  "/weddings/:weddingId/mural-messages",
  authMiddleware,
  requireWeddingRole("admin", "planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const { source } = req.query as Record<string, string>;

    const conditions = [eq(muralMessagesTable.weddingId, weddingId)];
    if (source === "checkout" || source === "public_page") {
      conditions.push(eq(muralMessagesTable.source, source));
    }

    const messages = await db.select().from(muralMessagesTable)
      .where(and(...conditions))
      .orderBy(sql`${muralMessagesTable.createdAt} desc`);

    res.json({ messages });
  },
);

// ---------------------------------------------------------------------------
// GET /weddings/:weddingId/gift-categories  — listagem de categorias (admin)
// ---------------------------------------------------------------------------
router.get(
  "/weddings/:weddingId/gift-categories",
  authMiddleware,
  requireWeddingRole("admin", "planner", "coordinator"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);

    const cats = await db.select().from(giftCategoriesTable)
      .where(eq(giftCategoriesTable.weddingId, weddingId))
      .orderBy(asc(giftCategoriesTable.sortOrder), asc(giftCategoriesTable.name));

    res.json({ categories: cats });
  },
);

// ---------------------------------------------------------------------------
// POST /weddings/:weddingId/gift-categories  — criar categoria
// ---------------------------------------------------------------------------
const GiftCategoryBody = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().min(0).optional(),
});

router.post(
  "/weddings/:weddingId/gift-categories",
  authMiddleware,
  requireWeddingRole("admin", "planner"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const parsed = GiftCategoryBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }

    const [cat] = await db.insert(giftCategoriesTable).values({
      weddingId,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder ?? 0,
    }).returning();

    res.status(201).json(cat);
  },
);

// ---------------------------------------------------------------------------
// PATCH /weddings/:weddingId/gift-categories/:id  — editar categoria
// ---------------------------------------------------------------------------
router.patch(
  "/weddings/:weddingId/gift-categories/:id",
  authMiddleware,
  requireWeddingRole("admin", "planner"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const catId = parseInt(routeParam(req.params.id), 10);
    const parsed = GiftCategoryBody.partial().safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }

    const [cat] = await db.update(giftCategoriesTable)
      .set(parsed.data)
      .where(and(eq(giftCategoriesTable.id, catId), eq(giftCategoriesTable.weddingId, weddingId)))
      .returning();

    if (!cat) { res.status(404).json({ error: "Categoria não encontrada" }); return; }
    res.json(cat);
  },
);

// ---------------------------------------------------------------------------
// DELETE /weddings/:weddingId/gift-categories/:id  — remover categoria
// ---------------------------------------------------------------------------
router.delete(
  "/weddings/:weddingId/gift-categories/:id",
  authMiddleware,
  requireWeddingRole("admin", "planner"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const catId = parseInt(routeParam(req.params.id), 10);

    await db.delete(giftCategoriesTable)
      .where(and(eq(giftCategoriesTable.id, catId), eq(giftCategoriesTable.weddingId, weddingId)));

    res.status(204).send();
  },
);

// ---------------------------------------------------------------------------
// PATCH /weddings/:weddingId/gifts/:giftId/active  — ativar/inativar presente
// ---------------------------------------------------------------------------
router.patch(
  "/weddings/:weddingId/gifts/:giftId/active",
  authMiddleware,
  requireWeddingRole("admin", "planner", "coordinator"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const giftId = parseInt(routeParam(req.params.giftId), 10);
    const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "active (boolean) é obrigatório" }); return; }

    const [gift] = await db.update(giftsTable)
      .set({ isActive: parsed.data.active })
      .where(and(eq(giftsTable.id, giftId), eq(giftsTable.weddingId, weddingId)))
      .returning();

    if (!gift) { res.status(404).json({ error: "Presente não encontrado" }); return; }
    res.json({ id: gift.id, isActive: gift.isActive });
  },
);

// ---------------------------------------------------------------------------
// GET /weddings/:weddingId/shop-settings  — configurações da loja (admin)
// ---------------------------------------------------------------------------
router.get(
  "/weddings/:weddingId/shop-settings",
  authMiddleware,
  requireWeddingRole("admin", "planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);

    const [wedding] = await db.select({
      showProgressBar: weddingsTable.showProgressBar,
      progressGoal: weddingsTable.progressGoal,
      thankYouMessage: weddingsTable.thankYouMessage,
    }).from(weddingsTable).where(eq(weddingsTable.id, weddingId)).limit(1);

    if (!wedding) { res.status(404).json({ error: "Casamento não encontrado" }); return; }
    res.json(wedding);
  },
);

// ---------------------------------------------------------------------------
// PATCH /weddings/:weddingId/shop-settings  — atualizar configurações da loja
// ---------------------------------------------------------------------------
const ShopSettingsBody = z.object({
  showProgressBar: z.boolean().optional(),
  progressGoal: z.number().positive().nullable().optional(),
  thankYouMessage: z.string().max(500).nullable().optional(),
});

router.patch(
  "/weddings/:weddingId/shop-settings",
  authMiddleware,
  requireWeddingRole("admin", "planner"),
  async (req, res): Promise<void> => {
    const authReq = req as AuthRequest;
    const weddingId = wId(authReq);
    const parsed = ShopSettingsBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message }); return; }

    const data: Record<string, unknown> = {};
    if (parsed.data.showProgressBar !== undefined) data.showProgressBar = parsed.data.showProgressBar;
    if (parsed.data.progressGoal !== undefined) data.progressGoal = parsed.data.progressGoal !== null ? String(parsed.data.progressGoal) : null;
    if (parsed.data.thankYouMessage !== undefined) data.thankYouMessage = parsed.data.thankYouMessage;

    const [wedding] = await db.update(weddingsTable).set(data).where(eq(weddingsTable.id, weddingId)).returning({
      showProgressBar: weddingsTable.showProgressBar,
      progressGoal: weddingsTable.progressGoal,
      thankYouMessage: weddingsTable.thankYouMessage,
    });

    if (!wedding) { res.status(404).json({ error: "Casamento não encontrado" }); return; }
    res.json(wedding);
  },
);

export default router;
