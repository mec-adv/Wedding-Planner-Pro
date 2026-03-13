import { Router, type IRouter } from "express";
import { eq, or, inArray } from "drizzle-orm";
import { db, weddingsTable, profilesTable } from "@workspace/db";
import {
  CreateWeddingBody,
  GetWeddingParams,
  UpdateWeddingParams,
  UpdateWeddingBody,
  DeleteWeddingParams,
} from "@workspace/api-zod";
import { authMiddleware, verifyWeddingAccess, type AuthRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings", authMiddleware, async (req, res): Promise<void> => {
  const userId = (req as AuthRequest).userId;
  const authReq = req as AuthRequest;

  if (authReq.userRole === "admin") {
    const weddings = await db.select().from(weddingsTable);
    res.json(weddings.map(w => ({
      ...w,
      date: w.date.toISOString(),
      createdAt: w.createdAt.toISOString(),
    })));
    return;
  }

  const profiles = await db.select({ weddingId: profilesTable.weddingId })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId));
  const profileWeddingIds = profiles.map(p => p.weddingId);

  const conditions = [eq(weddingsTable.createdById, userId)];
  if (profileWeddingIds.length > 0) {
    conditions.push(inArray(weddingsTable.id, profileWeddingIds));
  }

  const weddings = await db.select().from(weddingsTable).where(or(...conditions));
  res.json(weddings.map(w => ({
    ...w,
    date: w.date.toISOString(),
    createdAt: w.createdAt.toISOString(),
  })));
});

router.post("/weddings", authMiddleware, async (req, res): Promise<void> => {
  const body = { ...req.body };
  if (typeof body.date === "string") body.date = new Date(body.date);

  const parsed = CreateWeddingBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = (req as AuthRequest).userId;
  const [wedding] = await db.insert(weddingsTable).values({
    title: parsed.data.title || "Novo Casamento",
    groomName: parsed.data.groomName || "",
    brideName: parsed.data.brideName || "",
    date: parsed.data.date || new Date(),
    venue: parsed.data.venue,
    description: parsed.data.description,
    coverImageUrl: parsed.data.coverImageUrl,
    createdById: userId,
  }).returning();

  await db.insert(profilesTable).values({
    userId,
    weddingId: wedding.id,
    role: "planner",
  });

  res.status(201).json({
    ...wedding,
    date: wedding.date.toISOString(),
    createdAt: wedding.createdAt.toISOString(),
  });
});

router.get("/weddings/:id", authMiddleware, verifyWeddingAccess, async (req, res): Promise<void> => {
  const params = GetWeddingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [wedding] = await db.select().from(weddingsTable).where(eq(weddingsTable.id, params.data.id));
  if (!wedding) {
    res.status(404).json({ error: "Casamento não encontrado" });
    return;
  }

  res.json({
    ...wedding,
    date: wedding.date.toISOString(),
    createdAt: wedding.createdAt.toISOString(),
  });
});

router.patch("/weddings/:id", authMiddleware, verifyWeddingAccess, async (req, res): Promise<void> => {
  const params = UpdateWeddingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = { ...req.body };
  if (typeof body.date === "string") body.date = new Date(body.date);

  const parsed = UpdateWeddingBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  const [wedding] = await db.update(weddingsTable).set(updateData).where(eq(weddingsTable.id, params.data.id)).returning();
  if (!wedding) {
    res.status(404).json({ error: "Casamento não encontrado" });
    return;
  }

  res.json({
    ...wedding,
    date: wedding.date.toISOString(),
    createdAt: wedding.createdAt.toISOString(),
  });
});

router.delete("/weddings/:id", authMiddleware, verifyWeddingAccess, async (req, res): Promise<void> => {
  const params = DeleteWeddingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(weddingsTable).where(eq(weddingsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
