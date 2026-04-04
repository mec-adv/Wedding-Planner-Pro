import { pgTable, text, serial, timestamp, varchar, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weddingsTable } from "./weddings";
import { guestGroupsTable } from "./guest_groups";

export const guestsTable = pgTable("guests", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id").notNull().references(() => weddingsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  guestGroupId: integer("guest_group_id").references(() => guestGroupsTable.id, { onDelete: "set null" }),
  /** Convidado pelo noivo (`groom`) ou pela noiva (`bride`); nomes vêm do cadastro do casamento */
  invitedBy: varchar("invited_by", { length: 10 }),
  rsvpStatus: varchar("rsvp_status", { length: 20 }).notNull().default("pending"),
  dietaryRestrictions: text("dietary_restrictions"),
  notes: text("notes"),
  inviteSentAt: timestamp("invite_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGuestSchema = createInsertSchema(guestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGuest = z.infer<typeof insertGuestSchema>;
export type Guest = typeof guestsTable.$inferSelect;
