import { pgTable, serial, timestamp, varchar, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weddingsTable } from "./weddings";
import { guestsTable } from "./guests";

export const seatingTablesTable = pgTable("seating_tables", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id").notNull().references(() => weddingsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  capacity: integer("capacity").notNull().default(8),
  positionX: numeric("position_x", { precision: 10, scale: 2 }).notNull().default("0"),
  positionY: numeric("position_y", { precision: 10, scale: 2 }).notNull().default("0"),
  shape: varchar("shape", { length: 20 }).notNull().default("round"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSeatingTableSchema = createInsertSchema(seatingTablesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSeatingTable = z.infer<typeof insertSeatingTableSchema>;
export type SeatingTable = typeof seatingTablesTable.$inferSelect;

export const seatAssignmentsTable = pgTable("seat_assignments", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id").notNull().references(() => weddingsTable.id, { onDelete: "cascade" }),
  tableId: integer("table_id").notNull().references(() => seatingTablesTable.id, { onDelete: "cascade" }),
  guestId: integer("guest_id").notNull().references(() => guestsTable.id, { onDelete: "cascade" }),
  seatNumber: integer("seat_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSeatAssignmentSchema = createInsertSchema(seatAssignmentsTable).omit({ id: true, createdAt: true });
export type InsertSeatAssignment = z.infer<typeof insertSeatAssignmentSchema>;
export type SeatAssignment = typeof seatAssignmentsTable.$inferSelect;
