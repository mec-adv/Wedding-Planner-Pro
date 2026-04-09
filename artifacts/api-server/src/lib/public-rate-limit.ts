import type { Request, Response, NextFunction } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function prune(now: number): void {
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k);
  }
}

/**
 * Rate limit simples em memória (adequado a um único processo; em cluster usar Redis).
 */
export function createRateLimiter(options: { windowMs: number; max: number; keyPrefix: string }) {
  const { windowMs, max, keyPrefix } = options;
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (buckets.size > 50_000) prune(now);
    const raw = (req.ip || req.socket.remoteAddress || "unknown") as string;
    const key = `${keyPrefix}:${raw}`;
    let b = buckets.get(key);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count++;
    if (b.count > max) {
      res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
      return;
    }
    next();
  };
}

export function createTokenRateLimiter(options: { windowMs: number; max: number }) {
  const { windowMs, max } = options;
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.params.token as string | undefined;
    const now = Date.now();
    if (buckets.size > 50_000) prune(now);
    const raw = (req.ip || req.socket.remoteAddress || "unknown") as string;
    const key = `tok:${token?.slice(0, 16) ?? "?"}:${raw}`;
    let b = buckets.get(key);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count++;
    if (b.count > max) {
      res.status(429).json({ error: "Muitas requisições. Tente novamente em instantes." });
      return;
    }
    next();
  };
}
