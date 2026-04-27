import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db, guestsTable, weddingsTable, giftsTable, giftCategoriesTable,
  ordersTable, orderItemsTable, orderTransitionsTable, muralMessagesTable,
  integrationSettingsTable,
  eq, and, asc, sql,
} from "@workspace/db";
import { createRateLimiter } from "../lib/public-rate-limit";
import { loadGatewayConfig } from "../lib/payment-gateway/load-config";
import { getGateway } from "../lib/payment-gateway/registry";
import { applyOrderTransition } from "../lib/payment-gateway/apply-order-transition";
import type { NormalizedPaymentStatus } from "../lib/payment-gateway/types";
import { sendPurchaseNotificationAsync } from "../lib/evolution-api";
import { sendConfirmationEmail } from "../lib/email";

const router: IRouter = Router();

const limitPublic = createRateLimiter({ windowMs: 60_000, max: 120, keyPrefix: "shop" });
const limitOrders = createRateLimiter({ windowMs: 60_000, max: 20, keyPrefix: "shop-order" });

function routeParam(p: string | string[] | undefined): string {
  if (p == null) return "";
  return Array.isArray(p) ? (p[0] ?? "") : p;
}

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

function buildExternalReference(weddingId: number, orderId: number, guestId: number | null): string {
  return `wid:${weddingId}:ord:${orderId}:guest:${guestId ?? 0}`;
}

// ---------------------------------------------------------------------------
// GET /public/weddings/:weddingId/gifts  — catálogo público
// ---------------------------------------------------------------------------
router.get("/public/weddings/:weddingId/gifts", limitPublic, async (req, res): Promise<void> => {
  const weddingId = parseInt(routeParam(req.params.weddingId), 10);
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
  const weddingId = parseInt(routeParam(req.params.weddingId), 10);
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
  const weddingId = parseInt(routeParam(req.params.weddingId), 10);
  if (!Number.isFinite(weddingId)) { res.status(400).json({ error: "Invalid weddingId" }); return; }

  const [wedding] = await db.select({
    showProgressBar: weddingsTable.showProgressBar,
    progressGoal: weddingsTable.progressGoal,
    thankYouMessage: weddingsTable.thankYouMessage,
  }).from(weddingsTable).where(eq(weddingsTable.id, weddingId)).limit(1);

  if (!wedding) { res.status(404).json({ error: "Casamento não encontrado" }); return; }

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
// GET /public/weddings/:weddingId/payment-config  — config pública de tokenização
// ---------------------------------------------------------------------------
router.get("/public/weddings/:weddingId/payment-config", limitPublic, async (req, res): Promise<void> => {
  const weddingId = parseInt(routeParam(req.params.weddingId), 10);
  if (!Number.isFinite(weddingId)) { res.status(400).json({ error: "Invalid weddingId" }); return; }

  const [settings] = await db.select({
    activePaymentGateway: integrationSettingsTable.activePaymentGateway,
    asaasEnvironment: integrationSettingsTable.asaasEnvironment,
    asaasPublicKey: integrationSettingsTable.asaasPublicKey,
    asaasApiKey: integrationSettingsTable.asaasApiKey,
  }).from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId)).limit(1);

  if (!settings || !settings.asaasApiKey) {
    res.status(404).json({ error: "Gateway de pagamento não configurado" });
    return;
  }

  res.json({
    gatewayName: settings.activePaymentGateway ?? "asaas",
    asaasPublicKey: settings.asaasPublicKey ?? null,
    asaasEnvironment: settings.asaasEnvironment ?? "sandbox",
  });
});

// ---------------------------------------------------------------------------
// POST /public/orders  — criar pedido (valida token do convidado)
// ---------------------------------------------------------------------------
const HM_QUOTA_UNIT_BRL = 50;

const CreateOrderBody = z.object({
  guestToken: z.string().min(32).max(64),
  buyerName: z.string().min(1).max(255),
  buyerPhone: z.string().min(1).max(50),
  /** CPF do pagador (obrigatório para PIX; para cartão usa-se holderCpf). */
  buyerCpf: z.string().nullish(),
  honeymoonQuotaUnits: z.number().int().min(0).max(100).optional(),
  muralMessage: z.string().max(500).nullish(),
  paymentMethod: z.enum(["pix", "credit_card"]),
  // Credit card — only tokenized path accepted; raw card fields are rejected
  creditCardToken: z.string().nullish(),
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
  // Reject any raw card data fields regardless of schema
  const raw = req.body as Record<string, unknown>;
  if (raw.cardNumber || raw.cardCcv || raw.cardExpiryMonth || raw.cardExpiryYear) {
    res.status(400).json({ error: "Dados brutos de cartão não são aceitos. Use a tokenização via Asaas.js." });
    return;
  }

  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join(", ") });
    return;
  }

  const body = parsed.data;

  // Idempotency key check
  const idempotencyKey = (req.headers["idempotency-key"] as string | undefined)?.substring(0, 128) || null;
  if (idempotencyKey) {
    const [existing] = await db.select({
      id: ordersTable.id, status: ordersTable.status, paymentMethod: ordersTable.paymentMethod,
      totalAmount: ordersTable.totalAmount, gatewayPaymentId: ordersTable.gatewayPaymentId,
    }).from(ordersTable).where(eq(ordersTable.idempotencyKey, idempotencyKey)).limit(1);

    if (existing && existing.status !== "failed") {
      res.json({
        orderId: existing.id,
        status: existing.status,
        paymentMethod: existing.paymentMethod,
        totalAmount: parseFloat(existing.totalAmount),
      });
      return;
    }
  }

  const guest = await loadGuestByToken(body.guestToken);
  if (!guest) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  if (body.buyerPhone.replace(/\D/g, "").length < 10) {
    res.status(400).json({ error: "Informe um telefone válido com DDD (mínimo 10 dígitos)." });
    return;
  }

  // Resolve effective CPF: from body, or from stored guest record
  const effectiveCpf = (body.buyerCpf ?? guest.cpf ?? "").replace(/\D/g, "");

  // CPF obrigatório para todos os métodos de pagamento
  if (effectiveCpf.length !== 11) {
    res.status(400).json({ error: "CPF é obrigatório. Informe um CPF válido (11 dígitos)." });
    return;
  }

  // Credit card validation
  if (body.paymentMethod === "credit_card") {
    if (!body.creditCardToken) {
      res.status(400).json({ error: "Token do cartão é obrigatório. Use o Asaas.js para tokenizar o cartão." });
      return;
    }
    if (!body.holderName || !body.holderCpf) {
      res.status(400).json({ error: "Nome e CPF do titular são obrigatórios para pagamento com cartão." });
      return;
    }
  }

  // Load gateway config
  const gatewayConfig = await loadGatewayConfig(guest.weddingId);
  if (!gatewayConfig) {
    res.status(400).json({ error: "Gateway de pagamento não configurado para este casamento." });
    return;
  }
  const gateway = getGateway(gatewayConfig.gatewayName);

  // Load gifts and compute totals
  const gifts = await db.select().from(giftsTable)
    .where(and(eq(giftsTable.weddingId, guest.weddingId), eq(giftsTable.isActive, true)));

  const giftMap = new Map(gifts.map((g) => [g.id, g]));
  const orderItems: Array<{ giftId: number | null; name: string; unitPrice: number; quantity: number; subtotal: number }> = [];

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

  const quotaUnits = body.honeymoonQuotaUnits ?? 0;
  if (quotaUnits > 0) {
    const subtotal = Math.round(HM_QUOTA_UNIT_BRL * quotaUnits * 100) / 100;
    orderItems.push({
      giftId: null,
      name: "Cota para a lua de mel (R$ 50,00 cada)",
      unitPrice: HM_QUOTA_UNIT_BRL,
      quantity: quotaUnits,
      subtotal,
    });
  }

  const totalAmount = Math.round(orderItems.reduce((sum, i) => sum + i.subtotal, 0) * 100) / 100;
  const installments = body.paymentMethod === "credit_card" ? (body.installments ?? 1) : 1;

  // ── Phase 1: Insert order record (status=pending, no gatewayPaymentId yet)
  let orderId!: number;
  try {
    await db.transaction(async (tx) => {
      const [order] = await tx.insert(ordersTable).values({
        weddingId: guest.weddingId,
        guestId: guest.id,
        buyerName: body.buyerName,
        buyerPhone: body.buyerPhone.trim(),
        status: "pending",
        paymentMethod: body.paymentMethod,
        installments,
        totalAmount: String(totalAmount),
        paymentGateway: gatewayConfig.gatewayName,
        idempotencyKey,
        muralMessage: body.muralMessage?.trim() || null,
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

      await tx.insert(orderTransitionsTable).values({
        orderId,
        fromStatus: null,
        toStatus: "pending",
        gatewayEvent: null,
        actor: "system",
        note: `Pedido criado via ${body.paymentMethod}`,
      });
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar pedido";
    res.status(500).json({ error: msg });
    return;
  }

  // ── Phase 2: Call gateway with externalReference containing orderId
  const externalReference = buildExternalReference(guest.weddingId, orderId, guest.id);
  let paymentArtifacts: Record<string, unknown> = {};
  let gatewayPaymentId: string;
  let gatewayStatus: string;
  let initialStatus: NormalizedPaymentStatus;

  try {
    if (body.paymentMethod === "pix") {
      const result = await gateway.createPixPayment(gatewayConfig, {
        weddingId: guest.weddingId,
        orderId,
        guestId: guest.id,
        amount: totalAmount,
        customerName: body.buyerName,
        customerEmail: guest.email ?? undefined,
        customerCpf: effectiveCpf || undefined,
        externalReference,
        expirationSeconds: pixExpirationSeconds(),
      });
      gatewayPaymentId = result.gatewayPaymentId;
      gatewayStatus = result.gatewayStatus;
      initialStatus = "pending";
      paymentArtifacts = {
        pixQrCode: result.pixQrCode,
        pixCopyPaste: result.pixCopyPaste,
        pixExpiresAt: result.pixExpiresAt,
      };
    } else {
      const result = await gateway.createCreditCardPayment(gatewayConfig, {
        weddingId: guest.weddingId,
        orderId,
        guestId: guest.id,
        amount: totalAmount,
        customerName: body.buyerName,
        customerEmail: guest.email ?? undefined,
        customerCpf: body.holderCpf!.replace(/\D/g, ""),
        externalReference,
        creditCardToken: body.creditCardToken!,
        holderName: body.holderName!,
        holderCpf: body.holderCpf!,
        holderEmail: body.holderEmail ?? undefined,
        holderPhone: body.holderPhone ?? undefined,
        holderPostalCode: body.holderPostalCode ?? undefined,
        holderAddressNumber: body.holderAddressNumber ?? undefined,
        installmentCount: installments,
      });
      gatewayPaymentId = result.gatewayPaymentId;
      gatewayStatus = result.gatewayStatus;
      initialStatus = result.normalizedStatus;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao processar pagamento";
    // Mark order as failed
    await db.transaction(async (tx) => {
      await tx.update(ordersTable).set({ status: "failed" }).where(eq(ordersTable.id, orderId));
      await tx.insert(orderTransitionsTable).values({
        orderId, fromStatus: "pending", toStatus: "failed",
        gatewayEvent: "gateway_error", actor: "system", note: msg,
      });
    });
    res.status(502).json({ error: msg });
    return;
  }

  // ── Phase 3: Update order with gatewayPaymentId and final status
  // Save CPF to guest record if not already stored (for future checkouts)
  if (effectiveCpf && !guest.cpf) {
    await db.update(guestsTable).set({ cpf: effectiveCpf }).where(eq(guestsTable.id, guest.id));
  }

  await db.transaction(async (tx) => {
    await tx.update(ordersTable).set({
      gatewayPaymentId,
      gatewayStatus,
      status: initialStatus,
      paidAt: initialStatus === "paid" ? new Date() : null,
    }).where(eq(ordersTable.id, orderId));

    if (initialStatus !== "pending") {
      await tx.insert(orderTransitionsTable).values({
        orderId, fromStatus: "pending", toStatus: initialStatus,
        gatewayEvent: gatewayStatus, actor: "system",
      });
    }

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

  if (initialStatus === "paid") {
    void triggerPaidNotifications(orderId, guest.weddingId, guest.id, body.buyerName, body.buyerPhone.trim(), orderItems, totalAmount, body.paymentMethod, installments);
  }

  res.status(201).json({
    orderId,
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
  const orderId = parseInt(routeParam(req.params.orderId), 10);
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

  // Sync from gateway if still pending
  if (order.status === "pending" && order.gatewayPaymentId) {
    try {
      const gatewayConfig = await loadGatewayConfig(guest.weddingId);
      if (gatewayConfig) {
        const gateway = getGateway(gatewayConfig.gatewayName);
        const remote = await gateway.getPaymentStatus(gatewayConfig, order.gatewayPaymentId);

        if (remote.normalizedStatus === "paid") {
          await applyOrderTransition({
            orderId, fromStatus: "pending", toNormalized: "paid",
            gatewayEvent: remote.gatewayStatus, actor: "polling",
            gatewayPaymentId: order.gatewayPaymentId, gatewayStatus: remote.gatewayStatus,
          });

          if (order.muralMessage) {
            const already = await db.select({ id: muralMessagesTable.id }).from(muralMessagesTable)
              .where(eq(muralMessagesTable.orderId, orderId)).limit(1);
            if (!already.length) {
              await db.insert(muralMessagesTable).values({
                weddingId: order.weddingId, guestId: order.guestId,
                authorName: order.buyerName, message: order.muralMessage,
                source: "checkout", orderId,
              });
            }
          }

          const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
          const notifyPhone = order.buyerPhone?.trim() || guest.phone;
          void triggerPaidNotifications(orderId, order.weddingId, order.guestId, order.buyerName, notifyPhone, items.map((i) => ({ giftId: i.giftId, name: i.giftNameSnapshot, unitPrice: parseFloat(i.unitPriceSnapshot), quantity: i.quantity, subtotal: parseFloat(i.subtotal) })), parseFloat(order.totalAmount), order.paymentMethod, order.installments);

          res.json({ orderId, status: "paid" });
          return;
        } else if (remote.normalizedStatus === "expired" || remote.normalizedStatus === "cancelled") {
          await applyOrderTransition({
            orderId, fromStatus: "pending", toNormalized: remote.normalizedStatus,
            gatewayEvent: remote.gatewayStatus, actor: "polling",
            gatewayStatus: remote.gatewayStatus,
          });
          res.json({ orderId, status: remote.normalizedStatus });
          return;
        }
      }
    } catch {
      // Polling failure is non-critical; return current DB status
    }
  }

  res.json({ orderId, status: order.status, gatewayStatus: order.gatewayStatus });
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
      gatewayPaymentId: o.gatewayPaymentId,
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
