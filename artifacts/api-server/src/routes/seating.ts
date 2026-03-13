import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, seatingTablesTable, seatAssignmentsTable, guestsTable } from "@workspace/db";
import {
  ListTablesParams,
  CreateTableParams,
  CreateTableBody,
  UpdateTableParams,
  UpdateTableBody,
  DeleteTableParams,
  ListSeatAssignmentsParams,
  AssignSeatParams,
  AssignSeatBody,
  RemoveSeatAssignmentParams,
} from "@workspace/api-zod";
import { authMiddleware, requireWeddingRole } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/tables", authMiddleware, async (req, res): Promise<void> => {
  const params = ListTablesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const tables = await db.select().from(seatingTablesTable).where(eq(seatingTablesTable.weddingId, params.data.weddingId));
  res.json(tables.map(t => ({
    ...t,
    positionX: Number(t.positionX),
    positionY: Number(t.positionY),
    createdAt: t.createdAt.toISOString(),
  })));
});

router.post("/weddings/:weddingId/tables", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = CreateTableParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateTableBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [table] = await db.insert(seatingTablesTable).values({
    name: parsed.data.name || "Nova Mesa",
    capacity: parsed.data.capacity,
    shape: parsed.data.shape,
    positionX: String(parsed.data.positionX ?? 0),
    positionY: String(parsed.data.positionY ?? 0),
    weddingId: params.data.weddingId,
  }).returning();

  res.status(201).json({
    ...table,
    positionX: Number(table.positionX),
    positionY: Number(table.positionY),
    createdAt: table.createdAt.toISOString(),
  });
});

router.patch("/weddings/:weddingId/tables/:id", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = UpdateTableParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTableBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (updateData.positionX !== undefined) updateData.positionX = String(updateData.positionX);
  if (updateData.positionY !== undefined) updateData.positionY = String(updateData.positionY);

  const [table] = await db.update(seatingTablesTable).set(updateData)
    .where(and(eq(seatingTablesTable.id, params.data.id), eq(seatingTablesTable.weddingId, params.data.weddingId))).returning();
  if (!table) { res.status(404).json({ error: "Mesa não encontrada" }); return; }

  res.json({
    ...table,
    positionX: Number(table.positionX),
    positionY: Number(table.positionY),
    createdAt: table.createdAt.toISOString(),
  });
});

router.delete("/weddings/:weddingId/tables/:id", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = DeleteTableParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(seatingTablesTable).where(and(eq(seatingTablesTable.id, params.data.id), eq(seatingTablesTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

router.get("/weddings/:weddingId/seat-assignments", authMiddleware, async (req, res): Promise<void> => {
  const params = ListSeatAssignmentsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const assignments = await db.select({
    assignment: seatAssignmentsTable,
    guestName: guestsTable.name,
    tableName: seatingTablesTable.name,
  }).from(seatAssignmentsTable)
    .leftJoin(guestsTable, eq(seatAssignmentsTable.guestId, guestsTable.id))
    .leftJoin(seatingTablesTable, eq(seatAssignmentsTable.tableId, seatingTablesTable.id))
    .where(eq(seatAssignmentsTable.weddingId, params.data.weddingId));

  res.json(assignments.map(a => ({
    ...a.assignment,
    guestName: a.guestName,
    tableName: a.tableName,
    createdAt: a.assignment.createdAt.toISOString(),
  })));
});

router.post("/weddings/:weddingId/seat-assignments", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = AssignSeatParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = AssignSeatBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const existing = await db.select().from(seatAssignmentsTable)
    .where(and(eq(seatAssignmentsTable.guestId, parsed.data.guestId), eq(seatAssignmentsTable.weddingId, params.data.weddingId)));
  if (existing.length > 0) {
    await db.delete(seatAssignmentsTable).where(eq(seatAssignmentsTable.id, existing[0].id));
  }

  const [assignment] = await db.insert(seatAssignmentsTable).values({
    ...parsed.data,
    weddingId: params.data.weddingId,
  }).returning();

  res.status(201).json({
    ...assignment,
    guestName: null,
    tableName: null,
    createdAt: assignment.createdAt.toISOString(),
  });
});

router.delete("/weddings/:weddingId/seat-assignments/:id", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = RemoveSeatAssignmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(seatAssignmentsTable).where(and(eq(seatAssignmentsTable.id, params.data.id), eq(seatAssignmentsTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

export default router;
