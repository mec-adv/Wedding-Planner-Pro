import {
  db,
  integrationSettingsTable,
  whatsappConnectionsTable,
  eq,
  and,
  sql,
} from "@workspace/db";

/**
 * Migração idempotente: para cada `integration_settings` que ainda tem
 * `evolutionInstance` preenchido e que não possui uma conexão correspondente
 * em `whatsapp_connections`, cria uma conexão padrão com `ownerKind='event'`.
 *
 * A `apikey` específica da instância não é conhecida retroativamente, então a
 * coluna fica nula e o fallback em `evolution-api.ts` usa a apikey admin até
 * que o usuário faça "reconectar" pela UI.
 */
export async function migrateLegacyWhatsappInstances(): Promise<void> {
  const legacySettings = await db
    .select()
    .from(integrationSettingsTable)
    .where(sql`${integrationSettingsTable.evolutionInstance} IS NOT NULL`);

  for (const setting of legacySettings) {
    if (!setting.evolutionInstance) continue;

    const existing = await db
      .select({ id: whatsappConnectionsTable.id })
      .from(whatsappConnectionsTable)
      .where(
        and(
          eq(whatsappConnectionsTable.weddingId, setting.weddingId),
          eq(
            whatsappConnectionsTable.evolutionInstanceName,
            setting.evolutionInstance,
          ),
        ),
      );

    if (existing.length > 0) continue;

    await db.insert(whatsappConnectionsTable).values({
      weddingId: setting.weddingId,
      provider: "evolution",
      ownerKind: "event",
      label: "Evento",
      status: "pending",
      evolutionInstanceName: setting.evolutionInstance,
      evolutionIntegration: "WHATSAPP-BAILEYS",
    });

    console.log(
      `[whatsapp-migrate] Conexão 'event' criada para wedding=${setting.weddingId} (instância='${setting.evolutionInstance}').`,
    );
  }
}
