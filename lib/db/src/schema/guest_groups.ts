import { pgTable, serial, integer, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weddingsTable } from "./weddings";

export const guestGroupsTable = pgTable(
  "guest_groups",
  {
    id: serial("id").primaryKey(),
    weddingId: integer("wedding_id")
      .notNull()
      .references(() => weddingsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [unique("guest_groups_wedding_id_name_unique").on(table.weddingId, table.name)],
);

export const insertGuestGroupSchema = createInsertSchema(guestGroupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGuestGroup = z.infer<typeof insertGuestGroupSchema>;
export type GuestGroup = typeof guestGroupsTable.$inferSelect;
