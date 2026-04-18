import { Router, type IRouter } from "express";
import {
  db, giftOrdersTable, ordersTable, muralMessagesTable,
  orderItemsTable, guestsTable, weddingsTable,
  integrationSettingsTable, eq,
} from "@workspace/db";
import { sendPurchaseNotificationAsync } from "../lib/evolution-api";
import { sendConfirmationEmail } from "../lib/email";

const router: IRouter = Router();

router.post("/webhooks/asaas", async (req, res): Promise<void> => {
  const webhookToken = req.headers["asaas-access-token"] as string | undefined;

  if (!webhookToken) {
    console.warn("Asaas webhook: missing access token");
    res.status(401).json({ error: "Missing webhook token" });
    return;
  }

  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.asaasWebhookToken, webhookToken));
  if (!settings) {
    console.warn("Asaas webhook: invalid access token");
    res.status(401).json({ error: "Invalid webhook token" });
    return;
  }

  // Respond immediately — process asynchronously
  res.json({ received: true });

  const body = req.body as { event?: string; payment?: { id?: string } };
  if (!body?.payment?.id) return;

  const paymentId = body.payment.id;
  const event = body.event ?? "";

  // -------------------------------------------------------------------------
  // Process new orders table (Gift Shop v2)
  // -------------------------------------------------------------------------
  const [newOrder] = await db.select().from(ordersTable)
    .where(eq(ordersTable.asaasPaymentId, paymentId)).limit(1);

  if (newOrder) {
    if ((event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") && newOrder.status !== "paid") {
      await db.update(ordersTable).set({
        status: "paid",
        asaasStatus: event,
        paidAt: new Date(),
      }).where(eq(ordersTable.id, newOrder.id));

      // Persist mural message now that payment is confirmed
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

      // Fire notifications
      void (async () => {
        try {
          const items = await db.select().from(orderItemsTable)
            .where(eq(orderItemsTable.orderId, newOrder.id));

          const [wedding] = await db.select({
            brideName: weddingsTable.brideName,
            groomName: weddingsTable.groomName,
            date: weddingsTable.date,
            thankYouMessage: weddingsTable.thankYouMessage,
          }).from(weddingsTable).where(eq(weddingsTable.id, newOrder.weddingId)).limit(1);

          if (!wedding) return;

          let guestPhone: string | null = null;
          let guestEmail: string | null = null;
          if (newOrder.guestId) {
            const [guest] = await db.select({ phone: guestsTable.phone, email: guestsTable.email })
              .from(guestsTable).where(eq(guestsTable.id, newOrder.guestId)).limit(1);
            guestPhone = guest?.phone ?? null;
            guestEmail = guest?.email ?? null;
          }

          const notifItems = items.map((i) => ({
            name: i.giftNameSnapshot,
            quantity: i.quantity,
            unitPrice: parseFloat(i.unitPriceSnapshot),
          }));

          if (guestPhone && !newOrder.whatsappSentAt) {
            sendPurchaseNotificationAsync(newOrder.weddingId, guestPhone, {
              guestName: newOrder.buyerName,
              groomName: wedding.groomName,
              brideName: wedding.brideName,
              weddingDate: wedding.date,
              items: notifItems,
              totalAmount: parseFloat(newOrder.totalAmount),
              paymentMethod: newOrder.paymentMethod,
              installments: newOrder.installments,
              thankYouMessage: wedding.thankYouMessage,
            });
            await db.update(ordersTable).set({ whatsappSentAt: new Date() })
              .where(eq(ordersTable.id, newOrder.id));
          }

          if (guestEmail && !newOrder.emailSentAt) {
            await sendConfirmationEmail({
              weddingId: newOrder.weddingId,
              toEmail: guestEmail,
              buyerName: newOrder.buyerName,
              items: items.map((i) => ({
                name: i.giftNameSnapshot,
                quantity: i.quantity,
                unitPrice: parseFloat(i.unitPriceSnapshot),
                subtotal: parseFloat(i.subtotal),
              })),
              totalAmount: parseFloat(newOrder.totalAmount),
              paymentMethod: newOrder.paymentMethod,
              installments: newOrder.installments,
              thankYouMessage: wedding.thankYouMessage,
              groomName: wedding.groomName,
              brideName: wedding.brideName,
            }).catch((err: unknown) => {
              console.error("[Webhook] Email confirmation failed:", err instanceof Error ? err.message : String(err));
            });
            await db.update(ordersTable).set({ emailSentAt: new Date() })
              .where(eq(ordersTable.id, newOrder.id));
          }
        } catch (err: unknown) {
          console.error("[Webhook] Post-payment notification error:", err instanceof Error ? err.message : String(err));
        }
      })();

    } else if (event === "PAYMENT_OVERDUE" && newOrder.status === "pending") {
      await db.update(ordersTable).set({ status: "expired", asaasStatus: event })
        .where(eq(ordersTable.id, newOrder.id));
    } else if (event === "PAYMENT_DELETED" && newOrder.status === "pending") {
      await db.update(ordersTable).set({ status: "cancelled", asaasStatus: event })
        .where(eq(ordersTable.id, newOrder.id));
    } else if (event === "PAYMENT_REFUNDED") {
      await db.update(ordersTable).set({ status: "refunded", asaasStatus: event })
        .where(eq(ordersTable.id, newOrder.id));
    }

    return;
  }

  // -------------------------------------------------------------------------
  // Fallback: legacy gift_orders table (old flow — keep for backward compat)
  // -------------------------------------------------------------------------
  try {
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      await db.update(giftOrdersTable)
        .set({ paymentStatus: "confirmed" })
        .where(eq(giftOrdersTable.asaasPaymentId, paymentId));
    } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED") {
      await db.update(giftOrdersTable)
        .set({ paymentStatus: "failed" })
        .where(eq(giftOrdersTable.asaasPaymentId, paymentId));
    } else if (event === "PAYMENT_REFUNDED") {
      await db.update(giftOrdersTable)
        .set({ paymentStatus: "refunded" })
        .where(eq(giftOrdersTable.asaasPaymentId, paymentId));
    }
  } catch (e: unknown) {
    console.error("Webhook legacy processing error:", e instanceof Error ? e.message : String(e));
  }
});

export default router;
