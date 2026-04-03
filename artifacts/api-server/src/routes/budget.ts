import { Router, type IRouter } from "express";
import { db, budgetCategoriesTable, budgetItemsTable, eq, and } from "@workspace/db";
import {
  ListBudgetCategoriesParams,
  CreateBudgetCategoryParams,
  CreateBudgetCategoryBody,
  UpdateBudgetCategoryParams,
  UpdateBudgetCategoryBody,
  DeleteBudgetCategoryParams,
  ListBudgetItemsParams,
  ListBudgetItemsQueryParams,
  CreateBudgetItemParams,
  CreateBudgetItemBody,
  UpdateBudgetItemParams,
  UpdateBudgetItemBody,
  DeleteBudgetItemParams,
  GetBudgetSummaryParams,
} from "@workspace/api-zod";
import { authMiddleware, requireWeddingRole } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/budget-categories", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = ListBudgetCategoriesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const categories = await db.select().from(budgetCategoriesTable).where(eq(budgetCategoriesTable.weddingId, params.data.weddingId));
  res.json(categories.map(c => ({ ...c, estimatedTotal: Number(c.estimatedTotal), createdAt: c.createdAt.toISOString() })));
});

router.post("/weddings/:weddingId/budget-categories", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = CreateBudgetCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateBudgetCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [cat] = await db.insert(budgetCategoriesTable).values({
    name: parsed.data.name || "Nova Categoria",
    estimatedTotal: String(parsed.data.estimatedTotal ?? 0),
    weddingId: params.data.weddingId,
  }).returning();
  res.status(201).json({ ...cat, estimatedTotal: Number(cat.estimatedTotal), createdAt: cat.createdAt.toISOString() });
});

router.patch("/weddings/:weddingId/budget-categories/:id", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = UpdateBudgetCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateBudgetCategoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (updateData.estimatedTotal !== undefined) updateData.estimatedTotal = String(updateData.estimatedTotal);

  const [cat] = await db.update(budgetCategoriesTable).set(updateData)
    .where(and(eq(budgetCategoriesTable.id, params.data.id), eq(budgetCategoriesTable.weddingId, params.data.weddingId))).returning();
  if (!cat) { res.status(404).json({ error: "Categoria não encontrada" }); return; }
  res.json({ ...cat, estimatedTotal: Number(cat.estimatedTotal), createdAt: cat.createdAt.toISOString() });
});

router.delete("/weddings/:weddingId/budget-categories/:id", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = DeleteBudgetCategoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(budgetCategoriesTable).where(and(eq(budgetCategoriesTable.id, params.data.id), eq(budgetCategoriesTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

router.get("/weddings/:weddingId/budget-items", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = ListBudgetItemsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const query = ListBudgetItemsQueryParams.safeParse(req.query);

  const conditions = [eq(budgetItemsTable.weddingId, params.data.weddingId)];
  if (query.success && query.data.categoryId) {
    conditions.push(eq(budgetItemsTable.categoryId, query.data.categoryId));
  }

  const items = await db.select().from(budgetItemsTable).where(and(...conditions));
  res.json(items.map(i => ({
    ...i,
    estimatedCost: Number(i.estimatedCost),
    actualCost: i.actualCost ? Number(i.actualCost) : null,
    createdAt: i.createdAt.toISOString(),
  })));
});

router.post("/weddings/:weddingId/budget-items", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = CreateBudgetItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateBudgetItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const insertData: Record<string, unknown> = { ...parsed.data, weddingId: params.data.weddingId };
  insertData.estimatedCost = String(insertData.estimatedCost);
  if (insertData.actualCost !== undefined && insertData.actualCost !== null) insertData.actualCost = String(insertData.actualCost);

  const [item] = await db.insert(budgetItemsTable).values(insertData as typeof budgetItemsTable.$inferInsert).returning();
  res.status(201).json({
    ...item,
    estimatedCost: Number(item.estimatedCost),
    actualCost: item.actualCost ? Number(item.actualCost) : null,
    createdAt: item.createdAt.toISOString(),
  });
});

router.patch("/weddings/:weddingId/budget-items/:id", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = UpdateBudgetItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateBudgetItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (updateData.estimatedCost !== undefined) updateData.estimatedCost = String(updateData.estimatedCost);
  if (updateData.actualCost !== undefined && updateData.actualCost !== null) updateData.actualCost = String(updateData.actualCost);

  const [item] = await db.update(budgetItemsTable).set(updateData)
    .where(and(eq(budgetItemsTable.id, params.data.id), eq(budgetItemsTable.weddingId, params.data.weddingId))).returning();
  if (!item) { res.status(404).json({ error: "Item não encontrado" }); return; }
  res.json({
    ...item,
    estimatedCost: Number(item.estimatedCost),
    actualCost: item.actualCost ? Number(item.actualCost) : null,
    createdAt: item.createdAt.toISOString(),
  });
});

router.delete("/weddings/:weddingId/budget-items/:id", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = DeleteBudgetItemParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(budgetItemsTable).where(and(eq(budgetItemsTable.id, params.data.id), eq(budgetItemsTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

router.get("/weddings/:weddingId/budget-summary", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const params = GetBudgetSummaryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const categories = await db.select().from(budgetCategoriesTable).where(eq(budgetCategoriesTable.weddingId, params.data.weddingId));
  const items = await db.select().from(budgetItemsTable).where(eq(budgetItemsTable.weddingId, params.data.weddingId));

  const totalEstimated = items.reduce((s, i) => s + Number(i.estimatedCost), 0);
  const totalActual = items.reduce((s, i) => s + (i.actualCost ? Number(i.actualCost) : 0), 0);
  const totalPaid = items.filter(i => i.isPaid).reduce((s, i) => s + (i.actualCost ? Number(i.actualCost) : Number(i.estimatedCost)), 0);

  const byCategory = categories.map(cat => {
    const catItems = items.filter(i => i.categoryId === cat.id);
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      estimated: catItems.reduce((s, i) => s + Number(i.estimatedCost), 0),
      actual: catItems.reduce((s, i) => s + (i.actualCost ? Number(i.actualCost) : 0), 0),
      paid: catItems.filter(i => i.isPaid).reduce((s, i) => s + (i.actualCost ? Number(i.actualCost) : Number(i.estimatedCost)), 0),
    };
  });

  res.json({ totalEstimated, totalActual, totalPaid, totalRemaining: totalEstimated - totalPaid, byCategory });
});

export default router;
