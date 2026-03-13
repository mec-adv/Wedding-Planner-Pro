import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, weddingsTable } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

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
    (req as any).userId = decoded.userId;
    (req as any).userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req as any).userRole;
    if (!roles.includes(userRole)) {
      res.status(403).json({ error: "Acesso não autorizado para este perfil" });
      return;
    }
    next();
  };
}

export async function verifyWeddingAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const weddingId = Number(req.params.weddingId || req.params.id);
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  if (!weddingId || isNaN(weddingId)) {
    next();
    return;
  }

  if (userRole === "admin") {
    next();
    return;
  }

  const [wedding] = await db.select().from(weddingsTable).where(eq(weddingsTable.id, weddingId));
  if (!wedding) {
    res.status(404).json({ error: "Casamento não encontrado" });
    return;
  }

  if (wedding.createdById !== userId) {
    res.status(403).json({ error: "Você não tem acesso a este casamento" });
    return;
  }

  next();
}
