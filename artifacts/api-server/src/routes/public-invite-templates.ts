import { Router, type IRouter } from "express";
import { z } from "zod";
import { db, publicInviteTemplatesTable, eq, and, asc } from "@workspace/db";
import { authMiddleware, requireWeddingRole } from "../lib/auth";

const router: IRouter = Router();

const WeddingId = z.object({ weddingId: z.coerce.number() });
const IdParams = z.object({ weddingId: z.coerce.number(), id: z.coerce.number() });

const CreateBody = z.object({
  name: z.string().min(1).max(255),
  isDefault: z.boolean().optional(),
  config: z.any().optional(),
});

const PatchBody = z.object({
  name: z.string().min(1).max(255).optional(),
  isDefault: z.boolean().optional(),
  config: z.any().optional(),
});

router.get(
  "/weddings/:weddingId/public-invite-templates",
  authMiddleware,
  requireWeddingRole("planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const params = WeddingId.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    let rows = await db
      .select()
      .from(publicInviteTemplatesTable)
      .where(eq(publicInviteTemplatesTable.weddingId, params.data.weddingId))
      .orderBy(asc(publicInviteTemplatesTable.name));

    if (rows.length === 0) {
      await db.insert(publicInviteTemplatesTable).values({
        weddingId: params.data.weddingId,
        name: "Página padrão",
        isDefault: true,
        config: {},
      });
      rows = await db
        .select()
        .from(publicInviteTemplatesTable)
        .where(eq(publicInviteTemplatesTable.weddingId, params.data.weddingId))
        .orderBy(asc(publicInviteTemplatesTable.name));
    }

    res.json(
      rows.map((r) => ({
        id: r.id,
        weddingId: r.weddingId,
        name: r.name,
        isDefault: r.isDefault,
        config: r.config,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  },
);

router.post(
  "/weddings/:weddingId/public-invite-templates",
  authMiddleware,
  requireWeddingRole("planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const params = WeddingId.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = CreateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const weddingId = params.data.weddingId;
    const config = parsed.data.config ?? {};

    if (parsed.data.isDefault) {
      await db
        .update(publicInviteTemplatesTable)
        .set({ isDefault: false })
        .where(eq(publicInviteTemplatesTable.weddingId, weddingId));
    }

    const [row] = await db
      .insert(publicInviteTemplatesTable)
      .values({
        weddingId,
        name: parsed.data.name,
        isDefault: parsed.data.isDefault ?? false,
        config,
      })
      .returning();

    if (!row) {
      res.status(500).json({ error: "Falha ao criar modelo." });
      return;
    }

    res.status(201).json({
      id: row.id,
      weddingId: row.weddingId,
      name: row.name,
      isDefault: row.isDefault,
      config: row.config,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

router.patch(
  "/weddings/:weddingId/public-invite-templates/:id",
  authMiddleware,
  requireWeddingRole("planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const params = IdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = PatchBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existing] = await db
      .select()
      .from(publicInviteTemplatesTable)
      .where(
        and(
          eq(publicInviteTemplatesTable.id, params.data.id),
          eq(publicInviteTemplatesTable.weddingId, params.data.weddingId),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Modelo não encontrado" });
      return;
    }

    if (parsed.data.isDefault === true) {
      await db
        .update(publicInviteTemplatesTable)
        .set({ isDefault: false })
        .where(eq(publicInviteTemplatesTable.weddingId, params.data.weddingId));
    }

    const [row] = await db
      .update(publicInviteTemplatesTable)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
        ...(parsed.data.config !== undefined ? { config: parsed.data.config } : {}),
      })
      .where(
        and(
          eq(publicInviteTemplatesTable.id, params.data.id),
          eq(publicInviteTemplatesTable.weddingId, params.data.weddingId),
        ),
      )
      .returning();

    if (!row) {
      res.status(404).json({ error: "Modelo não encontrado" });
      return;
    }

    res.json({
      id: row.id,
      weddingId: row.weddingId,
      name: row.name,
      isDefault: row.isDefault,
      config: row.config,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  },
);

router.delete(
  "/weddings/:weddingId/public-invite-templates/:id",
  authMiddleware,
  requireWeddingRole("planner", "coordinator", "couple"),
  async (req, res): Promise<void> => {
    const params = IdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const result = await db
      .delete(publicInviteTemplatesTable)
      .where(
        and(
          eq(publicInviteTemplatesTable.id, params.data.id),
          eq(publicInviteTemplatesTable.weddingId, params.data.weddingId),
        ),
      )
      .returning({ id: publicInviteTemplatesTable.id });

    if (result.length === 0) {
      res.status(404).json({ error: "Modelo não encontrado" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
