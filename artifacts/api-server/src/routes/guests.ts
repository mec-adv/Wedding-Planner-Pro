import { Router, type IRouter } from "express";
import { eq, and, ilike } from "drizzle-orm";
import { db, guestsTable } from "@workspace/db";
import {
  ListGuestsParams,
  ListGuestsQueryParams,
  CreateGuestParams,
  CreateGuestBody,
  GetGuestParams,
  UpdateGuestParams,
  UpdateGuestBody,
  DeleteGuestParams,
  UpdateGuestRsvpParams,
  UpdateGuestRsvpBody,
  SendGuestInviteParams,
  SendGuestInviteBody,
  ImportGuestsParams,
  ImportGuestsBody,
} from "@workspace/api-zod";
import { authMiddleware, requireWeddingRole } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/guests", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = ListGuestsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const query = ListGuestsQueryParams.safeParse(req.query);

  const conditions = [eq(guestsTable.weddingId, params.data.weddingId)];

  if (query.success && query.data.status) {
    conditions.push(eq(guestsTable.rsvpStatus, query.data.status));
  }
  if (query.success && query.data.search) {
    conditions.push(ilike(guestsTable.name, `%${query.data.search}%`));
  }

  const guests = await db.select().from(guestsTable).where(and(...conditions));
  res.json(guests.map(g => ({
    ...g,
    inviteSentAt: g.inviteSentAt?.toISOString() || null,
    createdAt: g.createdAt.toISOString(),
  })));
});

router.post("/weddings/:weddingId/guests", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = CreateGuestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateGuestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [guest] = await db.insert(guestsTable).values({
    name: parsed.data.name || "",
    email: parsed.data.email,
    phone: parsed.data.phone,
    group: parsed.data.group,
    rsvpStatus: parsed.data.rsvpStatus,
    plusOne: parsed.data.plusOne,
    dietaryRestrictions: parsed.data.dietaryRestrictions,
    plusOneName: parsed.data.plusOneName,
    weddingId: params.data.weddingId,
  }).returning();

  res.status(201).json({
    ...guest,
    inviteSentAt: guest.inviteSentAt?.toISOString() || null,
    createdAt: guest.createdAt.toISOString(),
  });
});

router.post("/weddings/:weddingId/guests/import", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = ImportGuestsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ImportGuestsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let imported = 0;
  let errors = 0;
  const messages: string[] = [];

  for (const guestData of parsed.data.guests) {
    try {
      await db.insert(guestsTable).values({
        name: guestData.name || "",
        email: guestData.email,
        phone: guestData.phone,
        group: guestData.group,
        rsvpStatus: guestData.rsvpStatus,
        plusOne: guestData.plusOne,
        weddingId: params.data.weddingId,
      });
      imported++;
    } catch (e: unknown) {
      errors++;
      messages.push(`Erro ao importar ${guestData.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  res.json({ imported, errors, messages });
});

router.get("/weddings/:weddingId/guests/:id", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = GetGuestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [guest] = await db.select().from(guestsTable)
    .where(and(eq(guestsTable.id, params.data.id), eq(guestsTable.weddingId, params.data.weddingId)));
  if (!guest) {
    res.status(404).json({ error: "Convidado não encontrado" });
    return;
  }

  res.json({
    ...guest,
    inviteSentAt: guest.inviteSentAt?.toISOString() || null,
    createdAt: guest.createdAt.toISOString(),
  });
});

router.patch("/weddings/:weddingId/guests/:id", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = UpdateGuestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGuestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [guest] = await db.update(guestsTable).set(parsed.data)
    .where(and(eq(guestsTable.id, params.data.id), eq(guestsTable.weddingId, params.data.weddingId))).returning();
  if (!guest) {
    res.status(404).json({ error: "Convidado não encontrado" });
    return;
  }

  res.json({
    ...guest,
    inviteSentAt: guest.inviteSentAt?.toISOString() || null,
    createdAt: guest.createdAt.toISOString(),
  });
});

router.delete("/weddings/:weddingId/guests/:id", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = DeleteGuestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(guestsTable).where(and(eq(guestsTable.id, params.data.id), eq(guestsTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

router.patch("/weddings/:weddingId/guests/:id/rsvp", authMiddleware, async (req, res): Promise<void> => {
  const params = UpdateGuestRsvpParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGuestRsvpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { rsvpStatus: parsed.data.rsvpStatus };
  if (parsed.data.dietaryRestrictions !== undefined) updateData.dietaryRestrictions = parsed.data.dietaryRestrictions;
  if (parsed.data.plusOneName !== undefined) updateData.plusOneName = parsed.data.plusOneName;

  const [guest] = await db.update(guestsTable).set(updateData)
    .where(and(eq(guestsTable.id, params.data.id), eq(guestsTable.weddingId, params.data.weddingId))).returning();
  if (!guest) {
    res.status(404).json({ error: "Convidado não encontrado" });
    return;
  }

  res.json({
    ...guest,
    inviteSentAt: guest.inviteSentAt?.toISOString() || null,
    createdAt: guest.createdAt.toISOString(),
  });
});

router.post("/weddings/:weddingId/guests/:id/send-invite", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = SendGuestInviteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = SendGuestInviteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [guest] = await db.select().from(guestsTable)
    .where(and(eq(guestsTable.id, params.data.id), eq(guestsTable.weddingId, params.data.weddingId)));
  if (!guest) {
    res.status(404).json({ error: "Convidado não encontrado" });
    return;
  }

  if (parsed.data.channel === "whatsapp") {
    if (!guest.phone) {
      res.json({ success: false, message: "Convidado não tem telefone cadastrado" });
      return;
    }

    try {
      const { sendWhatsAppMessage } = await import("../lib/evolution-api");
      await sendWhatsAppMessage(params.data.weddingId, guest.phone, `Olá ${guest.name}! Você está convidado(a) para o nosso casamento! 💒`);
      await db.update(guestsTable).set({ inviteSentAt: new Date() }).where(eq(guestsTable.id, guest.id));
      res.json({ success: true, message: "Convite enviado via WhatsApp" });
    } catch (e: unknown) {
      res.json({ success: false, message: `Erro ao enviar WhatsApp: ${e instanceof Error ? e.message : String(e)}` });
    }
  } else if (parsed.data.channel === "email") {
    if (!guest.email) {
      res.json({ success: false, message: "Convidado não tem email cadastrado" });
      return;
    }

    try {
      const { sendEmailInvite } = await import("../lib/email");
      await sendEmailInvite(params.data.weddingId, guest.email, guest.name);
      await db.update(guestsTable).set({ inviteSentAt: new Date() }).where(eq(guestsTable.id, guest.id));
      res.json({ success: true, message: "Convite enviado por email" });
    } catch (e: unknown) {
      res.json({ success: false, message: `Erro ao enviar email: ${e instanceof Error ? e.message : String(e)}` });
    }
  } else {
    res.status(400).json({ error: "Canal de envio inválido. Use 'whatsapp' ou 'email'" });
  }
});

export default router;
