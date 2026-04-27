import {
  pgTable,
  pgEnum,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weddingsTable } from "./weddings";

export const whatsappProviderEnum = pgEnum("whatsapp_provider", [
  "evolution",
  "meta_cloud",
]);

export const whatsappOwnerKindEnum = pgEnum("whatsapp_owner_kind", [
  "bride",
  "groom",
  "event",
]);

export const whatsappConnectionStatusEnum = pgEnum("whatsapp_connection_status", [
  "pending",
  "qr",
  "connected",
  "disconnected",
  "error",
]);

export const whatsappConnectionsTable = pgTable(
  "whatsapp_connections",
  {
    id: serial("id").primaryKey(),
    weddingId: integer("wedding_id")
      .notNull()
      .references(() => weddingsTable.id, { onDelete: "cascade" }),
    provider: whatsappProviderEnum("provider").notNull().default("evolution"),
    ownerKind: whatsappOwnerKindEnum("owner_kind").notNull(),
    label: varchar("label", { length: 120 }),
    phoneNumber: varchar("phone_number", { length: 32 }),
    status: whatsappConnectionStatusEnum("status").notNull().default("pending"),

    evolutionInstanceName: varchar("evolution_instance_name", { length: 120 }),
    evolutionIntegration: varchar("evolution_integration", { length: 40 }).default(
      "WHATSAPP-BAILEYS",
    ),
    evolutionInstanceApiKey: text("evolution_instance_api_key"),
    evolutionInstanceId: varchar("evolution_instance_id", { length: 120 }),

    metaPhoneNumberId: varchar("meta_phone_number_id", { length: 64 }),
    metaWabaId: varchar("meta_waba_id", { length: 64 }),
    metaAccessToken: text("meta_access_token"),

    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("whatsapp_conn_wedding_instance_unique").on(
      t.weddingId,
      t.evolutionInstanceName,
    ),
  ],
);

export const insertWhatsappConnectionSchema = createInsertSchema(
  whatsappConnectionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertWhatsappConnection = z.infer<typeof insertWhatsappConnectionSchema>;
export type WhatsappConnection = typeof whatsappConnectionsTable.$inferSelect;

export type WhatsappProvider = (typeof whatsappProviderEnum.enumValues)[number];
export type WhatsappOwnerKind = (typeof whatsappOwnerKindEnum.enumValues)[number];
export type WhatsappConnectionStatus =
  (typeof whatsappConnectionStatusEnum.enumValues)[number];
