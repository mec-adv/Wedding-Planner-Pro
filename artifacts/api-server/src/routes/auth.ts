import { Router, type IRouter, type Response } from "express";
import { db, usersTable, eq } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { hashPassword, comparePassword, generateToken, authMiddleware } from "../lib/auth";
import { createRateLimiter } from "../lib/public-rate-limit";

const router: IRouter = Router();

/** 10 tentativas por IP a cada 15 minutos */
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "auth-login",
});

/** 5 registros por IP por hora */
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyPrefix: "auth-register",
});

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms

/**
 * Define os cookies de autenticação na resposta:
 * - `auth_token`: httpOnly, não acessível por JS (protege contra XSS)
 * - `auth_present`: visível por JS, usado apenas como indicador de sessão ativa
 */
function setAuthCookies(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";

  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  res.cookie("auth_present", "1", {
    httpOnly: false,
    secure: isProduction,
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie("auth_token", { path: "/" });
  res.clearCookie("auth_present", { path: "/" });
}

router.post("/auth/register", registerLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email já cadastrado" });
    return;
  }

  const requestedRole = parsed.data.role;
  const allowedSelfRegisterRoles = ["planner", "coordinator", "couple", "guest"];
  const assignedRole =
    requestedRole && allowedSelfRegisterRoles.includes(requestedRole) ? requestedRole : "planner";

  const passwordHash = await hashPassword(parsed.data.password);
  const [user] = await db
    .insert(usersTable)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: assignedRole,
    })
    .returning();

  const token = generateToken(user.id, user.role);
  setAuthCookies(res, token);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (!user) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  const valid = await comparePassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email ou senha inválidos" });
    return;
  }

  const token = generateToken(user.id, user.role);
  setAuthCookies(res, token);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    },
  });
});

router.post("/auth/logout", (_req, res): void => {
  clearAuthCookies(res);
  res.json({ ok: true });
});

router.get("/auth/me", authMiddleware, async (req, res): Promise<void> => {
  const userId = (req as import("../lib/auth").AuthRequest).userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
