import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, coordinatorsTable } from "@workspace/db";
import {
  ListCoordinatorsParams,
  CreateCoordinatorParams,
  CreateCoordinatorBody,
  UpdateCoordinatorParams,
  UpdateCoordinatorBody,
  DeleteCoordinatorParams,
} from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/coordinators", authMiddleware, async (req, res): Promise<void> => {
  const params = ListCoordinatorsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const coordinators = await db.select().from(coordinatorsTable).where(eq(coordinatorsTable.weddingId, params.data.weddingId));
  res.json(coordinators.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/weddings/:weddingId/coordinators", authMiddleware, async (req, res): Promise<void> => {
  const params = CreateCoordinatorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateCoordinatorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [coordinator] = await db.insert(coordinatorsTable).values({ ...parsed.data, weddingId: params.data.weddingId }).returning();
  res.status(201).json({ ...coordinator, createdAt: coordinator.createdAt.toISOString() });
});

router.patch("/weddings/:weddingId/coordinators/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = UpdateCoordinatorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCoordinatorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [coordinator] = await db.update(coordinatorsTable).set(parsed.data)
    .where(and(eq(coordinatorsTable.id, params.data.id), eq(coordinatorsTable.weddingId, params.data.weddingId))).returning();
  if (!coordinator) { res.status(404).json({ error: "Coordenador não encontrado" }); return; }

  res.json({ ...coordinator, createdAt: coordinator.createdAt.toISOString() });
});

router.delete("/weddings/:weddingId/coordinators/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = DeleteCoordinatorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(coordinatorsTable).where(and(eq(coordinatorsTable.id, params.data.id), eq(coordinatorsTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

export default router;
