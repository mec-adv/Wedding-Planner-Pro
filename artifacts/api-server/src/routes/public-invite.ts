import { Router, type IRouter, type Response } from "express";
import { z } from "zod";
import {
  db,
  guestsTable,
  weddingsTable,
  giftsTable,
  publicInviteTemplatesTable,
  eq,
  and,
  asc,
} from "@workspace/db";
import { UpdateGuestRsvpBody } from "@workspace/api-zod";
import { companionsByGuestIds, replaceGuestCompanions } from "../lib/guest-companion-ops";
import { createGiftOrderWithPayment } from "../lib/create-gift-order";
import { createRateLimiter, createTokenRateLimiter } from "../lib/public-rate-limit";

const router: IRouter = Router();

const limitPublic = createRateLimiter({ windowMs: 60_000, max: 120, keyPrefix: "pub" });
const limitToken = createTokenRateLimiter({ windowMs: 60_000, max: 90 });

const TokenParam = z.object({
  token: z.string().min(32).max(64),
});

const PublicGiftOrderBody = z.object({
  giftId: z.number().int().positive(),
  guestName: z.string().min(1).max(255),
  guestEmail: z.string().email().nullish(),
  guestCpf: z.string().nullish(),
  amount: z.number().positive(),
  paymentMethod: z.enum(["pix", "boleto", "credit_card"]),
  creditCardNumber: z.string().nullish(),
  creditCardHolderName: z.string().nullish(),
  creditCardExpiryMonth: z.string().nullish(),
  creditCardExpiryYear: z.string().nullish(),
  creditCardCcv: z.string().nullish(),
  creditCardHolderCpf: z.string().nullish(),
  creditCardHolderEmail: z.string().nullish(),
  creditCardHolderPhone: z.string().nullish(),
  creditCardHolderPostalCode: z.string().nullish(),
  creditCardHolderAddressNumber: z.string().nullish(),
  installmentCount: z.number().int().min(1).nullish(),
  coupleMessage: z.string().max(2000).nullish(),
  idempotencyKey: z.string().max(128).nullish(),
});

function notFound(res: Response): void {
  res.status(404).json({ error: "Não encontrado" });
}

async function loadGuestByToken(token: string) {
  const [guest] = await db.select().from(guestsTable).where(eq(guestsTable.inviteToken, token)).limit(1);
  if (!guest) return null;
  if (guest.inviteTokenExpiresAt && guest.inviteTokenExpiresAt < new Date()) return null;
  return guest;
}

async function resolveTemplate(weddingId: number, guestTemplateId: number | null) {
  if (guestTemplateId) {
    const [t] = await db
      .select()
      .from(publicInviteTemplatesTable)
      .where(
        and(
          eq(publicInviteTemplatesTable.id, guestTemplateId),
          eq(publicInviteTemplatesTable.weddingId, weddingId),
        ),
      )
      .limit(1);
    if (t) return t;
  }
  const [def] = await db
    .select()
    .from(publicInviteTemplatesTable)
    .where(and(eq(publicInviteTemplatesTable.weddingId, weddingId), eq(publicInviteTemplatesTable.isDefault, true)))
    .limit(1);
  return def ?? null;
}

router.get("/public/invite/:token", limitPublic, limitToken, async (req, res): Promise<void> => {
  const params = TokenParam.safeParse(req.params);
  if (!params.success) {
    notFound(res);
    return;
  }

  const guest = await loadGuestByToken(params.data.token);
  if (!guest) {
    notFound(res);
    return;
  }

  const [wedding] = await db.select().from(weddingsTable).where(eq(weddingsTable.id, guest.weddingId)).limit(1);
  if (!wedding) {
    notFound(res);
    return;
  }

  const template = await resolveTemplate(guest.weddingId, guest.publicInviteTemplateId);
  const compMap = await companionsByGuestIds([guest.id]);
  const companions = compMap.get(guest.id) ?? [];

  const config = (template?.config as Record<string, unknown> | null) ?? {};

  res.json({
    wedding: {
      id: wedding.id,
      title: wedding.title,
      brideName: wedding.brideName,
      groomName: wedding.groomName,
      date: wedding.date.toISOString(),
      civilCeremonyAt: wedding.civilCeremonyAt?.toISOString() ?? null,
      religiousCeremonyAt: wedding.religiousCeremonyAt?.toISOString() ?? null,
      venue: wedding.venue,
      description: wedding.description,
      coverImageUrl: wedding.coverImageUrl,
    },
    guest: {
      name: guest.name,
      rsvpStatus: guest.rsvpStatus,
      dietaryRestrictions: guest.dietaryRestrictions ?? null,
      companions,
      companionCount: companions.length,
    },
    template: {
      id: template?.id ?? null,
      name: template?.name ?? null,
      config,
    },
    lgpdNotice:
      "Os dados informados serão usados apenas para organização do evento e processamento do pagamento, conforme a legislação aplicável.",
  });
});

router.patch("/public/invite/:token", limitPublic, limitToken, async (req, res): Promise<void> => {
  const params = TokenParam.safeParse(req.params);
  if (!params.success) {
    notFound(res);
    return;
  }

  const guest = await loadGuestByToken(params.data.token);
  if (!guest) {
    notFound(res);
    return;
  }

  const parsed = UpdateGuestRsvpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { rsvpStatus: parsed.data.rsvpStatus };
  if (parsed.data.dietaryRestrictions !== undefined) updateData.dietaryRestrictions = parsed.data.dietaryRestrictions;

  const [updated] = await db
    .update(guestsTable)
    .set(updateData)
    .where(eq(guestsTable.id, guest.id))
    .returning();
  if (!updated) {
    notFound(res);
    return;
  }

  if (parsed.data.rsvpStatus === "declined") {
    await replaceGuestCompanions(updated.id, []);
  } else if (parsed.data.companions !== undefined) {
    await replaceGuestCompanions(guest.id, parsed.data.companions);
  }

  const compMap = await companionsByGuestIds([guest.id]);
  const companions = compMap.get(guest.id) ?? [];

  res.json({
    guest: {
      name: updated.name,
      rsvpStatus: updated.rsvpStatus,
      dietaryRestrictions: updated.dietaryRestrictions ?? null,
      companions,
      companionCount: companions.length,
    },
  });
});

router.get("/public/invite/:token/gifts", limitPublic, limitToken, async (req, res): Promise<void> => {
  const params = TokenParam.safeParse(req.params);
  if (!params.success) {
    notFound(res);
    return;
  }

  const guest = await loadGuestByToken(params.data.token);
  if (!guest) {
    notFound(res);
    return;
  }

  const gifts = await db
    .select()
    .from(giftsTable)
    .where(and(eq(giftsTable.weddingId, guest.weddingId), eq(giftsTable.isActive, true)))
    .orderBy(asc(giftsTable.name));

  res.json(
    gifts.map((g) => ({
      ...g,
      price: Number(g.price),
      createdAt: g.createdAt.toISOString(),
    })),
  );
});

router.post("/public/invite/:token/gift-orders", limitPublic, limitToken, async (req, res): Promise<void> => {
  const params = TokenParam.safeParse(req.params);
  if (!params.success) {
    notFound(res);
    return;
  }

  const guest = await loadGuestByToken(params.data.token);
  if (!guest) {
    notFound(res);
    return;
  }

  const parsed = PublicGiftOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const headerKey =
    typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"].trim().slice(0, 128) : "";
  const idempotencyKey = (parsed.data.idempotencyKey?.trim() || headerKey || null) as string | null;

  let result: Awaited<ReturnType<typeof createGiftOrderWithPayment>>;
  try {
    result = await createGiftOrderWithPayment({
      weddingId: guest.weddingId,
      giftId: parsed.data.giftId,
      guestId: guest.id,
      idempotencyKey,
      coupleMessage: parsed.data.coupleMessage ?? null,
      payment: {
        amount: parsed.data.amount,
        paymentMethod: parsed.data.paymentMethod,
        guestName: parsed.data.guestName,
        guestEmail: parsed.data.guestEmail,
        guestCpf: parsed.data.guestCpf,
        creditCardNumber: parsed.data.creditCardNumber,
        creditCardHolderName: parsed.data.creditCardHolderName,
        creditCardExpiryMonth: parsed.data.creditCardExpiryMonth,
        creditCardExpiryYear: parsed.data.creditCardExpiryYear,
        creditCardCcv: parsed.data.creditCardCcv,
        creditCardHolderCpf: parsed.data.creditCardHolderCpf,
        creditCardHolderEmail: parsed.data.creditCardHolderEmail,
        creditCardHolderPhone: parsed.data.creditCardHolderPhone,
        creditCardHolderPostalCode: parsed.data.creditCardHolderPostalCode,
        creditCardHolderAddressNumber: parsed.data.creditCardHolderAddressNumber,
        installmentCount: parsed.data.installmentCount,
      },
    });
  } catch (e: unknown) {
    const { getAsaasConfig } = await import("../lib/asaas");
    const config = await getAsaasConfig(guest.weddingId);
    if (config) {
      res.status(502).json({ error: `Erro ao processar pagamento: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    res.status(500).json({ error: e instanceof Error ? e.message : "Erro ao criar pedido" });
    return;
  }

  const { order, paymentArtifacts, reused } = result;
  const status = reused ? 200 : 201;
  res.status(status).json({
    ...order,
    amount: Number(order.amount),
    giftName: null,
    createdAt: order.createdAt.toISOString(),
    ...paymentArtifacts,
    idempotentReplay: reused,
  });
});

export default router;
