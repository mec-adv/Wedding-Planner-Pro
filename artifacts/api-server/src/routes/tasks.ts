import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tasksTable } from "@workspace/db";
import {
  ListTasksParams,
  ListTasksQueryParams,
  CreateTaskParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { authMiddleware, requireWeddingRole } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/tasks", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = ListTasksParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = ListTasksQueryParams.safeParse(req.query);

  const conditions = [eq(tasksTable.weddingId, params.data.weddingId)];
  if (query.success && query.data.status) {
    conditions.push(eq(tasksTable.status, query.data.status));
  }

  const tasks = await db.select().from(tasksTable).where(and(...conditions));
  res.json(tasks.map(t => ({
    ...t,
    dueDate: t.dueDate?.toISOString() || null,
    createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/weddings/:weddingId/tasks", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = CreateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = { ...req.body };
  if (typeof body.dueDate === "string") body.dueDate = new Date(body.dueDate);

  const parsed = CreateTaskBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const insertData = { ...parsed.data, weddingId: params.data.weddingId };

  const [task] = await db.insert(tasksTable).values(insertData as typeof tasksTable.$inferInsert).returning();
  res.status(201).json({
    ...task,
    dueDate: task.dueDate?.toISOString() || null,
    createdAt: task.createdAt.toISOString(),
  });
});

router.patch("/weddings/:weddingId/tasks/:id", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = { ...req.body };
  if (typeof body.dueDate === "string") body.dueDate = new Date(body.dueDate);

  const parsed = UpdateTaskBody.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db.update(tasksTable).set(parsed.data)
    .where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.weddingId, params.data.weddingId))).returning();
  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada" });
    return;
  }

  res.json({
    ...task,
    dueDate: task.dueDate?.toISOString() || null,
    createdAt: task.createdAt.toISOString(),
  });
});

router.delete("/weddings/:weddingId/tasks/:id", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(tasksTable).where(and(eq(tasksTable.id, params.data.id), eq(tasksTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

export default router;
