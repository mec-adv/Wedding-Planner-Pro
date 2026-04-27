import { db, integrationSettingsTable, eq } from "@workspace/db";
import type { GatewayConfig, PaymentGatewayName } from "./types";

/** Loads the active payment gateway config for a wedding. Returns null if not configured. */
export async function loadGatewayConfig(weddingId: number): Promise<GatewayConfig | null> {
  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));

  if (!settings || !settings.asaasApiKey) return null;

  const gatewayName = (settings.activePaymentGateway ?? "asaas") as PaymentGatewayName;

  if (gatewayName === "asaas") {
    return {
      gatewayName: "asaas",
      apiKey: settings.asaasApiKey,
      environment: settings.asaasEnvironment === "production" ? "production" : "sandbox",
      webhookSecret: settings.asaasWebhookToken,
      publicKey: settings.asaasPublicKey,
    };
  }

  return null;
}

/** Finds a wedding's gateway config by matching a webhook token. Used for webhook dispatch. */
export async function findConfigByWebhookToken(
  gatewayName: PaymentGatewayName,
  token: string,
): Promise<{ weddingId: number; config: GatewayConfig } | null> {
  if (gatewayName !== "asaas") return null;

  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.asaasWebhookToken, token));

  if (!settings || !settings.asaasApiKey) return null;

  return {
    weddingId: settings.weddingId,
    config: {
      gatewayName: "asaas",
      apiKey: settings.asaasApiKey,
      environment: settings.asaasEnvironment === "production" ? "production" : "sandbox",
      webhookSecret: settings.asaasWebhookToken,
      publicKey: settings.asaasPublicKey,
    },
  };
}
