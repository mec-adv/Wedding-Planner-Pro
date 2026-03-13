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
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/settings", authMiddleware, async (req, res): Promise<void> => {
  const params = GetIntegrationSettingsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  let [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, params.data.weddingId));

  if (!settings) {
    [settings] = await db.insert(integrationSettingsTable).values({
      weddingId: params.data.weddingId,
    }).returning();
  }

  res.json(settings);
});

router.put("/weddings/:weddingId/settings", authMiddleware, async (req, res): Promise<void> => {
  const params = UpdateIntegrationSettingsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateIntegrationSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, params.data.weddingId));

  let settings;
  if (existing.length === 0) {
    [settings] = await db.insert(integrationSettingsTable).values({
      ...parsed.data,
      weddingId: params.data.weddingId,
    }).returning();
  } else {
    [settings] = await db.update(integrationSettingsTable).set(parsed.data)
      .where(eq(integrationSettingsTable.weddingId, params.data.weddingId)).returning();
  }

  res.json(settings);
});

router.post("/weddings/:weddingId/settings/test-whatsapp", authMiddleware, async (req, res): Promise<void> => {
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
      const data = await response.json();
      res.json({ success: true, message: `Conectado! Status: ${JSON.stringify(data)}` });
    } else {
      res.json({ success: false, message: `Erro na conexão: ${response.statusText}` });
    }
  } catch (e: any) {
    res.json({ success: false, message: `Erro: ${e.message}` });
  }
});

router.post("/weddings/:weddingId/settings/test-asaas", authMiddleware, async (req, res): Promise<void> => {
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
      const data = await response.json();
      res.json({ success: true, message: `Conectado! Saldo: R$ ${data.balance || 0}` });
    } else {
      res.json({ success: false, message: `Erro na conexão: ${response.statusText}` });
    }
  } catch (e: any) {
    res.json({ success: false, message: `Erro: ${e.message}` });
  }
});

export default router;
