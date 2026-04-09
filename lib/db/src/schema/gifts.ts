import { pgTable, text, serial, timestamp, varchar, integer, boolean, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weddingsTable } from "./weddings";
import { guestsTable } from "./guests";

export const giftsTable = pgTable("gifts", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id").notNull().references(() => weddingsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  humorTag: text("humor_tag"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGiftSchema = createInsertSchema(giftsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGift = z.infer<typeof insertGiftSchema>;
export type Gift = typeof giftsTable.$inferSelect;

export const giftOrdersTable = pgTable("gift_orders", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id").notNull().references(() => weddingsTable.id, { onDelete: "cascade" }),
  giftId: integer("gift_id").notNull().references(() => giftsTable.id),
  /** Quando a compra vem da página pública com token válido */
  guestId: integer("guest_id").references(() => guestsTable.id, { onDelete: "set null" }),
  guestName: varchar("guest_name", { length: 255 }).notNull(),
  guestEmail: varchar("guest_email", { length: 255 }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("pending"),
  withdrawalStatus: varchar("withdrawal_status", { length: 20 }).notNull().default("pending"),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  asaasPaymentId: text("asaas_payment_id"),
  idempotencyKey: varchar("idempotency_key", { length: 128 }),
  coupleMessage: text("couple_message"),
  coupleMessageStatus: varchar("couple_message_status", { length: 20 }).notNull().default("pending"),
  coupleMessageProcessedAt: timestamp("couple_message_processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGiftOrderSchema = createInsertSchema(giftOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGiftOrder = z.infer<typeof insertGiftOrderSchema>;
export type GiftOrder = typeof giftOrdersTable.$inferSelect;
