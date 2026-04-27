import { pgTable, text, serial, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { weddingsTable } from "./weddings";

export const integrationSettingsTable = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  weddingId: integer("wedding_id").notNull().references(() => weddingsTable.id, { onDelete: "cascade" }).unique(),
  evolutionApiUrl: text("evolution_api_url"),
  evolutionApiKey: text("evolution_api_key"),
  evolutionInstance: varchar("evolution_instance", { length: 255 }),
  asaasApiKey: text("asaas_api_key"),
  asaasEnvironment: varchar("asaas_environment", { length: 20 }).notNull().default("sandbox"),
  asaasWebhookToken: text("asaas_webhook_token"),
  asaasPublicKey: text("asaas_public_key"),
  activePaymentGateway: varchar("active_payment_gateway", { length: 30 }).notNull().default("asaas"),
});

export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettingsTable).omit({ id: true });
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;
export type IntegrationSettingsRecord = typeof integrationSettingsTable.$inferSelect;
