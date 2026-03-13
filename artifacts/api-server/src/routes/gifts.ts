import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, giftsTable, giftOrdersTable } from "@workspace/db";
import {
  ListGiftsParams,
  CreateGiftParams,
  CreateGiftBody,
  UpdateGiftParams,
  UpdateGiftBody,
  DeleteGiftParams,
  ListGiftOrdersParams,
  CreateGiftOrderParams,
  CreateGiftOrderBody,
  GetGiftOrdersSummaryParams,
} from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/gifts", async (req, res): Promise<void> => {
  const params = ListGiftsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const gifts = await db.select().from(giftsTable).where(eq(giftsTable.weddingId, params.data.weddingId));
  res.json(gifts.map(g => ({
    ...g,
    price: Number(g.price),
    createdAt: g.createdAt.toISOString(),
  })));
});

router.post("/weddings/:weddingId/gifts", authMiddleware, async (req, res): Promise<void> => {
  const params = CreateGiftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateGiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [gift] = await db.insert(giftsTable).values({
    name: parsed.data.name || "Presente",
    price: String(parsed.data.price ?? 0),
    description: parsed.data.description,
    imageUrl: parsed.data.imageUrl,
    category: parsed.data.category || "geral",
    weddingId: params.data.weddingId,
  }).returning();

  res.status(201).json({
    ...gift,
    price: Number(gift.price),
    createdAt: gift.createdAt.toISOString(),
  });
});

router.patch("/weddings/:weddingId/gifts/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = UpdateGiftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGiftBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (updateData.price !== undefined) updateData.price = String(updateData.price);

  const [gift] = await db.update(giftsTable).set(updateData)
    .where(and(eq(giftsTable.id, params.data.id), eq(giftsTable.weddingId, params.data.weddingId))).returning();
  if (!gift) {
    res.status(404).json({ error: "Presente não encontrado" });
    return;
  }

  res.json({
    ...gift,
    price: Number(gift.price),
    createdAt: gift.createdAt.toISOString(),
  });
});

router.delete("/weddings/:weddingId/gifts/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = DeleteGiftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(giftsTable).where(and(eq(giftsTable.id, params.data.id), eq(giftsTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

router.get("/weddings/:weddingId/gift-orders", authMiddleware, async (req, res): Promise<void> => {
  const params = ListGiftOrdersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const orders = await db.select({
    order: giftOrdersTable,
    giftName: giftsTable.name,
  }).from(giftOrdersTable)
    .leftJoin(giftsTable, eq(giftOrdersTable.giftId, giftsTable.id))
    .where(eq(giftOrdersTable.weddingId, params.data.weddingId));

  res.json(orders.map(o => ({
    ...o.order,
    amount: Number(o.order.amount),
    giftName: o.giftName,
    createdAt: o.order.createdAt.toISOString(),
  })));
});

router.post("/weddings/:weddingId/gift-orders", async (req, res): Promise<void> => {
  const params = CreateGiftOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateGiftOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let asaasPaymentId: string | null = null;
  let paymentStatus = "pending";
  try {
    const { createAsaasPayment } = await import("../lib/asaas");
    const payment = await createAsaasPayment(params.data.weddingId, {
      amount: parsed.data.amount,
      paymentMethod: parsed.data.paymentMethod,
      customerName: parsed.data.guestName,
      customerEmail: parsed.data.guestEmail || undefined,
    });
    asaasPaymentId = payment.id;
  } catch (e: unknown) {
    const { getAsaasConfig } = await import("../lib/asaas");
    const config = await getAsaasConfig(params.data.weddingId);
    if (config) {
      res.status(502).json({ error: `Erro ao processar pagamento: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    paymentStatus = "manual";
  }

  const [order] = await db.insert(giftOrdersTable).values({
    ...parsed.data,
    amount: String(parsed.data.amount),
    weddingId: params.data.weddingId,
    asaasPaymentId,
    paymentStatus,
  }).returning();

  res.status(201).json({
    ...order,
    amount: Number(order.amount),
    giftName: null,
    createdAt: order.createdAt.toISOString(),
  });
});

router.get("/weddings/:weddingId/gift-orders/summary", authMiddleware, async (req, res): Promise<void> => {
  const params = GetGiftOrdersSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const orders = await db.select().from(giftOrdersTable)
    .where(eq(giftOrdersTable.weddingId, params.data.weddingId));

  const totalReceived = orders.filter(o => o.paymentStatus === "confirmed").reduce((sum, o) => sum + Number(o.amount), 0);
  const totalPending = orders.filter(o => o.paymentStatus === "pending").reduce((sum, o) => sum + Number(o.amount), 0);

  const guestMap = new Map<string, { total: number; status: string }>();
  for (const order of orders) {
    const existing = guestMap.get(order.guestName) || { total: 0, status: order.paymentStatus };
    existing.total += Number(order.amount);
    guestMap.set(order.guestName, existing);
  }

  res.json({
    totalReceived,
    totalPending,
    totalOrders: orders.length,
    ordersByGuest: Array.from(guestMap.entries()).map(([name, data]) => ({
      guestName: name,
      totalAmount: data.total,
      status: data.status,
    })),
  });
});

export default router;
