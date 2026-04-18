import { db, integrationSettingsTable, eq } from "@workspace/db";

export interface PurchaseNotificationParams {
  guestName: string;
  groomName: string;
  brideName: string;
  weddingDate: Date;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
  paymentMethod: "pix" | "credit_card";
  installments?: number;
  thankYouMessage?: string | null;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function buildPurchaseMessage(params: PurchaseNotificationParams): string {
  const itemsList = params.items
    .map((item) => `  • ${item.name} (x${item.quantity}) — ${formatCurrency(item.unitPrice * item.quantity)}`)
    .join("\n");

  const paymentInfo = params.paymentMethod === "credit_card" && params.installments && params.installments > 1
    ? `Cartão de crédito em ${params.installments}x de ${formatCurrency(params.totalAmount / params.installments)}`
    : params.paymentMethod === "credit_card"
    ? "Cartão de crédito à vista"
    : "PIX";

  const thankYou = params.thankYouMessage?.trim()
    ? `\n\n💌 ${params.thankYouMessage.trim()}`
    : "\n\nCom muito amor, os noivos. 💍";

  return [
    `Olá, *${params.guestName}*! 🎁`,
    "",
    `Sua compra de presente para o casamento de *${params.groomName}* e *${params.brideName}* foi confirmada! 🎊`,
    `Data do casamento: ${formatDate(params.weddingDate)}`,
    "",
    "*Itens adquiridos:*",
    itemsList,
    "",
    `*Total:* ${formatCurrency(params.totalAmount)}`,
    `*Pagamento:* ${paymentInfo}`,
    thankYou,
  ].join("\n");
}

export async function sendWhatsAppMessage(weddingId: number, phone: string, message: string): Promise<void> {
  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));

  if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstance) {
    throw new Error("Evolution API não configurada para este casamento");
  }

  const cleanPhone = phone.replace(/\D/g, "");

  const response = await fetch(
    `${settings.evolutionApiUrl}/message/sendText/${settings.evolutionInstance}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: settings.evolutionApiKey,
      },
      body: JSON.stringify({ number: cleanPhone, text: message }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Falha ao enviar mensagem: ${error}`);
  }
}

/**
 * Sends a post-purchase WhatsApp notification asynchronously.
 * Failures are logged but never propagate — callers must not await this for critical paths.
 */
export function sendPurchaseNotificationAsync(
  weddingId: number,
  phone: string,
  params: PurchaseNotificationParams,
): void {
  const message = buildPurchaseMessage(params);

  sendWhatsAppMessage(weddingId, phone, message).catch((err: unknown) => {
    console.error(
      `[WhatsApp] Falha ao enviar notificação pós-compra (wedding=${weddingId}, phone=${phone}):`,
      err instanceof Error ? err.message : String(err),
    );
  });
}
