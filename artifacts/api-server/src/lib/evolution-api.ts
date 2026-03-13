import { eq } from "drizzle-orm";
import { db, integrationSettingsTable } from "@workspace/db";

export async function sendWhatsAppMessage(weddingId: number, phone: string, message: string): Promise<void> {
  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));

  if (!settings || !settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstance) {
    throw new Error("Evolution API não configurada para este casamento");
  }

  const cleanPhone = phone.replace(/\D/g, "");

  const response = await fetch(`${settings.evolutionApiUrl}/message/sendText/${settings.evolutionInstance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: settings.evolutionApiKey,
    },
    body: JSON.stringify({
      number: cleanPhone,
      text: message,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Falha ao enviar mensagem: ${error}`);
  }
}
