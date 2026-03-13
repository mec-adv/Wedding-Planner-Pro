import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, scheduleItemsTable } from "@workspace/db";
import {
  ListScheduleItemsParams,
  CreateScheduleItemParams,
  CreateScheduleItemBody,
  UpdateScheduleItemParams,
  UpdateScheduleItemBody,
  DeleteScheduleItemParams,
} from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/schedule", authMiddleware, async (req, res): Promise<void> => {
  const params = ListScheduleItemsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const items = await db.select().from(scheduleItemsTable)
    .where(eq(scheduleItemsTable.weddingId, params.data.weddingId))
    .orderBy(scheduleItemsTable.sortOrder);
  res.json(items.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })));
});

router.post("/weddings/:weddingId/schedule", authMiddleware, async (req, res): Promise<void> => {
  const params = CreateScheduleItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateScheduleItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.insert(scheduleItemsTable).values({
    title: parsed.data.title || "Novo Item",
    startTime: parsed.data.startTime || "00:00",
    endTime: parsed.data.endTime,
    description: parsed.data.description,
    location: parsed.data.location,
    responsible: parsed.data.responsible,
    sortOrder: parsed.data.sortOrder,
    weddingId: params.data.weddingId,
  }).returning();
  res.status(201).json({ ...item, createdAt: item.createdAt.toISOString() });
});

router.patch("/weddings/:weddingId/schedule/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = UpdateScheduleItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateScheduleItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [item] = await db.update(scheduleItemsTable).set(parsed.data)
    .where(and(eq(scheduleItemsTable.id, params.data.id), eq(scheduleItemsTable.weddingId, params.data.weddingId))).returning();
  if (!item) { res.status(404).json({ error: "Item da programação não encontrado" }); return; }

  res.json({ ...item, createdAt: item.createdAt.toISOString() });
});

router.delete("/weddings/:weddingId/schedule/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = DeleteScheduleItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(scheduleItemsTable)
    .where(and(eq(scheduleItemsTable.id, params.data.id), eq(scheduleItemsTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

export default router;
