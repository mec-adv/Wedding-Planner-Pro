import type { Guest, GuestInput } from "@workspace/api-client-react";
import { stripPhoneDigits } from "@/lib/phone-br";

export const GUEST_IMPORT_CSV_COLUMNS = [
  "nome",
  "email",
  "whatsapp",
  "grupo",
  "convidado_por",
  "observacoes",
] as const;

export const GUEST_EXPORT_CSV_COLUMNS = [
  "tipo",
  "nome_convidado_principal",
  "nome",
  "idade",
  "celular",
  "email",
  "grupo",
  "convidado_por",
  "status_rsvp",
] as const;

const RSVP_LABELS_PT: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  declined: "Declinou",
  maybe: "Talvez",
};

/** Escapa campo para CSV (RFC básico). */
export function escapeCsvField(value: string): string {
  const s = value ?? "";
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowToLine(cells: string[]): string {
  return cells.map(escapeCsvField).join(",");
}

export function buildGuestsExportCsv(
  guests: Guest[],
  rsvpLabel: (status: string) => string = (s) => RSVP_LABELS_PT[s] ?? s,
): string {
  const lines: string[] = [rowToLine([...GUEST_EXPORT_CSV_COLUMNS])];
  const sorted = [...guests].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  for (const g of sorted) {
    const convidadoPor =
      g.invitedBy === "groom" ? "noivo" : g.invitedBy === "bride" ? "noiva" : "";
    lines.push(
      rowToLine([
        "CONVIDADO",
        "",
        g.name,
        "",
        g.phone ?? "",
        g.email ?? "",
        g.guestGroupName ?? "",
        convidadoPor,
        rsvpLabel(g.rsvpStatus),
      ]),
    );
    for (const c of g.companions ?? []) {
      lines.push(
        rowToLine([
          "ACOMPANHANTE",
          g.name,
          c.name,
          String(c.age),
          c.phone ?? "",
          "",
          "",
          "",
          "",
        ]),
      );
    }
  }
  return lines.join("\r\n");
}

export function downloadUtf8Csv(filename: string, csvBody: string): void {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csvBody], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function guestImportTemplateCsv(): string {
  const header = rowToLine([...GUEST_IMPORT_CSV_COLUMNS]);
  const example1 = rowToLine([
    "Maria Silva",
    "maria@email.com",
    "11999998888",
    "Família",
    "noivo",
    "",
  ]);
  const example2 = rowToLine(["João Souza", "", "11988887777", "Colegas", "noiva", "Mesa perto da janela"]);
  return [header, example1, example2].join("\r\n");
}

/** Parser CSV simples com suporte a aspas e quebras de linha dentro de campos. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\r") {
      /* ignorar CR; LF encerra a linha em CRLF */
    } else if (c === "\n") {
      row.push(cur);
      cur = "";
      if (row.some((cell) => cell.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      cur += c;
    }
  }
  row.push(cur);
  if (row.some((cell) => cell.trim().length > 0)) {
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export type GuestGroupLite = { id: number; name: string };

function mapInvitedByCell(raw: string): "groom" | "bride" | null {
  const v = raw.trim().toLowerCase();
  if (v === "noivo" || v === "groom") return "groom";
  if (v === "noiva" || v === "bride") return "bride";
  return null;
}

function resolveGroupId(
  groupName: string,
  groups: GuestGroupLite[] | undefined,
): { id: number | null; warning?: string } {
  const t = groupName.trim();
  if (!t) return { id: null };
  const found = groups?.find((g) => g.name.trim().toLowerCase() === t.toLowerCase());
  if (!found) {
    return {
      id: null,
      warning: `Grupo "${t}" não encontrado; convidado importado sem grupo.`,
    };
  }
  return { id: found.id };
}

/**
 * Converte linhas do modelo de importação em `GuestInput[]`.
 * Ignora linhas sem nome. Cabeçalho deve conter `nome`.
 */
export function guestImportRowsToInputs(
  rows: string[][],
  groups: GuestGroupLite[] | undefined,
): { guests: GuestInput[]; warnings: string[] } {
  if (rows.length === 0) {
    return { guests: [], warnings: ["Arquivo vazio."] };
  }
  const headerCells = rows[0].map(normalizeHeader);
  const idx = (key: string) => headerCells.findIndex((h) => h === key);

  const iNome = idx("nome");
  if (iNome < 0) {
    return { guests: [], warnings: ['Cabeçalho deve incluir a coluna "nome".'] };
  }
  const iEmail = idx("email");
  const iWhatsapp = idx("whatsapp");
  const iGrupo = idx("grupo");
  const iConvidado = idx("convidado_por");
  const iObs = idx("observacoes");

  const guests: GuestInput[] = [];
  const warnings: string[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const name = (cells[iNome] ?? "").trim();
    if (!name) continue;

    const emailRaw = iEmail >= 0 ? (cells[iEmail] ?? "").trim() : "";
    const waRaw = iWhatsapp >= 0 ? (cells[iWhatsapp] ?? "").trim() : "";
    const grupoRaw = iGrupo >= 0 ? (cells[iGrupo] ?? "").trim() : "";
    const convRaw = iConvidado >= 0 ? (cells[iConvidado] ?? "").trim() : "";
    const obsRaw = iObs >= 0 ? (cells[iObs] ?? "").trim() : "";

    const { id: guestGroupId, warning: gw } = resolveGroupId(grupoRaw, groups);
    if (gw) warnings.push(`${name}: ${gw}`);

    guests.push({
      name,
      email: emailRaw ? emailRaw : null,
      phone: waRaw ? stripPhoneDigits(waRaw) || null : null,
      guestGroupId,
      invitedBy: mapInvitedByCell(convRaw),
      notes: obsRaw ? obsRaw : null,
    });
  }

  if (guests.length === 0) {
    warnings.push("Nenhuma linha com nome válido para importar.");
  }

  return { guests, warnings };
}
