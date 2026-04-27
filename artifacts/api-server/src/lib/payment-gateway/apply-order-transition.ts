import { db, ordersTable, orderTransitionsTable, eq } from "@workspace/db";
import type { NormalizedPaymentStatus } from "./types";

type OrderStatus = "pending" | "paid" | "failed" | "expired" | "refunded" | "cancelled";

function normalizedToOrderStatus(s: NormalizedPaymentStatus): OrderStatus {
  switch (s) {
    case "paid": return "paid";
    case "failed": return "failed";
    case "expired": return "expired";
    case "refunded": return "refunded";
    case "cancelled": return "cancelled";
    default: return "pending";
  }
}

export interface ApplyTransitionOptions {
  orderId: number;
  fromStatus: string | null;
  toNormalized: NormalizedPaymentStatus;
  gatewayEvent: string | null;
  actor: string;
  note?: string;
  gatewayPaymentId?: string | null;
  gatewayStatus?: string | null;
}

/**
 * Updates orders.status and logs the transition in order_transitions atomically.
 * Returns the new order status.
 */
export async function applyOrderTransition(opts: ApplyTransitionOptions): Promise<OrderStatus> {
  const newStatus = normalizedToOrderStatus(opts.toNormalized);

  await db.transaction(async (tx) => {
    const update: Record<string, unknown> = { status: newStatus };
    if (newStatus === "paid") update.paidAt = new Date();
    if (opts.gatewayPaymentId !== undefined) update.gatewayPaymentId = opts.gatewayPaymentId;
    if (opts.gatewayStatus !== undefined) update.gatewayStatus = opts.gatewayStatus;

    await tx.update(ordersTable).set(update).where(eq(ordersTable.id, opts.orderId));

    await tx.insert(orderTransitionsTable).values({
      orderId: opts.orderId,
      fromStatus: opts.fromStatus,
      toStatus: newStatus,
      gatewayEvent: opts.gatewayEvent,
      actor: opts.actor,
      note: opts.note,
    });
  });

  return newStatus;
}
