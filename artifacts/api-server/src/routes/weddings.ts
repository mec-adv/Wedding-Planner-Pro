import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, weddingsTable } from "@workspace/db";
import {
  CreateWeddingBody,
  GetWeddingParams,
  UpdateWeddingParams,
  UpdateWeddingBody,
  DeleteWeddingParams,
} from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings", authMiddleware, async (req, res): Promise<void> => {
  const userId = (req as any).userId;
  const weddings = await db.select().from(weddingsTable).where(eq(weddingsTable.createdById, userId));
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

  const userId = (req as any).userId;
  const [wedding] = await db.insert(weddingsTable).values({
    ...parsed.data,
    date: parsed.data.date || new Date(),
    createdById: userId,
  }).returning();

  res.status(201).json({
    ...wedding,
    date: wedding.date.toISOString(),
    createdAt: wedding.createdAt.toISOString(),
  });
});

router.get("/weddings/:id", authMiddleware, async (req, res): Promise<void> => {
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

router.patch("/weddings/:id", authMiddleware, async (req, res): Promise<void> => {
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

  const updateData: any = { ...parsed.data };

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

router.delete("/weddings/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = DeleteWeddingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(weddingsTable).where(eq(weddingsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
