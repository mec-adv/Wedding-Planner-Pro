import { Router, type IRouter } from "express";
import { eq, and, lt } from "drizzle-orm";
import { db, weddingsTable, guestsTable, tasksTable, budgetItemsTable, giftOrdersTable, messagesTable } from "@workspace/db";
import { GetDashboardParams } from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/dashboard", authMiddleware, async (req, res): Promise<void> => {
  const params = GetDashboardParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [wedding] = await db.select().from(weddingsTable).where(eq(weddingsTable.id, params.data.weddingId));
  if (!wedding) { res.status(404).json({ error: "Casamento não encontrado" }); return; }

  const guests = await db.select().from(guestsTable).where(eq(guestsTable.weddingId, params.data.weddingId));
  const tasks = await db.select().from(tasksTable).where(eq(tasksTable.weddingId, params.data.weddingId));
  const budgetItems = await db.select().from(budgetItemsTable).where(eq(budgetItemsTable.weddingId, params.data.weddingId));
  const orders = await db.select().from(giftOrdersTable).where(eq(giftOrdersTable.weddingId, params.data.weddingId));
  const messages = await db.select().from(messagesTable).where(eq(messagesTable.weddingId, params.data.weddingId));

  const now = new Date();
  const daysUntilWedding = Math.ceil((wedding.date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== "completed" && t.status !== "cancelled");
  const upcomingTasks = tasks
    .filter(t => t.status !== "completed" && t.status !== "cancelled")
    .sort((a, b) => (a.dueDate?.getTime() || Infinity) - (b.dueDate?.getTime() || Infinity))
    .slice(0, 5);

  const recentMessages = messages
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  res.json({
    wedding: { ...wedding, date: wedding.date.toISOString(), createdAt: wedding.createdAt.toISOString() },
    totalGuests: guests.length,
    confirmedGuests: guests.filter(g => g.rsvpStatus === "confirmed").length,
    pendingGuests: guests.filter(g => g.rsvpStatus === "pending").length,
    declinedGuests: guests.filter(g => g.rsvpStatus === "declined").length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === "completed").length,
    overdueTasks: overdueTasks.length,
    totalBudgetEstimated: budgetItems.reduce((s, i) => s + Number(i.estimatedCost), 0),
    totalBudgetActual: budgetItems.reduce((s, i) => s + (i.actualCost ? Number(i.actualCost) : 0), 0),
    totalGiftReceived: orders.filter(o => o.paymentStatus === "confirmed").reduce((s, o) => s + Number(o.amount), 0),
    daysUntilWedding,
    recentMessages: recentMessages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
    upcomingTasks: upcomingTasks.map(t => ({ ...t, dueDate: t.dueDate?.toISOString() || null, createdAt: t.createdAt.toISOString() })),
  });
});

export default router;
