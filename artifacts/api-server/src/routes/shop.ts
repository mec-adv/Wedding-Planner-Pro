import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db, guestsTable, weddingsTable, giftsTable, giftCategoriesTable,
  ordersTable, orderItemsTable, muralMessagesTable,
  eq, and, asc, sql,
} from "@workspace/db";
import { createRateLimiter, createTokenRateLimiter } from "../lib/public-rate-limit";
import { createPixPayment, createCreditCardPayment, getAsaasPaymentStatus } from "../lib/asaas";
import { sendPurchaseNotificationAsync } from "../lib/evolution-api";
import { sendConfirmationEmail } from "../lib/email";

const router: IRouter = Router();

const limitPublic = createRateLimiter({ windowMs: 60_000, max: 120, keyPrefix: "shop" });
const limitOrders = createRateLimiter({ windowMs: 60_000, max: 20, keyPrefix: "shop-order" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadGuestByToken(token: string) {
  const [guest] = await db.select().from(guestsTable).where(eq(guestsTable.inviteToken, token)).limit(1);
  if (!guest) return null;
  if (guest.inviteTokenExpiresAt && guest.inviteTokenExpiresAt < new Date()) return null;
  return guest;
}

function pixExpirationSeconds(): number {
  const val = parseInt(process.env.PIX_EXPIRATION_SECONDS ?? "1800", 10);
  return Number.isFinite(val) && val > 0 ? val : 1800;
}

// ---------------------------------------------------------------------------
// GET /public/weddings/:weddingId/gifts  — catálogo público
// ---------------------------------------------------------------------------
router.get("/public/weddings/:weddingId/gifts", limitPublic, async (req, res): Promise<void> => {
  const weddingId = parseInt(req.params.weddingId, 10);
  if (!Number.isFinite(weddingId)) { res.status(400).json({ error: "Invalid weddingId" }); return; }

  const gifts = await db.select().from(giftsTable)
    .where(and(eq(giftsTable.weddingId, weddingId), eq(giftsTable.isActive, true)))
    .orderBy(asc(giftsTable.id));

  res.json({ gifts });
});

// ---------------------------------------------------------------------------
// GET /public/weddings/:weddingId/gift-categories  — categorias para filtro
// ---------------------------------------------------------------------------
router.get("/public/weddings/:weddingId/gift-categories", limitPublic, async (req, res): Promise<void> => {
  const weddingId = parseInt(req.params.weddingId, 10);
  if (!Number.isFinite(weddingId)) { res.status(400).json({ error: "Invalid weddingId" }); return; }

  const categories = await db.select().from(giftCategoriesTable)
    .where(and(eq(giftCategoriesTable.weddingId, weddingId), eq(giftCategoriesTable.active, true)))
    .orderBy(asc(giftCategoriesTable.sortOrder), asc(giftCategoriesTable.name));

  res.json({ categories });
});

// ---------------------------------------------------------------------------
// GET /public/weddings/:weddingId/shop-settings  — config da loja pública
// ---------------------------------------------------------------------------
router.get("/public/weddings/:weddingId/shop-settings", limitPublic, async (req, res): Promise<void> => {
  const weddingId = parseInt(req.params.weddingId, 10);
  if (!Number.isFinite(weddingId)) { res.status(400).json({ error: "Invalid weddingId" }); return; }

  const [wedding] = await db.select({
    showProgressBar: weddingsTable.showProgressBar,
    progressGoal: weddingsTable.progressGoal,
    thankYouMessage: weddingsTable.thankYouMessage,
  }).from(weddingsTable).where(eq(weddingsTable.id, weddingId)).limit(1);

  if (!wedding) { res.status(404).json({ error: "Casamento não encontrado" }); return; }

  // Total arrecadado (pedidos paid)
  let totalRaised = 0;
  if (wedding.showProgressBar && wedding.progressGoal) {
    const [row] = await db.select({ total: sql<string>`coalesce(sum(total_amount),0)` })
      .from(ordersTable)
      .where(and(eq(ordersTable.weddingId, weddingId), eq(ordersTable.status, "paid")));
    totalRaised = parseFloat(row?.total ?? "0");
  }

  res.json({
    showProgressBar: wedding.showProgressBar && !!wedding.progressGoal,
    progressGoal: wedding.progressGoal ? parseFloat(wedding.progressGoal) : null,
    totalRaised: wedding.showProgressBar && wedding.progressGoal ? totalRaised : null,
    thankYouMessage: wedding.thankYouMessage,
  });
});

// ---------------------------------------------------------------------------
// POST /public/orders  — criar pedido (valida token do convidado)
// ---------------------------------------------------------------------------
const CreateOrderBody = z.object({
  guestToken: z.string().min(32).max(64),
  buyerName: z.string().min(1).max(255),
  muralMessage: z.string().max(500).nullish(),
  paymentMethod: z.enum(["pix", "credit_card"]),
  // Cartão: token do Asaas.js (opcional) ou campos raw
  creditCardToken: z.string().nullish(),
  cardNumber: z.string().nullish(),
  cardHolderName: z.string().nullish(),
  cardExpiryMonth: z.string().nullish(),
  cardExpiryYear: z.string().nullish(),
  cardCcv: z.string().nullish(),
  holderName: z.string().nullish(),
  holderCpf: z.string().nullish(),
  holderEmail: z.string().nullish(),
  holderPhone: z.string().nullish(),
  holderPostalCode: z.string().nullish(),
  holderAddressNumber: z.string().nullish(),
  installments: z.number().int().min(1).max(12).nullish(),
  items: z.array(z.object({
    giftId: z.number().int().positive(),
    quantity: z.number().int().min(1),
    customPrice: z.number().positive().nullish(),
  })).min(1),
});

router.post("/public/orders", limitOrders, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
    return;
  }

  const body = parsed.data;
  const guest = await loadGuestByToken(body.guestToken);
  if (!guest) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  // Validate credit card fields
  if (body.paymentMethod === "credit_card") {
    const hasToken = !!body.creditCardToken;
    const hasRawCard = body.cardNumber && body.cardHolderName && body.cardExpiryMonth && body.cardExpiryYear && body.cardCcv;
    if (!hasToken && !hasRawCard) {
      res.status(400).json({ error: "Dados do cartão são obrigatórios para pagamento com cartão." });
      return;
    }
    if (!body.holderName || !body.holderCpf) {
      res.status(400).json({ error: "Nome e CPF do titular são obrigatórios para pagamento com cartão." });
      return;
    }
  }

  // Load gifts and compute totals
  const giftIds = body.items.map((i) => i.giftId);
  const gifts = await db.select().from(giftsTable)
    .where(and(eq(giftsTable.weddingId, guest.weddingId), eq(giftsTable.isActive, true)));

  const giftMap = new Map(gifts.map((g) => [g.id, g]));
  const orderItems: Array<{ giftId: number; name: string; unitPrice: number; quantity: number; subtotal: number }> = [];

  for (const item of body.items) {
    const gift = giftMap.get(item.giftId);
    if (!gift) {
      res.status(400).json({ error: `Presente ${item.giftId} não encontrado ou inativo` });
      return;
    }

    let unitPrice: number;
    if (gift.isHoneymoonFund) {
      if (!item.customPrice || item.customPrice < 50) {
        res.status(400).json({ error: "A Cota de Lua de Mel exige valor mínimo de R$ 50,00" });
        return;
      }
      unitPrice = item.customPrice;
    } else {
      unitPrice = parseFloat(gift.price);
    }

    const subtotal = Math.round(unitPrice * item.quantity * 100) / 100;
    orderItems.push({ giftId: gift.id, name: gift.name, unitPrice, quantity: item.quantity, subtotal });
  }

  const totalAmount = Math.round(orderItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
  const installments = body.paymentMethod === "credit_card" ? (body.installments ?? 1) : 1;

  // Create Asaas payment
  let asaasPaymentId: string | null = null;
  let asaasStatus: string | null = null;
  let paymentArtifacts: Record<string, unknown> = {};

  try {
    if (body.paymentMethod === "pix") {
      const pay = await createPixPayment(guest.weddingId, {
        amount: totalAmount,
        customerName: body.buyerName,
        customerEmail: guest.email ?? undefined,
        expirationSeconds: pixExpirationSeconds(),
      });
      asaasPaymentId = pay.id;
      asaasStatus = pay.status;
      paymentArtifacts = {
        pixQrCode: pay.pixQrCode,
        pixCopyPaste: pay.pixCopyPaste,
        pixExpiresAt: pay.pixExpiresAt,
      };
    } else {
      const pay = await createCreditCardPayment(guest.weddingId, {
        amount: totalAmount,
        customerName: body.buyerName,
        customerEmail: guest.email ?? undefined,
        creditCardToken: body.creditCardToken ?? undefined,
        cardNumber: body.cardNumber ?? undefined,
        cardHolderName: body.cardHolderName ?? undefined,
        cardExpiryMonth: body.cardExpiryMonth ?? undefined,
        cardExpiryYear: body.cardExpiryYear ?? undefined,
        cardCcv: body.cardCcv ?? undefined,
        holderName: body.holderName!,
        holderCpf: body.holderCpf!,
        holderEmail: body.holderEmail ?? undefined,
        holderPhone: body.holderPhone ?? undefined,
        holderPostalCode: body.holderPostalCode ?? undefined,
        holderAddressNumber: body.holderAddressNumber ?? undefined,
        installmentCount: installments,
      });
      asaasPaymentId = pay.id;
      asaasStatus = pay.status;
      paymentArtifacts = { status: pay.status };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao processar pagamento";
    res.status(502).json({ error: msg });
    return;
  }

  // Determine initial order status
  const initialStatus: "pending" | "paid" | "failed" =
    asaasStatus === "CONFIRMED" || asaasStatus === "RECEIVED" ? "paid"
    : asaasStatus === "DECLINED" ? "failed"
    : "pending";

  // Persist order + items in a transaction
  let orderId: number;
  try {
    await db.transaction(async (tx) => {
      const [order] = await tx.insert(ordersTable).values({
        weddingId: guest.weddingId,
        guestId: guest.id,
        buyerName: body.buyerName,
        status: initialStatus,
        paymentMethod: body.paymentMethod,
        installments,
        totalAmount: String(totalAmount),
        asaasPaymentId,
        asaasStatus,
        muralMessage: body.muralMessage?.trim() || null,
        paidAt: initialStatus === "paid" ? new Date() : null,
      }).returning({ id: ordersTable.id });

      if (!order) throw new Error("Falha ao criar pedido");
      orderId = order.id;

      await tx.insert(orderItemsTable).values(
        orderItems.map((item) => ({
          orderId,
          giftId: item.giftId,
          giftNameSnapshot: item.name,
          unitPriceSnapshot: String(item.unitPrice),
          quantity: item.quantity,
          subtotal: String(item.subtotal),
        })),
      );

      // Persist mural message after payment confirmation (only for paid orders)
      if (body.muralMessage?.trim() && initialStatus === "paid") {
        await tx.insert(muralMessagesTable).values({
          weddingId: guest.weddingId,
          guestId: guest.id,
          authorName: body.buyerName,
          message: body.muralMessage.trim(),
          source: "checkout",
          orderId,
        });
      }
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar pedido";
    res.status(500).json({ error: msg });
    return;
  }

  // Fire post-payment notifications (only if already confirmed, e.g. credit card)
  if (initialStatus === "paid") {
    void triggerPaidNotifications(orderId!, guest.weddingId, guest.id, body.buyerName, guest.phone, orderItems, totalAmount, body.paymentMethod, installments);
  }

  res.status(201).json({
    orderId: orderId!,
    status: initialStatus,
    paymentMethod: body.paymentMethod,
    totalAmount,
    ...paymentArtifacts,
  });
});

// ---------------------------------------------------------------------------
// GET /public/orders/:orderId/status  — polling de status PIX
// ---------------------------------------------------------------------------
router.get("/public/orders/:orderId/status", limitPublic, async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const token = (req.query.token as string) ?? "";

  if (!Number.isFinite(orderId) || !token) {
    res.status(400).json({ error: "orderId e token são obrigatórios" });
    return;
  }

  const guest = await loadGuestByToken(token);
  if (!guest) { res.status(401).json({ error: "Token inválido" }); return; }

  const [order] = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.id, orderId), eq(ordersTable.weddingId, guest.weddingId), eq(ordersTable.guestId, guest.id)))
    .limit(1);

  if (!order) { res.status(404).json({ error: "Pedido não encontrado" }); return; }

  // Sync from Asaas if still pending
  if (order.status === "pending" && order.asaasPaymentId) {
    try {
      const remote = await getAsaasPaymentStatus(guest.weddingId, order.asaasPaymentId);
      const remoteStatus = remote.status;

      if (remoteStatus === "CONFIRMED" || remoteStatus === "RECEIVED") {
        await db.update(ordersTable).set({ status: "paid", asaasStatus: remoteStatus, paidAt: new Date() }).where(eq(ordersTable.id, orderId));

        // Persist mural message now that payment is confirmed
        if (order.muralMessage) {
          const already = await db.select({ id: muralMessagesTable.id }).from(muralMessagesTable).where(eq(muralMessagesTable.orderId, orderId)).limit(1);
          if (!already.length) {
            await db.insert(muralMessagesTable).values({
              weddingId: order.weddingId,
              guestId: order.guestId,
              authorName: order.buyerName,
              message: order.muralMessage,
              source: "checkout",
              orderId,
            });
          }
        }

        const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
        void triggerPaidNotifications(orderId, order.weddingId, order.guestId, order.buyerName, guest.phone, items.map((i) => ({ giftId: i.giftId!, name: i.giftNameSnapshot, unitPrice: parseFloat(i.unitPriceSnapshot), quantity: i.quantity, subtotal: parseFloat(i.subtotal) })), parseFloat(order.totalAmount), order.paymentMethod, order.installments);

        res.json({ orderId, status: "paid" });
        return;
      } else if (remoteStatus === "OVERDUE" || remoteStatus === "DELETED") {
        await db.update(ordersTable).set({ status: "expired", asaasStatus: remoteStatus }).where(eq(ordersTable.id, orderId));
        res.json({ orderId, status: "expired" });
        return;
      }
    } catch {
      // Polling failure is non-critical; return current DB status
    }
  }

  res.json({ orderId, status: order.status, asaasStatus: order.asaasStatus });
});

// ---------------------------------------------------------------------------
// GET /public/orders?token=:token  — histórico de pedidos do convidado
// ---------------------------------------------------------------------------
router.get("/public/orders", limitPublic, async (req, res): Promise<void> => {
  const token = (req.query.token as string) ?? "";
  if (!token) { res.status(400).json({ error: "token é obrigatório" }); return; }

  const guest = await loadGuestByToken(token);
  if (!guest) { res.status(401).json({ error: "Token inválido" }); return; }

  const orders = await db.select().from(ordersTable)
    .where(and(eq(ordersTable.weddingId, guest.weddingId), eq(ordersTable.guestId, guest.id)))
    .orderBy(sql`${ordersTable.createdAt} desc`);

  const orderIds = orders.map((o) => o.id);
  const items = orderIds.length
    ? await db.select().from(orderItemsTable).where(sql`${orderItemsTable.orderId} = ANY(${sql.raw(`ARRAY[${orderIds.join(",")}]::int[]`)})`)
    : [];

  const itemsByOrder = new Map<number, typeof items>();
  for (const item of items) {
    const list = itemsByOrder.get(item.orderId) ?? [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      paymentMethod: o.paymentMethod,
      installments: o.installments,
      totalAmount: parseFloat(o.totalAmount),
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
      asaasPaymentId: o.asaasPaymentId,
      items: (itemsByOrder.get(o.id) ?? []).map((i) => ({
        id: i.id,
        giftNameSnapshot: i.giftNameSnapshot,
        unitPriceSnapshot: parseFloat(i.unitPriceSnapshot),
        quantity: i.quantity,
        subtotal: parseFloat(i.subtotal),
      })),
    })),
  });
});

// ---------------------------------------------------------------------------
// POST /public/mural-messages  — mensagem avulsa na página pública
// ---------------------------------------------------------------------------
const MuralMessageBody = z.object({
  guestToken: z.string().min(32).max(64),
  authorName: z.string().min(1).max(255),
  message: z.string().min(1).max(500),
});

router.post("/public/mural-messages", limitPublic, async (req, res): Promise<void> => {
  const parsed = MuralMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
    return;
  }

  const guest = await loadGuestByToken(parsed.data.guestToken);
  if (!guest) { res.status(401).json({ error: "Token inválido" }); return; }

  const [msg] = await db.insert(muralMessagesTable).values({
    weddingId: guest.weddingId,
    guestId: guest.id,
    authorName: parsed.data.authorName,
    message: parsed.data.message,
    source: "public_page",
  }).returning();

  res.status(201).json({ id: msg?.id, createdAt: msg?.createdAt?.toISOString() });
});

// ---------------------------------------------------------------------------
// Internal: dispatch post-payment notifications
// ---------------------------------------------------------------------------
async function triggerPaidNotifications(
  orderId: number,
  weddingId: number,
  guestId: number | null,
  buyerName: string,
  phone: string | null | undefined,
  items: Array<{ giftId: number | null; name: string; unitPrice: number; quantity: number; subtotal: number }>,
  totalAmount: number,
  paymentMethod: string,
  installments: number,
): Promise<void> {
  // Check if already sent
  const [order] = await db.select({ whatsappSentAt: ordersTable.whatsappSentAt, emailSentAt: ordersTable.emailSentAt })
    .from(ordersTable).where(eq(ordersTable.id, orderId)).limit(1);
  if (!order) return;

  const [wedding] = await db.select({
    brideName: weddingsTable.brideName,
    groomName: weddingsTable.groomName,
    date: weddingsTable.date,
    thankYouMessage: weddingsTable.thankYouMessage,
  }).from(weddingsTable).where(eq(weddingsTable.id, weddingId)).limit(1);
  if (!wedding) return;

  // WhatsApp — only if not already sent and guest has phone
  if (!order.whatsappSentAt && phone) {
    sendPurchaseNotificationAsync(weddingId, phone, {
      guestName: buyerName,
      groomName: wedding.groomName,
      brideName: wedding.brideName,
      weddingDate: wedding.date,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
      totalAmount,
      paymentMethod: paymentMethod as "pix" | "credit_card",
      installments,
      thankYouMessage: wedding.thankYouMessage,
    });
    await db.update(ordersTable).set({ whatsappSentAt: new Date() }).where(eq(ordersTable.id, orderId));
  }

  // Email — only if guest has email and not already sent
  if (!order.emailSentAt && guestId) {
    const [guest] = await db.select({ email: guestsTable.email }).from(guestsTable).where(eq(guestsTable.id, guestId)).limit(1);
    if (guest?.email) {
      try {
        await sendConfirmationEmail({
          weddingId,
          toEmail: guest.email,
          buyerName,
          items: items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal })),
          totalAmount,
          paymentMethod: paymentMethod as "pix" | "credit_card",
          installments,
          thankYouMessage: wedding.thankYouMessage,
          groomName: wedding.groomName,
          brideName: wedding.brideName,
        });
        await db.update(ordersTable).set({ emailSentAt: new Date() }).where(eq(ordersTable.id, orderId));
      } catch (err: unknown) {
        console.error("[Email] Falha ao enviar confirmação de compra:", err instanceof Error ? err.message : String(err));
      }
    }
  }
}

export default router;
