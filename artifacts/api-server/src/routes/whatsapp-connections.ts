import { Router, type IRouter } from "express";
import {
  db,
  integrationSettingsTable,
  whatsappConnectionsTable,
  eq,
  and,
  asc,
  sql,
} from "@workspace/db";
import {
  ListWhatsappConnectionsParams,
  CreateWhatsappConnectionParams,
  CreateWhatsappConnectionBody,
  DeleteWhatsappConnectionParams,
  GetWhatsappConnectionQrParams,
  GetWhatsappConnectionStatusParams,
  LogoutWhatsappConnectionParams,
} from "@workspace/api-zod";
import { authMiddleware, requireWeddingRole } from "../lib/auth";
import {
  createEvolutionInstance,
  connectEvolutionInstance,
  getEvolutionConnectionState,
  logoutEvolutionInstance,
  deleteEvolutionInstance,
} from "../lib/evolution-client";
import { respondIfWhatsappSchemaMissing } from "../lib/whatsapp-schema-error";

const router: IRouter = Router();

type WhatsappConnectionRow = typeof whatsappConnectionsTable.$inferSelect;

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length < 8) return "••••";
  return value.substring(0, 4) + "•".repeat(Math.min(value.length - 4, 20));
}

function serialize(connection: WhatsappConnectionRow) {
  return {
    ...connection,
    evolutionInstanceApiKey: maskSecret(connection.evolutionInstanceApiKey),
    metaAccessToken: maskSecret(connection.metaAccessToken),
  };
}

function mapEvolutionStateToStatus(
  state: string | null | undefined,
): WhatsappConnectionRow["status"] {
  switch (state) {
    case "open":
      return "connected";
    case "connecting":
      return "qr";
    case "close":
    case "closed":
      return "disconnected";
    default:
      return "pending";
  }
}

async function loadServerCreds(weddingId: number): Promise<{
  baseUrl: string;
  adminApiKey: string;
} | null> {
  const [settings] = await db
    .select()
    .from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));
  if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey) {
    return null;
  }
  return {
    baseUrl: settings.evolutionApiUrl,
    adminApiKey: settings.evolutionApiKey,
  };
}

router.get(
  "/weddings/:weddingId/whatsapp/connections",
  authMiddleware,
  requireWeddingRole("planner", "admin"),
  async (req, res): Promise<void> => {
    const params = ListWhatsappConnectionsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    try {
      const rows = await db
        .select()
        .from(whatsappConnectionsTable)
        .where(eq(whatsappConnectionsTable.weddingId, params.data.weddingId))
        .orderBy(asc(whatsappConnectionsTable.id));

      res.json(rows.map(serialize));
    } catch (e: unknown) {
      if (respondIfWhatsappSchemaMissing(res, e)) return;
      console.error("[whatsapp-connections] list", e);
      res.status(500).json({ error: "Erro ao listar conexões." });
    }
  },
);

router.post(
  "/weddings/:weddingId/whatsapp/connections",
  authMiddleware,
  requireWeddingRole("planner", "admin"),
  async (req, res): Promise<void> => {
    const params = CreateWhatsappConnectionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = CreateWhatsappConnectionBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const weddingId = params.data.weddingId;
    const provider = body.data.provider;

    if (provider !== "evolution") {
      res.status(400).json({
        error:
          "Apenas o provedor Evolution API está disponível no momento. WhatsApp Business Cloud em breve.",
      });
      return;
    }

    const creds = await loadServerCreds(weddingId);
    if (!creds) {
      res.status(400).json({
        error:
          "Credenciais do servidor Evolution (Base URL e API Key) não estão configuradas.",
      });
      return;
    }

    const instanceName = body.data.evolutionInstanceName.trim();
    if (!instanceName) {
      res.status(400).json({ error: "Nome da instância é obrigatório." });
      return;
    }

    try {
      // Impede duplicidade local antes de tocar na Evolution.
      const [existing] = await db
        .select()
        .from(whatsappConnectionsTable)
        .where(
          and(
            eq(whatsappConnectionsTable.weddingId, weddingId),
            eq(whatsappConnectionsTable.evolutionInstanceName, instanceName),
          ),
        );
      if (existing) {
        res.status(409).json({
          error: "Já existe uma conexão com esse nome de instância para este casamento.",
        });
        return;
      }

      const result = await createEvolutionInstance(creds.baseUrl, creds.adminApiKey, {
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        number: body.data.phoneNumber ?? undefined,
        qrcode: true,
      });

      const [inserted] = await db
        .insert(whatsappConnectionsTable)
        .values({
          weddingId,
          provider: "evolution",
          ownerKind: body.data.ownerKind,
          label: body.data.label ?? null,
          phoneNumber: body.data.phoneNumber ?? null,
          status: "qr",
          evolutionInstanceName: instanceName,
          evolutionIntegration: "WHATSAPP-BAILEYS",
          evolutionInstanceApiKey: result.apiKey,
          evolutionInstanceId: result.instanceId,
        })
        .returning();

      res.json({
        connection: serialize(inserted),
        qrcode: result.qrcode,
      });
    } catch (e: unknown) {
      if (respondIfWhatsappSchemaMissing(res, e)) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Evolution API")) {
        res.status(502).json({
          error: `Falha ao criar instância no Evolution: ${msg}`,
        });
        return;
      }
      console.error("[whatsapp-connections] create", e);
      res.status(500).json({
        error: "Erro ao registrar a conexão no banco de dados.",
        details: msg,
      });
    }
  },
);

router.get(
  "/weddings/:weddingId/whatsapp/connections/:id/qr",
  authMiddleware,
  requireWeddingRole("planner", "admin"),
  async (req, res): Promise<void> => {
    const params = GetWhatsappConnectionQrParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [connection] = await db
      .select()
      .from(whatsappConnectionsTable)
      .where(
        and(
          eq(whatsappConnectionsTable.weddingId, params.data.weddingId),
          eq(whatsappConnectionsTable.id, params.data.id),
        ),
      );
    if (!connection) {
      res.status(404).json({ error: "Conexão não encontrada" });
      return;
    }
    if (connection.provider !== "evolution" || !connection.evolutionInstanceName) {
      res.status(400).json({ error: "Conexão sem instância Evolution associada" });
      return;
    }

    const creds = await loadServerCreds(params.data.weddingId);
    if (!creds) {
      res.status(400).json({ error: "Credenciais do servidor Evolution ausentes." });
      return;
    }

    const instanceKey = connection.evolutionInstanceApiKey ?? creds.adminApiKey;

    try {
      const result = await connectEvolutionInstance(
        creds.baseUrl,
        instanceKey,
        connection.evolutionInstanceName,
      );

      await db
        .update(whatsappConnectionsTable)
        .set({ status: "qr", updatedAt: sql`now()` })
        .where(eq(whatsappConnectionsTable.id, connection.id));

      res.json({
        connectionId: connection.id,
        status: "qr",
        qrcode: result.qrcode,
      });
    } catch (e: unknown) {
      res.status(502).json({
        error: `Falha ao obter QR: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  },
);

router.get(
  "/weddings/:weddingId/whatsapp/connections/:id/status",
  authMiddleware,
  requireWeddingRole("planner", "admin"),
  async (req, res): Promise<void> => {
    const params = GetWhatsappConnectionStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [connection] = await db
      .select()
      .from(whatsappConnectionsTable)
      .where(
        and(
          eq(whatsappConnectionsTable.weddingId, params.data.weddingId),
          eq(whatsappConnectionsTable.id, params.data.id),
        ),
      );
    if (!connection) {
      res.status(404).json({ error: "Conexão não encontrada" });
      return;
    }
    if (connection.provider !== "evolution" || !connection.evolutionInstanceName) {
      res.json({
        connectionId: connection.id,
        status: connection.status,
        evolutionState: null,
      });
      return;
    }

    const creds = await loadServerCreds(params.data.weddingId);
    if (!creds) {
      res.status(400).json({ error: "Credenciais do servidor Evolution ausentes." });
      return;
    }

    const instanceKey = connection.evolutionInstanceApiKey ?? creds.adminApiKey;

    try {
      const result = await getEvolutionConnectionState(
        creds.baseUrl,
        instanceKey,
        connection.evolutionInstanceName,
      );

      const newStatus = mapEvolutionStateToStatus(result.state);
      const update: Partial<typeof whatsappConnectionsTable.$inferInsert> = {
        status: newStatus,
        updatedAt: new Date(),
      };
      if (newStatus === "connected") {
        update.lastConnectedAt = new Date();
      }
      await db
        .update(whatsappConnectionsTable)
        .set(update)
        .where(eq(whatsappConnectionsTable.id, connection.id));

      res.json({
        connectionId: connection.id,
        status: newStatus,
        evolutionState: result.state,
      });
    } catch (e: unknown) {
      res.status(502).json({
        error: `Falha ao consultar estado: ${
          e instanceof Error ? e.message : String(e)
        }`,
      });
    }
  },
);

router.post(
  "/weddings/:weddingId/whatsapp/connections/:id/logout",
  authMiddleware,
  requireWeddingRole("planner", "admin"),
  async (req, res): Promise<void> => {
    const params = LogoutWhatsappConnectionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [connection] = await db
      .select()
      .from(whatsappConnectionsTable)
      .where(
        and(
          eq(whatsappConnectionsTable.weddingId, params.data.weddingId),
          eq(whatsappConnectionsTable.id, params.data.id),
        ),
      );
    if (!connection) {
      res.status(404).json({ error: "Conexão não encontrada" });
      return;
    }

    if (connection.provider === "evolution" && connection.evolutionInstanceName) {
      const creds = await loadServerCreds(params.data.weddingId);
      if (creds) {
        const instanceKey = connection.evolutionInstanceApiKey ?? creds.adminApiKey;
        try {
          await logoutEvolutionInstance(
            creds.baseUrl,
            instanceKey,
            connection.evolutionInstanceName,
          );
        } catch (e) {
          console.warn(
            `[WhatsApp] Falha ao logout Evolution (id=${connection.id}):`,
            e instanceof Error ? e.message : String(e),
          );
        }
      }
    }

    const [updated] = await db
      .update(whatsappConnectionsTable)
      .set({ status: "disconnected", updatedAt: new Date() })
      .where(eq(whatsappConnectionsTable.id, connection.id))
      .returning();

    res.json(serialize(updated));
  },
);

router.delete(
  "/weddings/:weddingId/whatsapp/connections/:id",
  authMiddleware,
  requireWeddingRole("planner", "admin"),
  async (req, res): Promise<void> => {
    const params = DeleteWhatsappConnectionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [connection] = await db
      .select()
      .from(whatsappConnectionsTable)
      .where(
        and(
          eq(whatsappConnectionsTable.weddingId, params.data.weddingId),
          eq(whatsappConnectionsTable.id, params.data.id),
        ),
      );
    if (!connection) {
      res.status(404).json({ error: "Conexão não encontrada" });
      return;
    }

    if (connection.provider === "evolution" && connection.evolutionInstanceName) {
      const creds = await loadServerCreds(params.data.weddingId);
      if (creds) {
        const instanceKey = connection.evolutionInstanceApiKey ?? creds.adminApiKey;
        try {
          await deleteEvolutionInstance(
            creds.baseUrl,
            instanceKey,
            connection.evolutionInstanceName,
          );
        } catch (e) {
          console.warn(
            `[WhatsApp] Falha ao deletar instância Evolution (id=${connection.id}):`,
            e instanceof Error ? e.message : String(e),
          );
        }
      }
    }

    await db
      .delete(whatsappConnectionsTable)
      .where(eq(whatsappConnectionsTable.id, connection.id));

    res.status(204).end();
  },
);

export default router;
