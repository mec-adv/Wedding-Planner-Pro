import { pgTable, serial, timestamp, varchar, integer, smallint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { guestsTable } from "./guests";

export const guestCompanionsTable = pgTable("guest_companions", {
  id: serial("id").primaryKey(),
  guestId: integer("guest_id")
    .notNull()
    .references(() => guestsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  age: smallint("age").notNull(),
  phone: varchar("phone", { length: 30 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGuestCompanionSchema = createInsertSchema(guestCompanionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGuestCompanion = z.infer<typeof insertGuestCompanionSchema>;
export type GuestCompanion = typeof guestCompanionsTable.$inferSelect;
