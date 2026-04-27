import type { Response } from "express";

const HINT =
  "No servidor ou na sua máquina de desenvolvimento, na raiz do repositório, execute: pnpm db:push (ou pnpm --filter @workspace/db push-force). Alternativa: pnpm db:migrate:whatsapp-connections";

function collectPgCodesAndMessages(err: unknown): { codes: string[]; messages: string[] } {
  const codes: string[] = [];
  const messages: string[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 10 && cur; i++) {
    if (typeof cur === "object" && cur !== null) {
      const o = cur as Record<string, unknown>;
      if (typeof o.code === "string") codes.push(o.code);
      if (typeof o.message === "string") messages.push(o.message);
      cur = o.cause;
    } else {
      break;
    }
  }
  if (messages.length === 0 && err instanceof Error) messages.push(err.message);
  return { codes, messages };
}

/**
 * Detecta erro típico quando a tabela `whatsapp_connections` ou os ENUMs
 * ainda não existem no PostgreSQL (schema não aplicado nesse ambiente).
 */
export function respondIfWhatsappSchemaMissing(res: Response, err: unknown): boolean {
  const { codes, messages } = collectPgCodesAndMessages(err);
  const msg = messages.join(" ");

  if (
    codes.includes("42P01") ||
    /relation ["']?whatsapp_connections["']? does not exist/i.test(msg)
  ) {
    res.status(503).json({
      error: "Tabela whatsapp_connections não existe neste banco de dados.",
      hint: HINT,
    });
    return true;
  }

  if (
    codes.includes("42704") ||
    (/type "whatsapp_/i.test(msg) && /does not exist/i.test(msg))
  ) {
    res.status(503).json({
      error: "Tipos ENUM do WhatsApp não foram criados neste banco.",
      hint: HINT,
    });
    return true;
  }

  return false;
}
