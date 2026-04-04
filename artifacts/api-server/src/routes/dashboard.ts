import { Router, type IRouter } from "express";
import { db, guestsTable, tasksTable, budgetItemsTable, giftOrdersTable, messagesTable, eq, pool } from "@workspace/db";
import { weddingRowFromPg } from "../lib/wedding-pg";
import { GetDashboardParams } from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

/** Evita 500 se o driver devolver timestamp como string ou valor inválido */
function timeMs(d: Date | string | null | undefined): number | null {
  if (d == null) return null;
  const t = d instanceof Date ? d : new Date(d);
  const ms = t.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function toISOStringSafe(d: Date | string | null | undefined): string {
  const ms = timeMs(d);
  return ms == null ? new Date(0).toISOString() : new Date(ms).toISOString();
}

router.get("/weddings/:weddingId/dashboard", authMiddleware, async (req, res): Promise<void> => {
  try {
    const params = GetDashboardParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const wRes = await pool.query(`SELECT * FROM weddings WHERE id = $1`, [params.data.weddingId]);
    const wRow = wRes.rows[0] as Record<string, unknown> | undefined;
    if (!wRow) {
      res.status(404).json({ error: "Casamento não encontrado" });
      return;
    }
    const wedding = weddingRowFromPg(wRow);

    const guests = await db.select().from(guestsTable).where(eq(guestsTable.weddingId, params.data.weddingId));
    const tasks = await db.select().from(tasksTable).where(eq(tasksTable.weddingId, params.data.weddingId));
    const budgetItems = await db.select().from(budgetItemsTable).where(eq(budgetItemsTable.weddingId, params.data.weddingId));
    const orders = await db.select().from(giftOrdersTable).where(eq(giftOrdersTable.weddingId, params.data.weddingId));
    const messages = await db.select().from(messagesTable).where(eq(messagesTable.weddingId, params.data.weddingId));

    const now = new Date();
    const nowMs = now.getTime();
    const countdownMs = timeMs(wedding.religiousCeremonyAt) ?? timeMs(wedding.date) ?? nowMs;
    const daysUntilWedding = Math.ceil((countdownMs - nowMs) / (1000 * 60 * 60 * 24));

    const overdueTasks = tasks.filter((t) => {
      const due = timeMs(t.dueDate);
      return (
        due != null &&
        due < nowMs &&
        t.status !== "completed" &&
        t.status !== "cancelled"
      );
    });
    const upcomingTasks = tasks
      .filter((t) => t.status !== "completed" && t.status !== "cancelled")
      .sort((a, b) => (timeMs(a.dueDate) ?? Infinity) - (timeMs(b.dueDate) ?? Infinity))
      .slice(0, 5);

    const recentMessages = messages
      .sort((a, b) => (timeMs(b.createdAt) ?? 0) - (timeMs(a.createdAt) ?? 0))
      .slice(0, 5);

    res.json({
      wedding: {
        ...wedding,
        date: toISOStringSafe(wedding.date),
        createdAt: toISOStringSafe(wedding.createdAt),
        updatedAt: toISOStringSafe(wedding.updatedAt),
        civilCeremonyAt: wedding.civilCeremonyAt ? toISOStringSafe(wedding.civilCeremonyAt) : null,
        religiousCeremonyAt: wedding.religiousCeremonyAt ? toISOStringSafe(wedding.religiousCeremonyAt) : null,
      },
      totalGuests: guests.length,
      confirmedGuests: guests.filter((g) => g.rsvpStatus === "confirmed").length,
      pendingGuests: guests.filter((g) => g.rsvpStatus === "pending").length,
      declinedGuests: guests.filter((g) => g.rsvpStatus === "declined").length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === "completed").length,
      overdueTasks: overdueTasks.length,
      totalBudgetEstimated: budgetItems.reduce((s, i) => s + Number(i.estimatedCost), 0),
      totalBudgetActual: budgetItems.reduce((s, i) => s + (i.actualCost ? Number(i.actualCost) : 0), 0),
      totalGiftReceived: orders
        .filter((o) => o.paymentStatus === "confirmed")
        .reduce((s, o) => s + Number(o.amount), 0),
      daysUntilWedding,
      recentMessages: recentMessages.map((m) => ({ ...m, createdAt: toISOStringSafe(m.createdAt) })),
      upcomingTasks: upcomingTasks.map((t) => ({
        ...t,
        dueDate: t.dueDate != null ? toISOStringSafe(t.dueDate) : null,
        createdAt: toISOStringSafe(t.createdAt),
        updatedAt: toISOStringSafe(t.updatedAt),
      })),
    });
  } catch (err) {
    console.error("[dashboard]", err);
    res.status(500).json({ error: "Erro ao montar o dashboard" });
  }
});

export default router;
