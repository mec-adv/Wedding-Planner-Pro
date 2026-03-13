import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db, weddingsTable, profilesTable } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

export type UserRole = "admin" | "planner" | "coordinator" | "couple" | "guest";

export interface AuthRequest extends Request {
  userId: number;
  userRole: UserRole;
  weddingRole?: UserRole;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return secret || "dev-only-secret-do-not-use-in-production";
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: number, role: string): string {
  return jwt.sign({ userId, role }, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: number; role: string } {
  return jwt.verify(token, getJwtSecret()) as { userId: number; role: string };
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token de autenticação não fornecido" });
    return;
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    const authReq = req as AuthRequest;
    authReq.userId = decoded.userId;
    authReq.userRole = decoded.role as UserRole;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    if (!roles.includes(authReq.userRole)) {
      res.status(403).json({ error: "Acesso não autorizado para este perfil" });
      return;
    }
    next();
  };
}

export function requireWeddingRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    if (authReq.userRole === "admin") {
      next();
      return;
    }
    if (authReq.weddingRole && roles.includes(authReq.weddingRole)) {
      next();
      return;
    }
    res.status(403).json({ error: "Acesso não autorizado para este casamento" });
  };
}

export async function verifyWeddingAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const weddingId = Number(req.params.weddingId || req.params.id);
  const authReq = req as AuthRequest;

  if (!weddingId || isNaN(weddingId)) {
    next();
    return;
  }

  if (authReq.userRole === "admin") {
    authReq.weddingRole = "admin";
    next();
    return;
  }

  const [wedding] = await db.select().from(weddingsTable).where(eq(weddingsTable.id, weddingId));
  if (!wedding) {
    res.status(404).json({ error: "Casamento não encontrado" });
    return;
  }

  if (wedding.createdById === authReq.userId) {
    authReq.weddingRole = "planner";
    next();
    return;
  }

  const [profile] = await db.select().from(profilesTable).where(
    and(
      eq(profilesTable.userId, authReq.userId),
      eq(profilesTable.weddingId, weddingId),
    )
  );

  if (profile) {
    authReq.weddingRole = profile.role as UserRole;
    next();
    return;
  }

  res.status(403).json({ error: "Você não tem acesso a este casamento" });
}
