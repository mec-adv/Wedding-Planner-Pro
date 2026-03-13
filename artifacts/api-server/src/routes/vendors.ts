import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, vendorsTable } from "@workspace/db";
import {
  ListVendorsParams,
  CreateVendorParams,
  CreateVendorBody,
  UpdateVendorParams,
  UpdateVendorBody,
  DeleteVendorParams,
} from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/vendors", authMiddleware, async (req, res): Promise<void> => {
  const params = ListVendorsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const vendors = await db.select().from(vendorsTable).where(eq(vendorsTable.weddingId, params.data.weddingId));
  res.json(vendors.map(v => ({ ...v, price: v.price ? Number(v.price) : null, createdAt: v.createdAt.toISOString() })));
});

router.post("/weddings/:weddingId/vendors", authMiddleware, async (req, res): Promise<void> => {
  const params = CreateVendorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateVendorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const insertData: any = { ...parsed.data, weddingId: params.data.weddingId };
  if (insertData.price !== undefined && insertData.price !== null) insertData.price = String(insertData.price);

  const [vendor] = await db.insert(vendorsTable).values(insertData).returning();
  res.status(201).json({ ...vendor, price: vendor.price ? Number(vendor.price) : null, createdAt: vendor.createdAt.toISOString() });
});

router.patch("/weddings/:weddingId/vendors/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = UpdateVendorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateVendorBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: any = { ...parsed.data };
  if (updateData.price !== undefined && updateData.price !== null) updateData.price = String(updateData.price);

  const [vendor] = await db.update(vendorsTable).set(updateData)
    .where(and(eq(vendorsTable.id, params.data.id), eq(vendorsTable.weddingId, params.data.weddingId))).returning();
  if (!vendor) { res.status(404).json({ error: "Fornecedor não encontrado" }); return; }

  res.json({ ...vendor, price: vendor.price ? Number(vendor.price) : null, createdAt: vendor.createdAt.toISOString() });
});

router.delete("/weddings/:weddingId/vendors/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = DeleteVendorParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  await db.delete(vendorsTable).where(and(eq(vendorsTable.id, params.data.id), eq(vendorsTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

export default router;
