import { Router, type IRouter } from "express";
import {
  db, giftOrdersTable, ordersTable, muralMessagesTable,
  orderItemsTable, guestsTable, weddingsTable, eq,
} from "@workspace/db";
import { findConfigByWebhookToken } from "../lib/payment-gateway/load-config";
import { getGateway } from "../lib/payment-gateway/registry";
import { applyOrderTransition } from "../lib/payment-gateway/apply-order-transition";
import type { PaymentGatewayName } from "../lib/payment-gateway/types";
import { sendPurchaseNotificationAsync } from "../lib/evolution-api";
import { sendConfirmationEmail } from "../lib/email";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// POST /webhooks/:gateway  — generic gateway webhook dispatcher
// ---------------------------------------------------------------------------
router.post("/webhooks/:gateway", async (req, res): Promise<void> => {
  const gatewayName = req.params.gateway as PaymentGatewayName;

  // Always respond immediately to prevent gateway timeouts; process async
  res.json({ received: true });

  void processWebhook(gatewayName, req.headers as Record<string, string | undefined>, req.body);
});

async function processWebhook(
  gatewayName: PaymentGatewayName,
  headers: Record<string, string | string[] | undefined>,
  body: unknown,
): Promise<void> {
  let gateway;
  try {
    gateway = getGateway(gatewayName);
  } catch {
    console.warn(`Webhook: gateway não suportado: ${gatewayName}`);
    return;
  }

  // For Asaas: find wedding config by webhook token
  const rawToken = headers["asaas-access-token"];
  const tokenStr = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (!tokenStr) {
    console.warn(`[Webhook:${gatewayName}] token ausente`);
    return;
  }

  const found = await findConfigByWebhookToken(gatewayName, tokenStr);
  if (!found) {
    console.warn(`[Webhook:${gatewayName}] token inválido`);
    return;
  }

  const { config } = found;

  let parsed;
  try {
    parsed = await gateway.verifyAndParseWebhook(config, headers, body);
  } catch (err: unknown) {
    console.warn(`[Webhook:${gatewayName}] parse error:`, err instanceof Error ? err.message : String(err));
    return;
  }

  if (!parsed.normalizedStatus) return; // event not actionable

  const { gatewayPaymentId, eventName, normalizedStatus } = parsed;

  // ── Try new orders table first (Gift Shop v2)
  const [newOrder] = await db.select().from(ordersTable)
    .where(eq(ordersTable.gatewayPaymentId, gatewayPaymentId)).limit(1);

  if (newOrder) {
    if (normalizedStatus === "paid" && newOrder.status !== "paid") {
      await applyOrderTransition({
        orderId: newOrder.id, fromStatus: newOrder.status, toNormalized: "paid",
        gatewayEvent: eventName, actor: "gateway_webhook",
        gatewayPaymentId, gatewayStatus: eventName,
      });

      // Persist mural message
      if (newOrder.muralMessage) {
        const already = await db.select({ id: muralMessagesTable.id })
          .from(muralMessagesTable).where(eq(muralMessagesTable.orderId, newOrder.id)).limit(1);
        if (!already.length) {
          await db.insert(muralMessagesTable).values({
            weddingId: newOrder.weddingId,
            guestId: newOrder.guestId,
            authorName: newOrder.buyerName,
            message: newOrder.muralMessage,
            source: "checkout",
            orderId: newOrder.id,
          });
        }
      }

      // Fire notifications async
      void notifyPaid(newOrder).catch((err: unknown) => {
        console.error("[Webhook] Notification error:", err instanceof Error ? err.message : String(err));
      });

    } else if (normalizedStatus !== "paid" && newOrder.status !== normalizedStatus) {
      await applyOrderTransition({
        orderId: newOrder.id, fromStatus: newOrder.status, toNormalized: normalizedStatus,
        gatewayEvent: eventName, actor: "gateway_webhook", gatewayStatus: eventName,
      });
    }

    return;
  }

  // ── Fallback: legacy gift_orders table (deprecated — keep for backward compat)
  try {
    if (normalizedStatus === "paid") {
      await db.update(giftOrdersTable).set({ paymentStatus: "confirmed" })
        .where(eq(giftOrdersTable.asaasPaymentId, gatewayPaymentId));
    } else if (normalizedStatus === "expired" || normalizedStatus === "cancelled") {
      await db.update(giftOrdersTable).set({ paymentStatus: "failed" })
        .where(eq(giftOrdersTable.asaasPaymentId, gatewayPaymentId));
    } else if (normalizedStatus === "refunded") {
      await db.update(giftOrdersTable).set({ paymentStatus: "refunded" })
        .where(eq(giftOrdersTable.asaasPaymentId, gatewayPaymentId));
    }
  } catch (e: unknown) {
    console.error("[Webhook] Legacy processing error:", e instanceof Error ? e.message : String(e));
  }
}

async function notifyPaid(order: typeof ordersTable.$inferSelect): Promise<void> {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const [wedding] = await db.select({
    brideName: weddingsTable.brideName, groomName: weddingsTable.groomName,
    date: weddingsTable.date, thankYouMessage: weddingsTable.thankYouMessage,
  }).from(weddingsTable).where(eq(weddingsTable.id, order.weddingId)).limit(1);
  if (!wedding) return;

  let guestPhone: string | null = order.buyerPhone?.trim() || null;
  let guestEmail: string | null = null;
  if (order.guestId) {
    const [guest] = await db.select({ phone: guestsTable.phone, email: guestsTable.email })
      .from(guestsTable).where(eq(guestsTable.id, order.guestId)).limit(1);
    if (!guestPhone) guestPhone = guest?.phone ?? null;
    guestEmail = guest?.email ?? null;
  }

  const notifItems = items.map((i) => ({
    name: i.giftNameSnapshot, quantity: i.quantity, unitPrice: parseFloat(i.unitPriceSnapshot),
  }));

  if (guestPhone && !order.whatsappSentAt) {
    sendPurchaseNotificationAsync(order.weddingId, guestPhone, {
      guestName: order.buyerName, groomName: wedding.groomName, brideName: wedding.brideName,
      weddingDate: wedding.date, items: notifItems,
      totalAmount: parseFloat(order.totalAmount),
      paymentMethod: order.paymentMethod, installments: order.installments,
      thankYouMessage: wedding.thankYouMessage,
    });
    await db.update(ordersTable).set({ whatsappSentAt: new Date() }).where(eq(ordersTable.id, order.id));
  }

  if (guestEmail && !order.emailSentAt) {
    await sendConfirmationEmail({
      weddingId: order.weddingId, toEmail: guestEmail, buyerName: order.buyerName,
      items: items.map((i) => ({
        name: i.giftNameSnapshot, quantity: i.quantity,
        unitPrice: parseFloat(i.unitPriceSnapshot), subtotal: parseFloat(i.subtotal),
      })),
      totalAmount: parseFloat(order.totalAmount),
      paymentMethod: order.paymentMethod, installments: order.installments,
      thankYouMessage: wedding.thankYouMessage,
      groomName: wedding.groomName, brideName: wedding.brideName,
    }).catch((err: unknown) => {
      console.error("[Webhook] Email error:", err instanceof Error ? err.message : String(err));
    });
    await db.update(ordersTable).set({ emailSentAt: new Date() }).where(eq(ordersTable.id, order.id));
  }
}

export default router;
