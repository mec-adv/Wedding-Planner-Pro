import { pgTable, text, serial, timestamp, varchar, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weddingsTable } from "./weddings";

/** Modelos de página pública (RSVP + presentes) por casamento */
export const publicInviteTemplatesTable = pgTable("public_invite_templates", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id")
    .notNull()
    .references(() => weddingsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  /** Textos, cores, seções visíveis (JSON livre) */
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPublicInviteTemplateSchema = createInsertSchema(publicInviteTemplatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPublicInviteTemplate = z.infer<typeof insertPublicInviteTemplateSchema>;
export type PublicInviteTemplate = typeof publicInviteTemplatesTable.$inferSelect;
