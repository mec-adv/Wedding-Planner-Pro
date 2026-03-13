import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, invitationsTable, profilesTable, usersTable } from "@workspace/db";
import { authMiddleware, requireWeddingRole, verifyWeddingAccess, type AuthRequest } from "../lib/auth";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/weddings/:weddingId/invitations", authMiddleware, verifyWeddingAccess, requireWeddingRole("planner", "coordinator", "admin"), async (req, res): Promise<void> => {
  const weddingId = Number(req.params.weddingId);
  const invitations = await db.select().from(invitationsTable).where(eq(invitationsTable.weddingId, weddingId));
  res.json(invitations.map(i => ({
    ...i,
    acceptedAt: i.acceptedAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  })));
});

router.post("/weddings/:weddingId/invitations", authMiddleware, verifyWeddingAccess, requireWeddingRole("planner", "coordinator", "admin"), async (req, res): Promise<void> => {
  const weddingId = Number(req.params.weddingId);
  const authReq = req as AuthRequest;

  const { email, role, message } = req.body as { email: string; role: string; message?: string };
  if (!email || !role) {
    res.status(400).json({ error: "Email e perfil são obrigatórios" });
    return;
  }

  const allowedRoles = ["coordinator", "couple", "guest"];
  if (!allowedRoles.includes(role)) {
    res.status(400).json({ error: "Perfil inválido para convite" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");

  const [invitation] = await db.insert(invitationsTable).values({
    weddingId,
    invitedById: authReq.userId,
    email,
    role,
    token,
    status: "pending",
    message: message ?? null,
  }).returning();

  res.status(201).json({
    ...invitation,
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  });
});

router.post("/invitations/accept", authMiddleware, async (req, res): Promise<void> => {
  const authReq = req as AuthRequest;
  const { token } = req.body as { token: string };

  if (!token) {
    res.status(400).json({ error: "Token é obrigatório" });
    return;
  }

  const [invitation] = await db.select().from(invitationsTable).where(eq(invitationsTable.token, token));
  if (!invitation) {
    res.status(404).json({ error: "Convite não encontrado" });
    return;
  }

  if (invitation.status !== "pending") {
    res.status(400).json({ error: "Convite já utilizado" });
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
  const id = Number(req.params.id);
  const weddingId = Number(req.params.weddingId);
  const [invitation] = await db.select().from(invitationsTable).where(
    and(eq(invitationsTable.id, id), eq(invitationsTable.weddingId, weddingId))
  );
  if (!invitation) {
    res.status(404).json({ error: "Convite não encontrado" });
    return;
  }
  await db.delete(invitationsTable).where(eq(invitationsTable.id, id));
  res.sendStatus(204);
});

router.get("/weddings/:weddingId/profiles", authMiddleware, verifyWeddingAccess, async (req, res): Promise<void> => {
  const weddingId = Number(req.params.weddingId);
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
    .where(eq(profilesTable.weddingId, weddingId));

  res.json(profiles.map(p => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.delete("/weddings/:weddingId/profiles/:id", authMiddleware, verifyWeddingAccess, requireWeddingRole("planner", "admin"), async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const weddingId = Number(req.params.weddingId);
  const [profile] = await db.select().from(profilesTable).where(
    and(eq(profilesTable.id, id), eq(profilesTable.weddingId, weddingId))
  );
  if (!profile) {
    res.status(404).json({ error: "Perfil não encontrado" });
    return;
  }
  await db.delete(profilesTable).where(eq(profilesTable.id, id));
  res.sendStatus(204);
});

export default router;
