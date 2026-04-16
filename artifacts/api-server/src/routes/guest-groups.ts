import { Router, type IRouter } from "express";
import { db, guestGroupsTable, guestsTable, eq, and, asc } from "@workspace/db";
import {
  ListGuestGroupsParams,
  CreateGuestGroupParams,
  CreateGuestGroupBody,
  UpdateGuestGroupParams,
  UpdateGuestGroupBody,
  DeleteGuestGroupParams,
} from "@workspace/api-zod";
import { authMiddleware, requireWeddingRole } from "../lib/auth";

const router: IRouter = Router();

/** Drizzle encapsula o erro do `pg` em `cause`; o código 23505 = violação de UNIQUE. */
function pgErrorTextChain(err: unknown): { code?: string; text: string } {
  const parts: string[] = [];
  let code: string | undefined;
  let cur: unknown = err;
  for (let i = 0; i < 8 && cur; i++) {
    if (typeof cur === "object" && cur !== null) {
      const o = cur as Record<string, unknown>;
      if (typeof o.code === "string") code = o.code;
      if (typeof o.message === "string") parts.push(o.message);
      if (typeof o.detail === "string") parts.push(o.detail);
      cur = o.cause;
    } else {
      break;
    }
  }
  if (parts.length === 0 && err instanceof Error) parts.push(err.message);
  return { code, text: parts.join(" ") };
}

function isGuestGroupUniqueViolation(err: unknown): boolean {
  const { code, text } = pgErrorTextChain(err);
  return (
    code === "23505" ||
    text.includes("guest_groups_wedding_id_name_unique") ||
    text.includes("duplicate key")
  );
}

router.get("/weddings/:weddingId/guest-groups", authMiddleware, requireWeddingRole("admin", "planner", "coordinator"), async (req, res): Promise<void> => {
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
      .onConflictDoNothing({ target: [guestGroupsTable.weddingId, guestGroupsTable.name] });
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

router.post("/weddings/:weddingId/guest-groups", authMiddleware, requireWeddingRole("admin", "planner", "coordinator"), async (req, res): Promise<void> => {
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

  const [existing] = await db
    .select({ id: guestGroupsTable.id })
    .from(guestGroupsTable)
    .where(and(eq(guestGroupsTable.weddingId, params.data.weddingId), eq(guestGroupsTable.name, name)))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "Já existe um grupo com o mesmo nome." });
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
    if (isGuestGroupUniqueViolation(e)) {
      res.status(409).json({ error: "Já existe um grupo com esse nome neste casamento." });
      return;
    }
    throw e;
  }
});

router.patch("/weddings/:weddingId/guest-groups/:id", authMiddleware, requireWeddingRole("admin", "planner", "coordinator"), async (req, res): Promise<void> => {
  const params = UpdateGuestGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGuestGroupBody.safeParse(req.body);
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
    const [updated] = await db
      .update(guestGroupsTable)
      .set({ name })
      .where(
        and(
          eq(guestGroupsTable.id, params.data.id),
          eq(guestGroupsTable.weddingId, params.data.weddingId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Grupo não encontrado." });
      return;
    }

    res.json({
      id: updated.id,
      weddingId: updated.weddingId,
      name: updated.name,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (e: unknown) {
    if (isGuestGroupUniqueViolation(e)) {
      res.status(409).json({ error: "Já existe um grupo com esse nome neste casamento." });
      return;
    }
    throw e;
  }
});

router.delete("/weddings/:weddingId/guest-groups/:id", authMiddleware, requireWeddingRole("admin", "planner", "coordinator"), async (req, res): Promise<void> => {
  const params = DeleteGuestGroupParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [group] = await db
    .select({ id: guestGroupsTable.id })
    .from(guestGroupsTable)
    .where(
      and(
        eq(guestGroupsTable.id, params.data.id),
        eq(guestGroupsTable.weddingId, params.data.weddingId),
      ),
    );
  if (!group) {
    res.status(404).json({ error: "Grupo não encontrado." });
    return;
  }

  const linkedGuests = await db
    .select({ id: guestsTable.id })
    .from(guestsTable)
    .where(
      and(
        eq(guestsTable.weddingId, params.data.weddingId),
        eq(guestsTable.guestGroupId, params.data.id),
      ),
    )
    .limit(1);
  if (linkedGuests.length > 0) {
    res.status(409).json({
      error: "Este grupo está vinculado a convidados. Atualize os convidados antes de excluir o grupo.",
    });
    return;
  }

  await db
    .delete(guestGroupsTable)
    .where(
      and(
        eq(guestGroupsTable.id, params.data.id),
        eq(guestGroupsTable.weddingId, params.data.weddingId),
      ),
    );

  res.sendStatus(204);
});

export default router;
