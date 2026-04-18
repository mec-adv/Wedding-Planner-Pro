import { pgTable, serial, integer, varchar, boolean, timestamp, smallint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weddingsTable } from "./weddings";

export const giftCategoriesTable = pgTable("gift_categories", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id").notNull().references(() => weddingsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGiftCategorySchema = createInsertSchema(giftCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGiftCategory = z.infer<typeof insertGiftCategorySchema>;
export type GiftCategory = typeof giftCategoriesTable.$inferSelect;
