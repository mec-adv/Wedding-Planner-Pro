import { pgTable, text, serial, timestamp, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const weddingsTable = pgTable("weddings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  groomName: varchar("groom_name", { length: 255 }).notNull(),
  brideName: varchar("bride_name", { length: 255 }).notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  venue: text("venue"),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWeddingSchema = createInsertSchema(weddingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWedding = z.infer<typeof insertWeddingSchema>;
export type Wedding = typeof weddingsTable.$inferSelect;
