import { Router, type IRouter } from "express";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db, guestsTable, weddingsTable, messageTemplatesTable, integrationSettingsTable } from "@workspace/db";
import { authMiddleware, requireWeddingRole } from "../lib/auth";

const router: IRouter = Router();

const activeReminders = new Map<number, NodeJS.Timeout>();

router.get("/weddings/:weddingId/reminders/status", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const weddingId = Number(req.params.weddingId);
  if (isNaN(weddingId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const isActive = activeReminders.has(weddingId);

  const pendingGuests = await db.select({ count: sql<number>`count(*)` })
    .from(guestsTable)
    .where(and(
      eq(guestsTable.weddingId, weddingId),
      eq(guestsTable.rsvpStatus, "pending")
    ));

  res.json({
    active: isActive,
    pendingGuestsCount: Number(pendingGuests[0]?.count ?? 0),
  });
});

router.post("/weddings/:weddingId/reminders/start", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const weddingId = Number(req.params.weddingId);
  if (isNaN(weddingId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const { intervalHours = 24 } = req.body as { intervalHours?: number };

  if (activeReminders.has(weddingId)) {
    res.status(409).json({ error: "Lembretes já estão ativos para este casamento" });
    return;
  }

  const sendReminders = async () => {
    try {
      const pendingGuests = await db.select().from(guestsTable)
        .where(and(
          eq(guestsTable.weddingId, weddingId),
          eq(guestsTable.rsvpStatus, "pending")
        ));

      if (pendingGuests.length === 0) {
        const timeout = activeReminders.get(weddingId);
        if (timeout) clearInterval(timeout);
        activeReminders.delete(weddingId);
        return;
      }

      const settings = await db.select().from(integrationSettingsTable)
        .where(eq(integrationSettingsTable.weddingId, weddingId));
      const settingsRow = settings[0];

      if (!settingsRow?.evolutionApiUrl || !settingsRow?.evolutionApiKey || !settingsRow?.evolutionInstance) {
        return;
      }

      for (const guest of pendingGuests) {
        if (!guest.phone) continue;

        try {
          const phone = guest.phone.replace(/\D/g, "");
          await fetch(`${settingsRow.evolutionApiUrl}/message/sendText/${settingsRow.evolutionInstance}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": settingsRow.evolutionApiKey,
            },
            body: JSON.stringify({
              number: phone,
              text: `Olá ${guest.name}! 🎉 Ainda não recebemos sua confirmação de presença. Por favor, confirme sua participação no casamento. Obrigado!`,
            }),
          });
        } catch {
        }
      }
    } catch {
    }
  };

  await sendReminders();

  const interval = setInterval(sendReminders, intervalHours * 60 * 60 * 1000);
  activeReminders.set(weddingId, interval);

  res.json({
    active: true,
    intervalHours,
    message: `Lembretes automáticos ativados a cada ${intervalHours}h`,
  });
});

router.post("/weddings/:weddingId/reminders/stop", authMiddleware, requireWeddingRole("planner"), async (req, res): Promise<void> => {
  const weddingId = Number(req.params.weddingId);
  if (isNaN(weddingId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const timeout = activeReminders.get(weddingId);
  if (timeout) {
    clearInterval(timeout);
    activeReminders.delete(weddingId);
  }

  res.json({ active: false, message: "Lembretes automáticos desativados" });
});

router.post("/weddings/:weddingId/reminders/send-now", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const weddingId = Number(req.params.weddingId);
  if (isNaN(weddingId)) {
    res.status(400).json({ error: "ID inválido" });
    return;
  }

  const pendingGuests = await db.select().from(guestsTable)
    .where(and(
      eq(guestsTable.weddingId, weddingId),
      eq(guestsTable.rsvpStatus, "pending")
    ));

  if (pendingGuests.length === 0) {
    res.json({ sent: 0, message: "Nenhum convidado pendente" });
    return;
  }

  const settings = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));
  const settingsRow = settings[0];

  if (!settingsRow?.evolutionApiUrl || !settingsRow?.evolutionApiKey || !settingsRow?.evolutionInstance) {
    res.status(400).json({ error: "Configurações do WhatsApp não encontradas" });
    return;
  }

  let sent = 0;
  for (const guest of pendingGuests) {
    if (!guest.phone) continue;
    try {
      const phone = guest.phone.replace(/\D/g, "");
      await fetch(`${settingsRow.evolutionApiUrl}/message/sendText/${settingsRow.evolutionInstance}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": settingsRow.evolutionApiKey,
        },
        body: JSON.stringify({
          number: phone,
          text: `Olá ${guest.name}! 🎉 Ainda não recebemos sua confirmação de presença. Por favor, confirme sua participação no casamento. Obrigado!`,
        }),
      });
      sent++;
    } catch {
    }
  }

  res.json({ sent, total: pendingGuests.length, message: `${sent} lembretes enviados` });
});

export default router;
