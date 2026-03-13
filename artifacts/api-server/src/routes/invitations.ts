import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, invitationsTable, profilesTable, usersTable } from "@workspace/db";
import { authMiddleware, requireWeddingRole, verifyWeddingAccess, type AuthRequest } from "../lib/auth";
import crypto from "crypto";
import { z } from "zod";

const WeddingIdParams = z.object({
  weddingId: z.coerce.number(),
});

const CreateInvitationBody = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["coordinator", "couple", "guest"], { message: "Perfil inválido para convite" }),
  message: z.string().optional(),
});

const AcceptInvitationBody = z.object({
  token: z.string().min(1, "Token é obrigatório"),
});

const DeleteInvitationParams = z.object({
  weddingId: z.coerce.number(),
  id: z.coerce.number(),
});

const router: IRouter = Router();

router.get("/weddings/:weddingId/invitations", authMiddleware, verifyWeddingAccess, requireWeddingRole("planner", "coordinator", "admin"), async (req, res): Promise<void> => {
  const params = WeddingIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const invitations = await db.select().from(invitationsTable).where(eq(invitationsTable.weddingId, params.data.weddingId));
  res.json(invitations.map(i => ({
    ...i,
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  })));
});

router.post("/weddings/:weddingId/invitations", authMiddleware, verifyWeddingAccess, requireWeddingRole("planner", "coordinator", "admin"), async (req, res): Promise<void> => {
  const params = WeddingIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = CreateInvitationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || parsed.error.message }); return; }

  const authReq = req as AuthRequest;
  const token = crypto.randomBytes(32).toString("hex");

  const [invitation] = await db.insert(invitationsTable).values({
    weddingId: params.data.weddingId,
    invitedById: authReq.userId,
    email: parsed.data.email,
    role: parsed.data.role,
    token,
    status: "pending",
    message: parsed.data.message ?? null,
  }).returning();

  res.status(201).json({
    ...invitation,
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  });
});

router.post("/invitations/accept", authMiddleware, async (req, res): Promise<void> => {
  const parsed = AcceptInvitationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || parsed.error.message }); return; }

  const authReq = req as AuthRequest;

  const [invitation] = await db.select().from(invitationsTable).where(eq(invitationsTable.token, parsed.data.token));
  if (!invitation) {
    res.status(404).json({ error: "Convite não encontrado" });
    return;
  }

  if (invitation.status !== "pending") {
    res.status(400).json({ error: "Convite já utilizado" });
    return;
  }

  const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, authReq.userId));
  if (!currentUser || currentUser.email.toLowerCase() !== invitation.email.toLowerCase()) {
    res.status(403).json({ error: "Este convite foi enviado para outro email. Faça login com o email correto." });
    return;
  }

  const [existingProfile] = await db.select().from(profilesTable).where(
    and(
      eq(profilesTable.userId, authReq.userId),
      eq(profilesTable.weddingId, invitation.weddingId),
    )
  );

  if (!existingProfile) {
    await db.insert(profilesTable).values({
      userId: authReq.userId,
      weddingId: invitation.weddingId,
      role: invitation.role,
    });
  }

  await db.update(invitationsTable)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(invitationsTable.id, invitation.id));

  res.json({ message: "Convite aceito com sucesso", weddingId: invitation.weddingId });
});

router.delete("/weddings/:weddingId/invitations/:id", authMiddleware, verifyWeddingAccess, requireWeddingRole("planner", "admin"), async (req, res): Promise<void> => {
  const params = DeleteInvitationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [invitation] = await db.select().from(invitationsTable).where(
    and(eq(invitationsTable.id, params.data.id), eq(invitationsTable.weddingId, params.data.weddingId))
  );
  if (!invitation) {
    res.status(404).json({ error: "Convite não encontrado" });
    return;
  }
  await db.delete(invitationsTable).where(eq(invitationsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/weddings/:weddingId/profiles", authMiddleware, verifyWeddingAccess, async (req, res): Promise<void> => {
  const params = WeddingIdParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const profiles = await db
    .select({
      id: profilesTable.id,
      userId: profilesTable.userId,
      weddingId: profilesTable.weddingId,
      role: profilesTable.role,
      createdAt: profilesTable.createdAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(profilesTable)
    .innerJoin(usersTable, eq(profilesTable.userId, usersTable.id))
    .where(eq(profilesTable.weddingId, params.data.weddingId));

  res.json(profiles.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.delete("/weddings/:weddingId/profiles/:id", authMiddleware, verifyWeddingAccess, requireWeddingRole("planner", "admin"), async (req, res): Promise<void> => {
  const params = DeleteInvitationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [profile] = await db.select().from(profilesTable).where(
    and(eq(profilesTable.id, params.data.id), eq(profilesTable.weddingId, params.data.weddingId))
  );
  if (!profile) {
    res.status(404).json({ error: "Perfil não encontrado" });
    return;
  }
  await db.delete(profilesTable).where(eq(profilesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
