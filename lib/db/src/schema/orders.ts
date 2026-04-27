import {
  pgTable, pgEnum, serial, integer, varchar, text,
  numeric, smallint, timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weddingsTable } from "./weddings";
import { guestsTable } from "./guests";
import { guestCompanionsTable } from "./guest_companions";
import { usersTable } from "./users";
import { giftsTable } from "./gifts";

export const orderStatusEnum = pgEnum("order_status", [
  "pending", "paid", "failed", "expired", "refunded", "cancelled",
]);

export const orderPaymentMethodEnum = pgEnum("order_payment_method", [
  "pix", "credit_card",
]);

export const muralSourceEnum = pgEnum("mural_source", [
  "checkout", "public_page",
]);

// ---------------------------------------------------------------------------
// orders
// ---------------------------------------------------------------------------
export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id").notNull().references(() => weddingsTable.id, { onDelete: "cascade" }),
  guestId: integer("guest_id").references(() => guestsTable.id, { onDelete: "set null" }),
  companionId: integer("companion_id").references(() => guestCompanionsTable.id, { onDelete: "set null" }),
  buyerName: varchar("buyer_name", { length: 255 }).notNull(),
  /** Telefone informado no checkout (quem pagou; pode diferir do convidado dono do link). */
  buyerPhone: varchar("buyer_phone", { length: 50 }),
  status: orderStatusEnum("status").notNull().default("pending"),
  paymentMethod: orderPaymentMethodEnum("payment_method").notNull(),
  installments: smallint("installments").notNull().default(1),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  gatewayPaymentId: varchar("gateway_payment_id", { length: 255 }),
  gatewayStatus: varchar("gateway_status", { length: 50 }),
  paymentGateway: varchar("payment_gateway", { length: 30 }).default("asaas"),
  idempotencyKey: varchar("idempotency_key", { length: 128 }),
  muralMessage: text("mural_message"),
  whatsappSentAt: timestamp("whatsapp_sent_at", { withTimezone: true }),
  emailSentAt: timestamp("email_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: integer("cancelled_by").references(() => usersTable.id, { onDelete: "set null" }),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

// ---------------------------------------------------------------------------
// order_items
// ---------------------------------------------------------------------------
export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  giftId: integer("gift_id").references(() => giftsTable.id, { onDelete: "set null" }),
  giftNameSnapshot: varchar("gift_name_snapshot", { length: 255 }).notNull(),
  unitPriceSnapshot: numeric("unit_price_snapshot", { precision: 10, scale: 2 }).notNull(),
  quantity: smallint("quantity").notNull().default(1),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({ id: true });
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItemsTable.$inferSelect;

// ---------------------------------------------------------------------------
// mural_messages
// ---------------------------------------------------------------------------
export const muralMessagesTable = pgTable("mural_messages", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id").notNull().references(() => weddingsTable.id, { onDelete: "cascade" }),
  guestId: integer("guest_id").references(() => guestsTable.id, { onDelete: "set null" }),
  authorName: varchar("author_name", { length: 255 }).notNull(),
  message: text("message").notNull(),
  source: muralSourceEnum("source").notNull(),
  orderId: integer("order_id").references(() => ordersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMuralMessageSchema = createInsertSchema(muralMessagesTable).omit({ id: true, createdAt: true });
export type InsertMuralMessage = z.infer<typeof insertMuralMessageSchema>;
export type MuralMessage = typeof muralMessagesTable.$inferSelect;

// ---------------------------------------------------------------------------
// order_transitions (audit log de ciclo de vida do pedido)
// ---------------------------------------------------------------------------
export const orderTransitionsTable = pgTable("order_transitions", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => ordersTable.id, { onDelete: "cascade" }),
  fromStatus: varchar("from_status", { length: 20 }),
  toStatus: varchar("to_status", { length: 20 }).notNull(),
  gatewayEvent: varchar("gateway_event", { length: 100 }),
  actor: varchar("actor", { length: 50 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOrderTransitionSchema = createInsertSchema(orderTransitionsTable).omit({ id: true, createdAt: true });
export type InsertOrderTransition = z.infer<typeof insertOrderTransitionSchema>;
export type OrderTransition = typeof orderTransitionsTable.$inferSelect;
