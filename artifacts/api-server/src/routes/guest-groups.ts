import { Router, type IRouter } from "express";
import { db, guestGroupsTable, eq, and, asc } from "@workspace/db";
import { ListGuestGroupsParams, CreateGuestGroupParams, CreateGuestGroupBody } from "@workspace/api-zod";
import { authMiddleware, requireWeddingRole } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/guest-groups", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = ListGuestGroupsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const wid = params.data.weddingId;
  let rows = await db
    .select()
    .from(guestGroupsTable)
    .where(eq(guestGroupsTable.weddingId, wid))
    .orderBy(asc(guestGroupsTable.name));

  if (rows.length === 0) {
    await db
      .insert(guestGroupsTable)
      .values([
        { weddingId: wid, name: "Colegas" },
        { weddingId: wid, name: "Trabalho" },
        { weddingId: wid, name: "Família" },
      ])
      .onConflictDoNothing();
    rows = await db
      .select()
      .from(guestGroupsTable)
      .where(eq(guestGroupsTable.weddingId, wid))
      .orderBy(asc(guestGroupsTable.name));
  }

  res.json(
    rows.map((g) => ({
      id: g.id,
      weddingId: g.weddingId,
      name: g.name,
      createdAt: g.createdAt.toISOString(),
    })),
  );
});

router.post("/weddings/:weddingId/guest-groups", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = CreateGuestGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateGuestGroupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Informe o nome do grupo." });
    return;
  }

  try {
    const [created] = await db
      .insert(guestGroupsTable)
      .values({ weddingId: params.data.weddingId, name })
      .returning();
    if (!created) {
      res.status(500).json({ error: "Falha ao criar grupo." });
      return;
    }
    res.status(201).json({
      id: created.id,
      weddingId: created.weddingId,
      name: created.name,
      createdAt: created.createdAt.toISOString(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("guest_groups_wedding_id_name_unique") || msg.includes("duplicate key")) {
      res.status(409).json({ error: "Já existe um grupo com esse nome neste casamento." });
      return;
    }
    throw e;
  }
});

export default router;
