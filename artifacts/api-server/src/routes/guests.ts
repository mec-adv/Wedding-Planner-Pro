import { Router, type IRouter } from "express";
import {
  db,
  guestsTable,
  guestGroupsTable,
  guestCompanionsTable,
  eq,
  and,
  ilike,
  or,
  asc,
  inArray,
} from "@workspace/db";
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
import type { InferSelectModel } from "drizzle-orm";

type GuestRow = InferSelectModel<typeof guestsTable>;

type CompanionJson = { id: number; name: string; age: number; phone: string | null };

function mapGuestJson(g: GuestRow, guestGroupName: string | null, companions: CompanionJson[]) {
  return {
    id: g.id,
    weddingId: g.weddingId,
    name: g.name,
    email: g.email ?? null,
    phone: g.phone ?? null,
    guestGroupId: g.guestGroupId ?? null,
    guestGroupName,
    invitedBy: g.invitedBy ?? null,
    rsvpStatus: g.rsvpStatus,
    companions,
    companionCount: companions.length,
    dietaryRestrictions: g.dietaryRestrictions ?? null,
    notes: g.notes ?? null,
    inviteSentAt: g.inviteSentAt?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
  };
}

async function companionsByGuestIds(guestIds: number[]): Promise<Map<number, CompanionJson[]>> {
  const map = new Map<number, CompanionJson[]>();
  if (guestIds.length === 0) return map;
  const rows = await db
    .select()
    .from(guestCompanionsTable)
    .where(inArray(guestCompanionsTable.guestId, guestIds))
    .orderBy(asc(guestCompanionsTable.id));
  for (const r of rows) {
    const list = map.get(r.guestId) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      age: r.age,
      phone: r.phone ?? null,
    });
    map.set(r.guestId, list);
  }
  return map;
}

async function replaceGuestCompanions(
  guestId: number,
  items: { name: string; age: number; phone?: string | null }[],
): Promise<void> {
  await db.delete(guestCompanionsTable).where(eq(guestCompanionsTable.guestId, guestId));
  if (items.length === 0) return;
  const rows = items
    .map((c) => ({
      guestId,
      name: c.name.trim(),
      age: c.age,
      phone: c.phone?.trim() ? c.phone.trim() : null,
    }))
    .filter((c) => c.name.length > 0);
  if (rows.length === 0) return;
  await db.insert(guestCompanionsTable).values(rows);
}

async function ensureGuestGroupForWedding(weddingId: number, guestGroupId: number | null | undefined): Promise<boolean> {
  if (guestGroupId == null) return true;
  const [row] = await db
    .select({ id: guestGroupsTable.id })
    .from(guestGroupsTable)
    .where(and(eq(guestGroupsTable.id, guestGroupId), eq(guestGroupsTable.weddingId, weddingId)));
  return !!row;
}

async function loadGuestJson(weddingId: number, guestId: number) {
  const [row] = await db
    .select({ guest: guestsTable, guestGroupName: guestGroupsTable.name })
    .from(guestsTable)
    .leftJoin(guestGroupsTable, eq(guestsTable.guestGroupId, guestGroupsTable.id))
    .where(and(eq(guestsTable.id, guestId), eq(guestsTable.weddingId, weddingId)));
  if (!row) return null;
  const compMap = await companionsByGuestIds([guestId]);
  const companions = compMap.get(guestId) ?? [];
  return mapGuestJson(row.guest, row.guestGroupName ?? null, companions);
}

const router: IRouter = Router();

router.get("/weddings/:weddingId/guests", authMiddleware, requireWeddingRole("planner", "coordinator"), async (req, res): Promise<void> => {
  const params = ListGuestsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const qParams = ListGuestsQueryParams.safeParse(req.query);

  const conditions = [eq(guestsTable.weddingId, params.data.weddingId)];

  if (qParams.success && qParams.data.status) {
    conditions.push(eq(guestsTable.rsvpStatus, qParams.data.status));
  }
  if (qParams.success && qParams.data.search) {
    const term = `%${qParams.data.search}%`;
    conditions.push(or(ilike(guestsTable.name, term), ilike(guestGroupsTable.name, term))!);
  }

  const rows = await db
    .select({ guest: guestsTable, guestGroupName: guestGroupsTable.name })
    .from(guestsTable)
    .leftJoin(guestGroupsTable, eq(guestsTable.guestGroupId, guestGroupsTable.id))
    .where(and(...conditions))
    .orderBy(asc(guestsTable.name));

  const ids = rows.map((r) => r.guest.id);
  const compMap = await companionsByGuestIds(ids);

  res.json(
    rows.map((r) => mapGuestJson(r.guest, r.guestGroupName ?? null, compMap.get(r.guest.id) ?? [])),
  );
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

  const okGroup = await ensureGuestGroupForWedding(params.data.weddingId, parsed.data.guestGroupId ?? null);
  if (!okGroup) {
    res.status(400).json({ error: "Grupo de convidados inválido para este casamento." });
    return;
  }

  const [inserted] = await db
    .insert(guestsTable)
    .values({
      name: parsed.data.name || "",
      email: parsed.data.email,
      phone: parsed.data.phone,
      guestGroupId: parsed.data.guestGroupId ?? null,
      invitedBy: parsed.data.invitedBy ?? null,
      rsvpStatus: parsed.data.rsvpStatus ?? "pending",
      dietaryRestrictions: parsed.data.dietaryRestrictions,
      notes: parsed.data.notes,
      weddingId: params.data.weddingId,
    })
    .returning();

  if (!inserted) {
    res.status(500).json({ error: "Falha ao criar convidado." });
    return;
  }

  const full = await loadGuestJson(params.data.weddingId, inserted.id);
  res.status(201).json(full);
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
      const gid = guestData.guestGroupId ?? null;
      const ok = await ensureGuestGroupForWedding(params.data.weddingId, gid);
      if (!ok) {
        errors++;
        messages.push(`Grupo inválido para ${guestData.name ?? "convidado"}`);
        continue;
      }
      await db.insert(guestsTable).values({
        name: guestData.name || "",
        email: guestData.email,
        phone: guestData.phone,
        guestGroupId: gid,
        invitedBy: guestData.invitedBy ?? null,
        rsvpStatus: guestData.rsvpStatus ?? "pending",
        dietaryRestrictions: guestData.dietaryRestrictions,
        notes: guestData.notes,
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

  const json = await loadGuestJson(params.data.weddingId, params.data.id);
  if (!json) {
    res.status(404).json({ error: "Convidado não encontrado" });
    return;
  }

  res.json(json);
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

  if (parsed.data.guestGroupId !== undefined) {
    const okGroup = await ensureGuestGroupForWedding(params.data.weddingId, parsed.data.guestGroupId ?? null);
    if (!okGroup) {
      res.status(400).json({ error: "Grupo de convidados inválido para este casamento." });
      return;
    }
  }

  const [guest] = await db
    .update(guestsTable)
    .set(parsed.data)
    .where(and(eq(guestsTable.id, params.data.id), eq(guestsTable.weddingId, params.data.weddingId)))
    .returning();
  if (!guest) {
    res.status(404).json({ error: "Convidado não encontrado" });
    return;
  }

  const json = await loadGuestJson(params.data.weddingId, guest.id);
  res.json(json);
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

  const [existing] = await db
    .select()
    .from(guestsTable)
    .where(and(eq(guestsTable.id, params.data.id), eq(guestsTable.weddingId, params.data.weddingId)));
  if (!existing) {
    res.status(404).json({ error: "Convidado não encontrado" });
    return;
  }

  const updateData: Record<string, unknown> = { rsvpStatus: parsed.data.rsvpStatus };
  if (parsed.data.dietaryRestrictions !== undefined) updateData.dietaryRestrictions = parsed.data.dietaryRestrictions;

  const [guest] = await db
    .update(guestsTable)
    .set(updateData)
    .where(and(eq(guestsTable.id, params.data.id), eq(guestsTable.weddingId, params.data.weddingId)))
    .returning();
  if (!guest) {
    res.status(404).json({ error: "Convidado não encontrado" });
    return;
  }

  if (parsed.data.rsvpStatus === "declined") {
    await db.delete(guestCompanionsTable).where(eq(guestCompanionsTable.guestId, guest.id));
  } else if (parsed.data.companions !== undefined) {
    await replaceGuestCompanions(guest.id, parsed.data.companions);
  }

  const json = await loadGuestJson(params.data.weddingId, guest.id);
  res.json(json);
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

  const [guest] = await db
    .select()
    .from(guestsTable)
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
