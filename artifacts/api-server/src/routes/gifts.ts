import { randomUUID } from "crypto";
import { writeFile } from "fs/promises";
import path from "path";
import multer from "multer";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, giftsTable, giftOrdersTable, weddingsTable, eq, and } from "@workspace/db";
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
import { authMiddleware, requireWeddingRole } from "../lib/auth";
import {
  ensureDir,
  extFromMime,
  getPublicUrlForRelativeKey,
  getWeddingEventRelativePath,
  getWeddingGiftDirAbsolute,
  isManagedGiftImageUrl,
  unlinkManagedGiftImage,
} from "../lib/gift-upload-paths";
import { createGiftOrderWithPayment } from "../lib/create-gift-order";

const router: IRouter = Router();

const giftImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Use JPG, PNG ou WebP"));
    }
  },
});

function normalizeCategory(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function uploadGiftImageMiddleware(req: Request, res: Response, next: NextFunction): void {
  giftImageUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload";
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}

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

router.post(
  "/weddings/:weddingId/gifts/upload-image",
  authMiddleware,
  requireWeddingRole("planner", "coordinator"),
  uploadGiftImageMiddleware,
  async (req, res): Promise<void> => {
    const params = CreateGiftParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({ error: "Arquivo obrigatório (campo file)" });
      return;
    }

    const ext = extFromMime(file.mimetype);
    if (!ext) {
      res.status(400).json({ error: "Use JPG, PNG ou WebP" });
      return;
    }

    const [wedding] = await db.select().from(weddingsTable).where(eq(weddingsTable.id, params.data.weddingId)).limit(1);
    if (!wedding) {
      res.status(404).json({ error: "Casamento não encontrado" });
      return;
    }

    const dir = getWeddingGiftDirAbsolute(wedding.id, wedding.createdById, wedding.title);
    await ensureDir(dir);
    const fileName = `${randomUUID()}${ext}`;
    const absPath = path.join(dir, fileName);
    await writeFile(absPath, file.buffer);

    const rel = path.join(getWeddingEventRelativePath(wedding.id, wedding.createdById, wedding.title), "gifts", fileName);
    res.json({ url: getPublicUrlForRelativeKey(rel) });
  },
);

router.post("/weddings/:weddingId/gifts", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
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
    category: normalizeCategory(parsed.data.category),
    humorTag: parsed.data.humorTag ?? null,
    weddingId: params.data.weddingId,
    isActive: parsed.data.isActive ?? true,
  }).returning();

  res.status(201).json({
    ...gift,
    price: Number(gift.price),
    createdAt: gift.createdAt.toISOString(),
  });
});

router.patch("/weddings/:weddingId/gifts/:id", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
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

  const [existing] = await db.select().from(giftsTable)
    .where(and(eq(giftsTable.id, params.data.id), eq(giftsTable.weddingId, params.data.weddingId)))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Presente não encontrado" });
    return;
  }

  const raw = parsed.data;
  const updateData: Record<string, unknown> = {};
  if (raw.name !== undefined) updateData.name = raw.name;
  if (raw.description !== undefined) updateData.description = raw.description;
  if (raw.category !== undefined) updateData.category = normalizeCategory(raw.category);
  if (raw.price !== undefined) updateData.price = String(raw.price);
  if (raw.imageUrl !== undefined) updateData.imageUrl = raw.imageUrl;
  if (raw.humorTag !== undefined) updateData.humorTag = raw.humorTag;
  if (raw.isActive !== undefined) updateData.isActive = raw.isActive;

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "Nenhum campo para atualizar" });
    return;
  }

  const oldImageUrl = existing.imageUrl;
  const [gift] = await db.update(giftsTable).set(updateData)
    .where(and(eq(giftsTable.id, params.data.id), eq(giftsTable.weddingId, params.data.weddingId))).returning();
  if (!gift) {
    res.status(404).json({ error: "Presente não encontrado" });
    return;
  }

  const newImageUrl = gift.imageUrl;
  if (
    raw.imageUrl !== undefined &&
    oldImageUrl &&
    String(oldImageUrl) !== String(newImageUrl ?? "") &&
    isManagedGiftImageUrl(String(oldImageUrl))
  ) {
    await unlinkManagedGiftImage(String(oldImageUrl));
  }

  res.json({
    ...gift,
    price: Number(gift.price),
    createdAt: gift.createdAt.toISOString(),
  });
});

router.delete("/weddings/:weddingId/gifts/:id", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = DeleteGiftParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db.select().from(giftsTable)
    .where(and(eq(giftsTable.id, params.data.id), eq(giftsTable.weddingId, params.data.weddingId)))
    .limit(1);

  if (row?.imageUrl && isManagedGiftImageUrl(String(row.imageUrl))) {
    await unlinkManagedGiftImage(String(row.imageUrl));
  }

  await db.delete(giftsTable).where(and(eq(giftsTable.id, params.data.id), eq(giftsTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

router.get("/weddings/:weddingId/gift-orders", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
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
    guestId: o.order.guestId ?? null,
    coupleMessage: o.order.coupleMessage ?? null,
    coupleMessageStatus: o.order.coupleMessageStatus,
    coupleMessageProcessedAt: o.order.coupleMessageProcessedAt?.toISOString() ?? null,
    idempotencyKey: o.order.idempotencyKey ?? null,
    withdrawnAt: o.order.withdrawnAt?.toISOString() ?? null,
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

  const idempotencyKey =
    typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"].trim().slice(0, 128) || null : null;

  let result: Awaited<ReturnType<typeof createGiftOrderWithPayment>>;
  try {
    result = await createGiftOrderWithPayment({
      weddingId: params.data.weddingId,
      giftId: parsed.data.giftId,
      guestId: parsed.data.guestId ?? null,
      idempotencyKey,
      coupleMessage: parsed.data.coupleMessage ?? null,
      payment: {
        amount: parsed.data.amount,
        paymentMethod: parsed.data.paymentMethod,
        guestName: parsed.data.guestName,
        guestEmail: parsed.data.guestEmail,
        guestCpf: parsed.data.guestCpf,
        creditCardNumber: parsed.data.creditCardNumber,
        creditCardHolderName: parsed.data.creditCardHolderName,
        creditCardExpiryMonth: parsed.data.creditCardExpiryMonth,
        creditCardExpiryYear: parsed.data.creditCardExpiryYear,
        creditCardCcv: parsed.data.creditCardCcv,
        creditCardHolderCpf: parsed.data.creditCardHolderCpf,
        creditCardHolderEmail: parsed.data.creditCardHolderEmail,
        creditCardHolderPhone: parsed.data.creditCardHolderPhone,
        creditCardHolderPostalCode: parsed.data.creditCardHolderPostalCode,
        creditCardHolderAddressNumber: parsed.data.creditCardHolderAddressNumber,
        installmentCount: parsed.data.installmentCount,
      },
    });
  } catch (e: unknown) {
    const { getAsaasConfig } = await import("../lib/asaas");
    const config = await getAsaasConfig(params.data.weddingId);
    if (config) {
      res.status(502).json({ error: `Erro ao processar pagamento: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro ao criar pedido" });
    return;
  }

  const { order, paymentArtifacts, reused } = result;
  const status = reused ? 200 : 201;
  res.status(status).json({
    ...order,
    amount: Number(order.amount),
    giftName: null,
    createdAt: order.createdAt.toISOString(),
    ...paymentArtifacts,
    idempotentReplay: reused,
  });
});

router.get("/weddings/:weddingId/gift-orders/summary", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = GetGiftOrdersSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const orders = await db.select().from(giftOrdersTable)
    .where(eq(giftOrdersTable.weddingId, params.data.weddingId));

  const confirmed = orders.filter(o => o.paymentStatus === "confirmed");
  const totalReceived = confirmed.reduce((sum, o) => sum + Number(o.amount), 0);
  const totalPending = orders.filter(o => o.paymentStatus === "pending").reduce((sum, o) => sum + Number(o.amount), 0);
  const totalWithdrawn = confirmed.filter(o => o.withdrawalStatus === "withdrawn").reduce((sum, o) => sum + Number(o.amount), 0);
  const totalAvailable = confirmed.filter(o => o.withdrawalStatus === "available").reduce((sum, o) => sum + Number(o.amount), 0);

  const guestMap = new Map<string, { total: number; status: string }>();
  for (const order of orders) {
    const existing = guestMap.get(order.guestName) || { total: 0, status: order.paymentStatus };
    existing.total += Number(order.amount);
    guestMap.set(order.guestName, existing);
  }

  res.json({
    totalReceived,
    totalPending,
    totalWithdrawn,
    totalAvailable,
    totalOrders: orders.length,
    ordersByGuest: Array.from(guestMap.entries()).map(([name, data]) => ({
      guestName: name,
      totalAmount: data.total,
      status: data.status,
    })),
  });
});

router.patch("/weddings/:weddingId/gift-orders/:orderId/withdrawal", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const weddingId = Number(req.params.weddingId);
  const orderId = Number(req.params.orderId);
  if (isNaN(weddingId) || isNaN(orderId)) {
    res.status(400).json({ error: "IDs inválidos" });
    return;
  }

  const { status } = req.body as { status?: string };
  if (!status || !["pending", "available", "withdrawn"].includes(status)) {
    res.status(400).json({ error: "Status inválido. Use: pending, available, withdrawn" });
    return;
  }

  const updateData: Record<string, unknown> = { withdrawalStatus: status };
  if (status === "withdrawn") {
    updateData.withdrawnAt = new Date();
  }

  const [order] = await db.update(giftOrdersTable).set(updateData)
    .where(and(eq(giftOrdersTable.id, orderId), eq(giftOrdersTable.weddingId, weddingId))).returning();

  if (!order) {
    res.status(404).json({ error: "Pedido não encontrado" });
    return;
  }

  res.json({
    ...order,
    amount: Number(order.amount),
    withdrawnAt: order.withdrawnAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
  });
});

export default router;
