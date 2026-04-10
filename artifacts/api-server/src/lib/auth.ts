import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

export type UserRole = "admin" | "planner" | "coordinator" | "couple" | "guest";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  planner: "Cerimonialista",
  coordinator: "Coordenador(a)",
  couple: "Casal",
  guest: "Convidado(a)",
};

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

/** Extrai o token JWT do cookie httpOnly ou, como fallback, do header Authorization (para clientes de API externos). */
function extractToken(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.split(";").find((c) => c.trim().startsWith("auth_token="));
    if (match) return match.trim().substring("auth_token=".length);
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return undefined;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: "Token de autenticação não fornecido" });
    return;
  }

  try {
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

  const wRes = await pool.query(`SELECT id, created_by_id FROM weddings WHERE id = $1`, [weddingId]);
  const wRow = wRes.rows[0] as { id: number; created_by_id: number } | undefined;
  if (!wRow) {
    res.status(404).json({ error: "Casamento não encontrado" });
    return;
  }

  if (wRow.created_by_id === authReq.userId) {
    authReq.weddingRole = "planner";
    next();
    return;
  }

  const pRes = await pool.query(
    `SELECT role FROM profiles WHERE user_id = $1 AND wedding_id = $2 LIMIT 1`,
    [authReq.userId, weddingId],
  );
  const profileRow = pRes.rows[0] as { role: string } | undefined;
  if (profileRow) {
    authReq.weddingRole = profileRow.role as UserRole;
    next();
    return;
  }

  res.status(403).json({ error: "Você não tem acesso a este casamento" });
}
