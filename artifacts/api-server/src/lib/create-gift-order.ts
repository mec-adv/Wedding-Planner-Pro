import { db, giftOrdersTable, eq, and, type GiftOrder } from "@workspace/db";

export type CreateGiftOrderPaymentInput = {
  amount: number;
  paymentMethod: "pix" | "boleto" | "credit_card";
  guestName: string;
  guestEmail?: string | null;
  guestCpf?: string | null;
  creditCardNumber?: string | null;
  creditCardHolderName?: string | null;
  creditCardExpiryMonth?: string | null;
  creditCardExpiryYear?: string | null;
  creditCardCcv?: string | null;
  creditCardHolderCpf?: string | null;
  creditCardHolderEmail?: string | null;
  creditCardHolderPhone?: string | null;
  creditCardHolderPostalCode?: string | null;
  creditCardHolderAddressNumber?: string | null;
  installmentCount?: number | null;
};

export async function findGiftOrderByIdempotency(
  weddingId: number,
  idempotencyKey: string,
): Promise<GiftOrder | undefined> {
  const [row] = await db
    .select()
    .from(giftOrdersTable)
    .where(and(eq(giftOrdersTable.weddingId, weddingId), eq(giftOrdersTable.idempotencyKey, idempotencyKey)))
    .limit(1);
  return row;
}

export async function createGiftOrderWithPayment(params: {
  weddingId: number;
  giftId: number;
  payment: CreateGiftOrderPaymentInput;
  guestId?: number | null;
  idempotencyKey?: string | null;
  coupleMessage?: string | null;
}): Promise<{
  order: GiftOrder;
  paymentArtifacts: Record<string, unknown>;
  reused: boolean;
}> {
  const { weddingId, giftId, payment, guestId, idempotencyKey, coupleMessage } = params;

  if (idempotencyKey) {
    const existing = await findGiftOrderByIdempotency(weddingId, idempotencyKey);
    if (existing) {
      return {
        order: existing,
        paymentArtifacts: {},
        reused: true,
      };
    }
  }

  let asaasPaymentId: string | null = null;
  let paymentStatus = "pending";
  let paymentArtifacts: Record<string, unknown> = {};
  try {
    const { createAsaasPayment } = await import("./asaas");
    const pay = await createAsaasPayment(weddingId, {
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      customerName: payment.guestName,
      customerEmail: payment.guestEmail || undefined,
      customerCpf: payment.guestCpf || undefined,
      creditCardNumber: payment.creditCardNumber || undefined,
      creditCardHolderName: payment.creditCardHolderName || undefined,
      creditCardExpiryMonth: payment.creditCardExpiryMonth || undefined,
      creditCardExpiryYear: payment.creditCardExpiryYear || undefined,
      creditCardCcv: payment.creditCardCcv || undefined,
      creditCardHolderCpf: payment.creditCardHolderCpf || undefined,
      creditCardHolderEmail: payment.creditCardHolderEmail || undefined,
      creditCardHolderPhone: payment.creditCardHolderPhone || undefined,
      creditCardHolderPostalCode: payment.creditCardHolderPostalCode || undefined,
      creditCardHolderAddressNumber: payment.creditCardHolderAddressNumber || undefined,
      installmentCount: payment.installmentCount || undefined,
    });
    asaasPaymentId = pay.id;
    paymentArtifacts = {
      invoiceUrl: pay.invoiceUrl,
      bankSlipUrl: pay.bankSlipUrl,
      pixQrCode: pay.pixQrCode,
      pixCopyPaste: pay.pixCopyPaste,
      paymentStatus: pay.status,
    };
  } catch (e: unknown) {
    const { getAsaasConfig } = await import("./asaas");
    const config = await getAsaasConfig(weddingId);
    if (config) {
      throw e;
    }
    paymentStatus = "manual";
  }

  const [order] = await db
    .insert(giftOrdersTable)
    .values({
      giftId,
      guestName: payment.guestName,
      guestEmail: payment.guestEmail ?? null,
      paymentMethod: payment.paymentMethod,
      amount: String(payment.amount),
      weddingId,
      asaasPaymentId,
      paymentStatus,
      guestId: guestId ?? null,
      idempotencyKey: idempotencyKey ?? null,
      coupleMessage: coupleMessage?.trim() ? coupleMessage.trim() : null,
      coupleMessageStatus: coupleMessage?.trim() ? "pending" : "skipped",
    })
    .returning();

  if (!order) {
    throw new Error("Falha ao criar pedido de presente.");
  }

  return { order, paymentArtifacts, reused: false };
}
