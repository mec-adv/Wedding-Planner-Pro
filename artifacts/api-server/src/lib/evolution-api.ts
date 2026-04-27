import {
  db,
  integrationSettingsTable,
  whatsappConnectionsTable,
  eq,
  and,
  asc,
} from "@workspace/db";
import { sendEvolutionText } from "./evolution-client";

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

export type WhatsappOwnerKindFilter = "bride" | "groom" | "event";

export interface SendMessageOptions {
  /** Força usar uma conexão específica pelo id. */
  connectionId?: number;
  /** Preferência de dono da conexão (padrão: 'event'). */
  ownerKind?: WhatsappOwnerKindFilter;
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

interface ResolvedChannel {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

/**
 * Seleciona qual conexão WhatsApp usar para enviar a mensagem deste casamento.
 * Prioriza, em ordem:
 * 1. connectionId explícito;
 * 2. conexão 'connected' do ownerKind pedido (default 'event');
 * 3. qualquer conexão 'connected';
 * 4. fallback legado: integration_settings.evolutionInstance + admin apikey.
 */
async function resolveChannel(
  weddingId: number,
  opts: SendMessageOptions,
): Promise<ResolvedChannel> {
  const [settings] = await db
    .select()
    .from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));

  if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey) {
    throw new Error("Evolution API não configurada para este casamento");
  }

  const baseUrl = settings.evolutionApiUrl;
  const adminApiKey = settings.evolutionApiKey;

  if (opts.connectionId) {
    const [conn] = await db
      .select()
      .from(whatsappConnectionsTable)
      .where(
        and(
          eq(whatsappConnectionsTable.weddingId, weddingId),
          eq(whatsappConnectionsTable.id, opts.connectionId),
        ),
      );
    if (conn && conn.provider === "evolution" && conn.evolutionInstanceName) {
      return {
        baseUrl,
        apiKey: conn.evolutionInstanceApiKey ?? adminApiKey,
        instanceName: conn.evolutionInstanceName,
      };
    }
  }

  const preferredOwner: WhatsappOwnerKindFilter = opts.ownerKind ?? "event";
  const connections = await db
    .select()
    .from(whatsappConnectionsTable)
    .where(
      and(
        eq(whatsappConnectionsTable.weddingId, weddingId),
        eq(whatsappConnectionsTable.provider, "evolution"),
      ),
    )
    .orderBy(asc(whatsappConnectionsTable.id));

  const preferred = connections.find(
    (c) =>
      c.ownerKind === preferredOwner &&
      c.status === "connected" &&
      !!c.evolutionInstanceName,
  );
  const anyConnected = connections.find(
    (c) => c.status === "connected" && !!c.evolutionInstanceName,
  );
  const chosen = preferred ?? anyConnected;
  if (chosen && chosen.evolutionInstanceName) {
    return {
      baseUrl,
      apiKey: chosen.evolutionInstanceApiKey ?? adminApiKey,
      instanceName: chosen.evolutionInstanceName,
    };
  }

  // Fallback legado: continua usando o campo antigo enquanto não há migração.
  if (settings.evolutionInstance) {
    return {
      baseUrl,
      apiKey: adminApiKey,
      instanceName: settings.evolutionInstance,
    };
  }

  throw new Error(
    "Nenhuma conexão de WhatsApp conectada encontrada para este casamento",
  );
}

export async function sendWhatsAppMessage(
  weddingId: number,
  phone: string,
  message: string,
  opts: SendMessageOptions = {},
): Promise<void> {
  const channel = await resolveChannel(weddingId, opts);
  const cleanPhone = phone.replace(/\D/g, "");

  await sendEvolutionText(
    channel.baseUrl,
    channel.apiKey,
    channel.instanceName,
    cleanPhone,
    message,
  );
}

/**
 * Sends a post-purchase WhatsApp notification asynchronously.
 * Failures are logged but never propagate — callers must not await this for critical paths.
 */
export function sendPurchaseNotificationAsync(
  weddingId: number,
  phone: string,
  params: PurchaseNotificationParams,
  opts: SendMessageOptions = {},
): void {
  const message = buildPurchaseMessage(params);

  sendWhatsAppMessage(weddingId, phone, message, opts).catch((err: unknown) => {
    console.error(
      `[WhatsApp] Falha ao enviar notificação pós-compra (wedding=${weddingId}, phone=${phone}):`,
      err instanceof Error ? err.message : String(err),
    );
  });
}
