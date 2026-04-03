import type { Wedding } from "@workspace/db";

function asPgDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  throw new Error("Data inválida retornada do banco");
}

function asPgDateOrNull(v: unknown): Date | null {
  if (v == null) return null;
  return asPgDate(v);
}

/** Preferência snake_case (`pg` padrão); fallback camelCase (drivers / configs alternativos). */
function col(row: Record<string, unknown>, snake: string, camel: string): unknown {
  const a = row[snake];
  if (a !== undefined && a !== null) return a;
  return row[camel];
}

function reqStr(row: Record<string, unknown>, snake: string, camel: string): string {
  const v = col(row, snake, camel);
  if (v === undefined || v === null) {
    throw new Error(`Campo obrigatório ausente na linha do casamento (${snake})`);
  }
  return String(v);
}

function optStr(row: Record<string, unknown>, snake: string, camel: string): string | null {
  const v = col(row, snake, camel);
  if (v == null) return null;
  return String(v);
}

/** Linha `pg` (snake_case) → `Wedding`. Evita Drizzle na tabela `weddings` quando há cópias duplicadas do ORM (`packageImportMethod: copy`). */
export function weddingRowFromPg(row: Record<string, unknown>): Wedding {
  return {
    id: Number(col(row, "id", "id")),
    title: reqStr(row, "title", "title"),
    groomName: reqStr(row, "groom_name", "groomName"),
    brideName: reqStr(row, "bride_name", "brideName"),
    date: asPgDate(col(row, "date", "date")),
    civilCeremonyAt: asPgDateOrNull(col(row, "civil_ceremony_at", "civilCeremonyAt")),
    religiousCeremonyAt: asPgDateOrNull(col(row, "religious_ceremony_at", "religiousCeremonyAt")),
    venue: optStr(row, "venue", "venue"),
    description: optStr(row, "description", "description"),
    coverImageUrl: optStr(row, "cover_image_url", "coverImageUrl"),
    createdById: Number(col(row, "created_by_id", "createdById")),
    createdAt: asPgDate(col(row, "created_at", "createdAt")),
    updatedAt: asPgDate(col(row, "updated_at", "updatedAt")),
  };
}
