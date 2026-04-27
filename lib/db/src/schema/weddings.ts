import { pgTable, text, serial, timestamp, varchar, integer, boolean, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/** Contato + endereço do noivo/noiva (persistido em JSON). */
export type PersonContactJson = {
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  phone?: string;
  phoneHasWhatsapp?: boolean;
  email?: string;
};

/** Local de cerimônia (nome + endereço; mapsUrl para religiosa). */
export type VenueDetailJson = {
  name?: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  mapsUrl?: string;
};

export const weddingsTable = pgTable("weddings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  groomName: varchar("groom_name", { length: 255 }).notNull(),
  brideName: varchar("bride_name", { length: 255 }).notNull(),
  /** Data de referência (ex.: a mais próxima entre civil e religiosa); mantida por compatibilidade */
  date: timestamp("date", { withTimezone: true }).notNull(),
  civilCeremonyAt: timestamp("civil_ceremony_at", { withTimezone: true }),
  religiousCeremonyAt: timestamp("religious_ceremony_at", { withTimezone: true }),
  venue: text("venue"),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  showProgressBar: boolean("show_progress_bar").notNull().default(false),
  progressGoal: numeric("progress_goal", { precision: 12, scale: 2 }),
  thankYouMessage: text("thank_you_message"),
  groomContact: jsonb("groom_contact").$type<PersonContactJson | null>(),
  brideContact: jsonb("bride_contact").$type<PersonContactJson | null>(),
  religiousVenueDetail: jsonb("religious_venue_detail").$type<VenueDetailJson | null>(),
  civilVenueDetail: jsonb("civil_venue_detail").$type<VenueDetailJson | null>(),
  createdById: integer("created_by_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWeddingSchema = createInsertSchema(weddingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWedding = z.infer<typeof insertWeddingSchema>;
export type Wedding = typeof weddingsTable.$inferSelect;
