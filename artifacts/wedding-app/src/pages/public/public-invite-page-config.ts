/**
 * Conteúdo e aparência editáveis da página pública do convite (JSON em `public_invite_templates.config`).
 */

export type PublicInvitePageConfig = {
  /** Faixa superior acima dos nomes */
  heroTagline?: string;
  mensagemAposCerimonia?: string;
  countdownDayLabel?: string;
  countdownHourLabel?: string;
  countdownMinLabel?: string;
  ctaRsvp?: string;
  sectionGrandeDiaTitle?: string;
  blockCerimoniaTitle?: string;
  localLabel?: string;
  dataLabel?: string;
  dressCodeText?: string;
  blockEventoTitle?: string;
  emptyDescriptionFallback?: string;
  rsvpSectionTitle?: string;
  rsvpSectionSubtitle?: string;
  rsvpSuccessTitle?: string;
  rsvpSuccessMessage?: string;
  seusDadosTitle?: string;
  convidadoLabel?: string;
  suaPresencaLabel?: string;
  acompanhanteLabel?: string;
  removerLabel?: string;
  adicionarAcompanhanteLabel?: string;
  restricoesLabel?: string;
  restricoesPlaceholder?: string;
  giftsSectionTitle?: string;
  giftsTagline?: string;
  giftsEmptyMessage?: string;
  footerLine2?: string;
  showCountdown?: boolean;
  primaryColor?: string;
  backgroundColor?: string;
  patternDotColor?: string;
  textColor?: string;
};

export const DEFAULT_PUBLIC_INVITE_PAGE_CONFIG: Required<
  Pick<
    PublicInvitePageConfig,
    | "heroTagline"
    | "mensagemAposCerimonia"
    | "countdownDayLabel"
    | "countdownHourLabel"
    | "countdownMinLabel"
    | "ctaRsvp"
    | "sectionGrandeDiaTitle"
    | "blockCerimoniaTitle"
    | "localLabel"
    | "dataLabel"
    | "dressCodeText"
    | "blockEventoTitle"
    | "emptyDescriptionFallback"
    | "rsvpSectionTitle"
    | "rsvpSectionSubtitle"
    | "rsvpSuccessTitle"
    | "rsvpSuccessMessage"
    | "seusDadosTitle"
    | "convidadoLabel"
    | "suaPresencaLabel"
    | "acompanhanteLabel"
    | "removerLabel"
    | "adicionarAcompanhanteLabel"
    | "restricoesLabel"
    | "restricoesPlaceholder"
    | "giftsSectionTitle"
    | "giftsTagline"
    | "giftsEmptyMessage"
    | "footerLine2"
    | "showCountdown"
    | "primaryColor"
    | "backgroundColor"
    | "patternDotColor"
    | "textColor"
  >
> = {
  heroTagline: "Nós vamos nos casar",
  mensagemAposCerimonia: "Chegou o grande dia!",
  countdownDayLabel: "Dias",
  countdownHourLabel: "Horas",
  countdownMinLabel: "Min",
  ctaRsvp: "Confirmar Presença",
  sectionGrandeDiaTitle: "O Grande Dia",
  blockCerimoniaTitle: "Cerimônia & Recepção",
  localLabel: "Local:",
  dataLabel: "Data:",
  dressCodeText: "Traje: Sinta-se à vontade; não há dress code obrigatório.",
  blockEventoTitle: "Sobre o evento",
  emptyDescriptionFallback: "Em breve, mais detalhes podem ser adicionados pelo casal.",
  rsvpSectionTitle: "Confirmação de Presença",
  rsvpSectionSubtitle: "Por favor, confirme sua presença preenchendo o formulário abaixo.",
  rsvpSuccessTitle: "Obrigado!",
  rsvpSuccessMessage: "Sua resposta foi registrada. Mal podemos esperar para celebrar com você!",
  seusDadosTitle: "Seus dados",
  convidadoLabel: "Convidado(a):",
  suaPresencaLabel: "Sua presença",
  acompanhanteLabel: "Acompanhante",
  removerLabel: "Remover",
  adicionarAcompanhanteLabel: "+ Adicionar acompanhante",
  restricoesLabel: "Restrições alimentares (opcional)",
  restricoesPlaceholder: "Ex.: vegetariano, alergia a amendoim…",
  giftsSectionTitle: "Lista de presentes",
  giftsTagline: "Sua presença é o nosso maior presente!",
  giftsEmptyMessage: "Em breve, a lista de presentes estará disponível aqui.",
  footerLine2: "Com carinho, aguardamos você.",
  showCountdown: true,
  primaryColor: "#708238",
  backgroundColor: "#FDFCF8",
  patternDotColor: "#708238",
  textColor: "#333333",
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Mescla JSON salvo com os padrões (campos desconhecidos são ignorados na leitura). */
export function resolvePublicInvitePageConfig(raw: unknown): PublicInvitePageConfig & typeof DEFAULT_PUBLIC_INVITE_PAGE_CONFIG {
  const base = { ...DEFAULT_PUBLIC_INVITE_PAGE_CONFIG };
  if (!isPlainObject(raw)) return base;
  const keys = Object.keys(DEFAULT_PUBLIC_INVITE_PAGE_CONFIG) as (keyof PublicInvitePageConfig)[];
  for (const k of keys) {
    if (raw[k] === undefined || raw[k] === null) continue;
    if (k === "showCountdown") {
      if (typeof raw[k] === "boolean") (base as Record<string, unknown>)[k] = raw[k];
      continue;
    }
    if (typeof raw[k] === "string" && String(raw[k]).trim() !== "") {
      (base as Record<string, unknown>)[k] = raw[k];
    }
  }
  return base;
}
