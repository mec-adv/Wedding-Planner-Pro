import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, giftOrdersTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/webhooks/asaas", async (req, res): Promise<void> => {
  const body = req.body;

  if (!body || !body.payment) {
    res.json({ received: true });
    return;
  }

  const paymentId = body.payment.id;
  const event = body.event;

  if (!paymentId) {
    res.json({ received: true });
    return;
  }

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
  } catch (e: any) {
    console.error("Webhook processing error:", e.message);
  }

  res.json({ received: true });
});

export default router;
