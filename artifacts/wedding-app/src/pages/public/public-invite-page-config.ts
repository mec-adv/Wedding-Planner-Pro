/**
 * Conteúdo e aparência editáveis da página pública do convite (JSON em `public_invite_templates.config`).
 */

export type PublicInviteLayout = "classic" | "botanico";

export type BotanicoPadrinho = { name: string; photoUrl: string };
export type BotanicoFaqItem = { q: string; a: string };

export type PublicInvitePageConfig = {
  /** Layout da página pública. `botanico` = modelo floral completo (padrão). */
  layout?: PublicInviteLayout;
  /** Iniciais no menu (ex.: R & M) */
  navInitials?: string;
  historiaTitle?: string;
  historiaBody?: string;
  historiaSince?: string;
  /** Linha acima dos nomes no hero (ex.: Vamos nos casar) */
  heroSubtitle?: string;
  /** Nome do local da cerimônia (se vazio, usa o local cadastrado no casamento) */
  cerimoniaLocalNome?: string;
  /** URL do iframe do Google Maps (embed) */
  mapEmbedUrl?: string;
  /** Texto do horário na seção da cerimônia (se vazio, deriva da data do casamento) */
  horarioCerimoniaText?: string;
  eventoBlocoDicasTitle?: string;
  dicaTrajeTitle?: string;
  dicaTrajeBody?: string;
  dicaEstacionamentoTitle?: string;
  dicaEstacionamentoBody?: string;
  dicaCriancasTitle?: string;
  dicaCriancasBody?: string;
  padrinhosTitle?: string;
  /** Fotos e nomes dos padrinhos (cards na ordem exibida) */
  padrinhos?: BotanicoPadrinho[];
  /** Vídeo de fundo do hero (MP4). Se vazio, usa apenas imagem. */
  heroVideoUrl?: string;
  /** Imagem de capa / poster do hero e fallback do vídeo */
  heroPosterImageUrl?: string;
  countdownSecondLabel?: string;
  /** Texto abaixo do título da lista de presentes */
  listaPresentesIntro?: string;
  giftsPresentesDisclaimer?: string;
  giftsVerPresentesButton?: string;
  /** URL da página externa de lista de presentes (ex.: presentes.html ou URL absoluta) */
  giftsExternalPageUrl?: string;
  faqTitle?: string;
  faqItems?: BotanicoFaqItem[];
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

/** Valores padrão do layout floral (index_botanico); sobrescrevem chaves compartilhadas com o modelo clássico. */
export const DEFAULT_BOTANICO_PAGE_CONFIG = {
  layout: "botanico" as const,
  navInitials: "R & M",
  historiaTitle: "Nossa História",
  historiaBody:
    '"Num instante em que o peso do world fazia o sentido da vida parecer frágil e distante, os caminhos de Rodrigo e Millena se cruzaram. Não foi apenas um esbarrão do destino, mas o encontro de duas almas que, cansadas de caminhar no vazio, finalmente encontraram um porto seguro no olhar uma da outra. Naquele abraço, o desânimo deu lugar ao despertar: eles redescobriram a capacidade de amar e, com a coragem de quem já muito esperou, decidiram transformar esse encontro na mais linda e concreta realidade."',
  historiaSince: "Desde 17/02/2019",
  heroSubtitle: "Vamos nos casar",
  cerimoniaLocalNome: "Capela Rainha da Paz",
  mapEmbedUrl:
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3839.821147050519!2d-47.9358245!3d-15.760635!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x935a3a5f42969911%3A0xe9c323f46f4886cc!2sCapela%20Militar%20Rainha%20da%20Paz!5e0!3m2!1spt-BR!2sbr!4v1716584000000!5m2!1spt-BR!2sbr",
  horarioCerimoniaText: "",
  eventoBlocoDicasTitle: "Dicas Importantes",
  dicaTrajeTitle: "Traje Sugerido",
  dicaTrajeBody:
    "Nenhuma exigência formal de cor, mas sugerimos utilizar o conveniente para uma igreja.",
  dicaEstacionamentoTitle: "Haverá Estacionamento",
  dicaEstacionamentoBody:
    "O local conta com estacionamento privativo e gratuito para todos os convidados.",
  dicaCriancasTitle: "Para as Crianças",
  dicaCriancasBody: "Na recepção teremos piscina e brinquedos para que os pequenos aproveitem o dia.",
  padrinhosTitle: "Nossos Padrinhos",
  padrinhos: [
    {
      name: "Guna e Suzi",
      photoUrl: "https://images.unsplash.com/photo-1583939003579-730e3918a45a?w=400&h=400&fit=crop",
    },
    {
      name: "Osvaldo e Idelma",
      photoUrl: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&h=400&fit=crop",
    },
    {
      name: "Lincon e Priscila",
      photoUrl: "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400&h=400&fit=crop",
    },
    {
      name: "Arthur e Melissa",
      photoUrl: "https://images.unsplash.com/photo-1522673607200-1648832cee77?w=400&h=400&fit=crop",
    },
    {
      name: "Fábio e Rosana",
      photoUrl: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=400&h=400&fit=crop",
    },
  ] as BotanicoPadrinho[],
  heroVideoUrl:
    "https://player.vimeo.com/external/442118331.sd.mp4?s=74f1146be8c991443689f074744d2d48c08169e6&profile_id=164&oauth2_token_id=57447761",
  heroPosterImageUrl:
    "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop",
  countdownSecondLabel: "Segundos",
  listaPresentesIntro: "Sua presença é o nosso maior presente!",
  giftsPresentesDisclaimer:
    "Os presentes são fictícios. Para nos presentear, basta escolher os itens e clicar no botão abaixo.",
  giftsVerPresentesButton: "Ver Presentes 🎁",
  giftsExternalPageUrl: "presentes.html",
  rsvpSectionTitle: "Confirmação de Presença",
  rsvpSectionSubtitle: "Será uma alegria contar com você. Confirme até 08/05/2026.",
  rsvpSuccessTitle: "Obrigado!",
  rsvpSuccessMessage: "Sua presença foi confirmada. Nos vemos em breve!",
  seusDadosTitle: "Seus Dados",
  countdownMinLabel: "Minutos",
  faqTitle: "Perguntas Frequentes",
  faqItems: [
    {
      q: "Haverá estacionamento no local?",
      a: "Sim, a Capela Rainha da Paz possui estacionamento gratuito para os convidados.",
    },
    {
      q: "Crianças são bem-vindas?",
      a: "Com certeza! Preparamos brinquedos e piscina para que elas aproveitem o dia conosco.",
    },
  ] as BotanicoFaqItem[],
  blockCerimoniaTitle: "A Cerimônia",
  blockEventoTitle: "Dicas Importantes",
  primaryColor: "#2C5F7A",
  backgroundColor: "#F4F9FD",
  patternDotColor: "#2C5F7A",
  textColor: "#2E3A42",
  heroTagline: "Vamos nos casar",
  giftsTagline: "Sua presença é o nosso maior presente!",
  adicionarAcompanhanteLabel: "+ Adicionar Acompanhante",
} satisfies Partial<PublicInvitePageConfig> & { layout: PublicInviteLayout; padrinhos: BotanicoPadrinho[]; faqItems: BotanicoFaqItem[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPadrinhoList(v: unknown): v is BotanicoPadrinho[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  return v.every(
    (item) =>
      isPlainObject(item) &&
      typeof item.name === "string" &&
      typeof item.photoUrl === "string" &&
      item.name.trim() !== "" &&
      item.photoUrl.trim() !== "",
  );
}

function isFaqList(v: unknown): v is BotanicoFaqItem[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  return v.every(
    (item) =>
      isPlainObject(item) &&
      typeof item.q === "string" &&
      typeof item.a === "string" &&
      item.q.trim() !== "" &&
      item.a.trim() !== "",
  );
}

export type ResolvedPublicInvitePageConfig = PublicInvitePageConfig &
  typeof DEFAULT_PUBLIC_INVITE_PAGE_CONFIG &
  typeof DEFAULT_BOTANICO_PAGE_CONFIG;

/** Mescla JSON salvo com os padrões (campos desconhecidos são ignorados na leitura). */
export function resolvePublicInvitePageConfig(raw: unknown): ResolvedPublicInvitePageConfig {
  const base = {
    ...DEFAULT_PUBLIC_INVITE_PAGE_CONFIG,
    ...DEFAULT_BOTANICO_PAGE_CONFIG,
  } as ResolvedPublicInvitePageConfig;
  if (!isPlainObject(raw)) return base;

  const stringKeys = Object.keys(DEFAULT_PUBLIC_INVITE_PAGE_CONFIG) as (keyof PublicInvitePageConfig)[];
  const botanicoStringKeys = Object.keys(DEFAULT_BOTANICO_PAGE_CONFIG).filter(
    (k) => k !== "padrinhos" && k !== "faqItems" && k !== "layout",
  ) as (keyof PublicInvitePageConfig)[];

  for (const k of stringKeys) {
    if (raw[k] === undefined || raw[k] === null) continue;
    if (k === "showCountdown") {
      if (typeof raw[k] === "boolean") (base as Record<string, unknown>)[k] = raw[k];
      continue;
    }
    if (typeof raw[k] === "string" && String(raw[k]).trim() !== "") {
      (base as Record<string, unknown>)[k] = raw[k];
    }
  }

  for (const k of botanicoStringKeys) {
    if (raw[k] === undefined || raw[k] === null) continue;
    if (typeof raw[k] === "string" && String(raw[k]).trim() !== "") {
      (base as Record<string, unknown>)[k] = raw[k];
    }
  }

  if (raw.layout === "classic" || raw.layout === "botanico") {
    base.layout = raw.layout;
  }

  if (isPadrinhoList(raw.padrinhos)) {
    base.padrinhos = raw.padrinhos;
  }
  if (isFaqList(raw.faqItems)) {
    base.faqItems = raw.faqItems;
  }

  return base;
}
