import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, integrationSettingsTable } from "@workspace/db";
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

  try {
    const [settings] = await db.select().from(integrationSettingsTable)
      .where(eq(integrationSettingsTable.weddingId, params.data.weddingId));

    if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstance) {
      res.json({ success: false, message: "Configurações da Evolution API incompletas" });
      return;
    }

    const response = await fetch(`${settings.evolutionApiUrl}/instance/connectionState/${settings.evolutionInstance}`, {
      headers: { apikey: settings.evolutionApiKey },
    });

    if (response.ok) {
      const data = await response.json() as Record<string, unknown>;
      res.json({ success: true, message: `Conectado! Status: ${JSON.stringify(data)}` });
    } else {
      res.json({ success: false, message: `Erro na conexão: ${response.statusText}` });
    }
  } catch (e: unknown) {
    res.json({ success: false, message: `Erro: ${e instanceof Error ? e.message : String(e)}` });
  }
});

router.post("/weddings/:weddingId/settings/test-asaas", authMiddleware, requireWeddingRole("planner", "admin"), async (req, res): Promise<void> => {
  const params = TestAsaasConnectionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  try {
    const [settings] = await db.select().from(integrationSettingsTable)
      .where(eq(integrationSettingsTable.weddingId, params.data.weddingId));

    if (!settings || !settings.asaasApiKey) {
      res.json({ success: false, message: "API Key do Asaas não configurada" });
      return;
    }

    const baseUrl = settings.asaasEnvironment === "production"
      ? "https://api.asaas.com/v3"
      : "https://sandbox.asaas.com/api/v3";

    const response = await fetch(`${baseUrl}/finance/balance`, {
      headers: { access_token: settings.asaasApiKey },
    });

    if (response.ok) {
      const data = await response.json() as Record<string, unknown>;
      res.json({ success: true, message: `Conectado! Saldo: R$ ${data.balance ?? 0}` });
    } else {
      res.json({ success: false, message: `Erro na conexão: ${response.statusText}` });
    }
  } catch (e: unknown) {
    res.json({ success: false, message: `Erro: ${e instanceof Error ? e.message : String(e)}` });
  }
});

export default router;
