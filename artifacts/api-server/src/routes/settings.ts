import { Router, type IRouter } from "express";
import { db, integrationSettingsTable, whatsappConnectionsTable, eq, and } from "@workspace/db";
import { getEvolutionConnectionState } from "../lib/evolution-client";
import { loadGatewayConfig } from "../lib/payment-gateway/load-config";
import { getGateway } from "../lib/payment-gateway/registry";
import {
  GetIntegrationSettingsParams,
  UpdateIntegrationSettingsParams,
  UpdateIntegrationSettingsBody,
  TestWhatsappConnectionParams,
  TestAsaasConnectionParams,
} from "@workspace/api-zod";
import { authMiddleware, requireWeddingRole } from "../lib/auth";

const router: IRouter = Router();

function maskSecret(value: string | null): string | null {
  if (!value || value.length < 8) return value ? "••••" : null;
  return value.substring(0, 4) + "•".repeat(Math.min(value.length - 4, 20));
}

router.get("/weddings/:weddingId/settings", authMiddleware, requireWeddingRole("planner", "admin"), async (req, res): Promise<void> => {
  const params = GetIntegrationSettingsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, params.data.weddingId));

  if (!settings) {
    [settings] = await db.insert(integrationSettingsTable).values({
      weddingId: params.data.weddingId,
    }).returning();
  }

  res.json({
    ...settings,
    asaasApiKey: maskSecret(settings.asaasApiKey),
    evolutionApiKey: maskSecret(settings.evolutionApiKey),
    asaasWebhookToken: maskSecret(settings.asaasWebhookToken),
  });
});

router.put("/weddings/:weddingId/settings", authMiddleware, requireWeddingRole("planner", "admin"), async (req, res): Promise<void> => {
  const params = UpdateIntegrationSettingsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateIntegrationSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, params.data.weddingId));

  const updateData: Record<string, unknown> = { ...parsed.data };
  const secretFields = ["asaasApiKey", "evolutionApiKey", "asaasWebhookToken"] as const;
  // asaasPublicKey and activePaymentGateway are not secret — include as-is
  for (const field of secretFields) {
    const val = updateData[field];
    if (typeof val === "string" && val.includes("••")) {
      delete updateData[field];
    }
  }

  let settings;
  if (existing.length === 0) {
    [settings] = await db.insert(integrationSettingsTable).values({
      ...updateData,
      weddingId: params.data.weddingId,
    } as typeof integrationSettingsTable.$inferInsert).returning();
  } else {
    [settings] = await db.update(integrationSettingsTable).set(updateData)
      .where(eq(integrationSettingsTable.weddingId, params.data.weddingId)).returning();
  }

  res.json({
    ...settings,
    asaasApiKey: maskSecret(settings.asaasApiKey),
    evolutionApiKey: maskSecret(settings.evolutionApiKey),
    asaasWebhookToken: maskSecret(settings.asaasWebhookToken),
  });
});

router.post("/weddings/:weddingId/settings/test-whatsapp", authMiddleware, requireWeddingRole("planner", "admin"), async (req, res): Promise<void> => {
  const params = TestWhatsappConnectionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const weddingId = params.data.weddingId;

  try {
    const [settings] = await db.select().from(integrationSettingsTable)
      .where(eq(integrationSettingsTable.weddingId, weddingId));

    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey) {
      res.json({ success: false, message: "Informe a Base URL e a API Key do servidor Evolution (admin)." });
      return;
    }

    const baseUrl = settings.evolutionApiUrl.replace(/\/+$/, "");
    const adminKey = settings.evolutionApiKey;

    const q = req.query.connectionId;
    const connectionIdFromQuery =
      typeof q === "string" ? Number(q) : Array.isArray(q) ? Number(q[0]) : NaN;

    let instanceName: string | null = null;
    let apiKeyForCall = adminKey;

    if (Number.isFinite(connectionIdFromQuery) && connectionIdFromQuery > 0) {
      const [c] = await db
        .select()
        .from(whatsappConnectionsTable)
        .where(
          and(
            eq(whatsappConnectionsTable.weddingId, weddingId),
            eq(whatsappConnectionsTable.id, connectionIdFromQuery),
          ),
        );
      if (c?.evolutionInstanceName) {
        instanceName = c.evolutionInstanceName;
        apiKeyForCall = c.evolutionInstanceApiKey ?? adminKey;
      }
    }

    if (!instanceName) {
      const conns = await db
        .select()
        .from(whatsappConnectionsTable)
        .where(eq(whatsappConnectionsTable.weddingId, weddingId));
      const eventConn = conns.find(
        (r) => r.ownerKind === "event" && r.evolutionInstanceName,
      );
      const anyConn = conns.find((r) => r.evolutionInstanceName);
      const picked = eventConn ?? anyConn;
      if (picked?.evolutionInstanceName) {
        instanceName = picked.evolutionInstanceName;
        apiKeyForCall = picked.evolutionInstanceApiKey ?? adminKey;
      }
    }

    if (!instanceName && settings.evolutionInstance) {
      instanceName = settings.evolutionInstance;
      apiKeyForCall = adminKey;
    }

    if (!instanceName) {
      const ping = await fetch(`${baseUrl}/instance/fetchInstances`, {
        headers: { apikey: adminKey },
      });
      if (ping.ok) {
        res.json({
          success: true,
          message:
            "Servidor Evolution acessível (API admin válida). Cadastre uma conexão WhatsApp para testar o estado de uma instância.",
        });
        return;
      }
      res.json({
        success: false,
        message:
          ping.status === 404
            ? "Base URL ou rota da Evolution incompatível. Cadastre pelo menos uma conexão WhatsApp com nome de instância para testar."
            : `Evolution API: ${ping.status} ${ping.statusText}`,
      });
      return;
    }

    const result = await getEvolutionConnectionState(baseUrl, apiKeyForCall, instanceName);
    res.json({
      success: true,
      message: `Instância "${instanceName}": estado ${result.state ?? "—"}`,
    });
  } catch (e: unknown) {
    res.json({ success: false, message: `Erro: ${e instanceof Error ? e.message : String(e)}` });
  }
});

router.post("/weddings/:weddingId/settings/test-asaas", authMiddleware, requireWeddingRole("planner", "admin"), async (req, res): Promise<void> => {
  const params = TestAsaasConnectionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  try {
    const config = await loadGatewayConfig(params.data.weddingId);
    if (!config) {
      res.json({ success: false, message: "API Key do Asaas não configurada" });
      return;
    }
    const gateway = getGateway(config.gatewayName);
    const result = await gateway.testConnection(config);
    res.json(result);
  } catch (e: unknown) {
    res.json({ success: false, message: `Erro: ${e instanceof Error ? e.message : String(e)}` });
  }
});

export default router;
