import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { CSSProperties } from "react";
import type { PublicInviteResponse, PublicInviteWedding } from "@workspace/api-client-react";
import type { ResolvedPublicInvitePageConfig } from "./public-invite-page-config";
import { BOTANICO_FLORAL_DEFS_RAW } from "@/assets/invite-botanico-assets";
import { BotanicoDeco } from "./botanico-deco";
import { PadrinhoFloralTop } from "./padrinho-floral-top";
import { resolveMapDisplay } from "./map-embed-url";
import { getSpaBaseHref, resolveMediaUrl } from "@/lib/api-url";

/** Primeiro nome para o hero/rodapé (ex.: "Millena Vieira Martins" → "Millena"). */
export function primeiroNome(nomeCompleto: string): string {
  const t = nomeCompleto.trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? "";
}

const BOTANICO_STYLE = `
html, body { margin: 0; padding: 0; background-color: #F4F9FD; }
html { scroll-behavior: smooth; }
.bg-pattern {
  position: fixed; top: 0; left: 0;
  width: 100%; height: 100%; z-index: -2;
  background:
    radial-gradient(ellipse 85% 50% at 50% 0%, rgba(127, 179, 211, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 70% 45% at 80% 100%, rgba(201, 150, 42, 0.06) 0%, transparent 50%),
    linear-gradient(180deg, #FAFCFE 0%, #F4F9FD 45%, #F0F7FC 100%);
}
.hero-video-container {
  position: absolute; inset: 0;
  width: 100%; height: 100%; overflow: hidden; z-index: 0;
}
.hero-video-container video {
  min-width: 100%; min-height: 100%;
  object-fit: cover; filter: brightness(0.52) contrast(1.02) saturate(1.05);
}
.hero-video-overlay {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(244,249,253,0.15) 40%, rgba(44,95,122,0.28) 100%);
}
nav.botanico-nav {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 1px 12px rgba(44, 95, 122, 0.08);
  border-bottom: 1px solid rgba(127, 179, 211, 0.25);
}
.hero-stack { position: relative; z-index: 0; }
.countdown-card { transition: transform 0.2s; }
.countdown-card:hover { transform: translateY(-3px); }
.padrinho-card .avatar-ring { transition: box-shadow 0.3s; }
.padrinho-card:hover .avatar-ring { box-shadow: 0 0 0 5px rgba(201, 150, 42, 0.35); }
details summary::-webkit-details-marker { display: none; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up { animation: fadeUp 0.8s ease both; }
/* Viewports baixos (ex.: 1366×768): tipografia maior; padding da seção um pouco menor para o bloco “respirar” menos vazio */
@media (max-height: 820px) {
  .hero-stack.hero-compact-tight {
    padding-top: 5.25rem !important;
    padding-bottom: 1.25rem !important;
  }
  .hero-stack.hero-compact-tight .hero-garland-slot { margin-bottom: 0.45rem !important; }
  .hero-stack.hero-compact-tight .hero-garland-slot img,
  .hero-stack.hero-compact-tight .hero-garland-slot svg { max-height: 66px !important; height: 66px !important; width: auto !important; }
  .hero-stack.hero-compact-tight .hero-subtitle { margin-bottom: 0.45rem !important; font-size: clamp(0.85rem, 1.75vw, 1.05rem) !important; letter-spacing: 0.13em !important; }
  .hero-stack.hero-compact-tight .hero-title { margin-bottom: 0.55rem !important; font-size: clamp(2.45rem, 4.6vw, 3.65rem) !important; line-height: 1.08 !important; }
  .hero-stack.hero-compact-tight .hero-date { margin-bottom: 0.95rem !important; padding: 0.5rem 1.25rem !important; font-size: clamp(1.05rem, 2.1vw, 1.3rem) !important; }
  .hero-stack.hero-compact-tight .hero-countdown { gap: 0.5rem !important; }
  .hero-stack.hero-compact-tight .hero-countdown .countdown-card {
    padding: 0.55rem 0.65rem !important; min-height: 0 !important;
    border-radius: 0.9rem !important;
  }
  .hero-stack.hero-compact-tight .hero-countdown .countdown-card span:first-child { font-size: clamp(1.65rem, 3vw, 2.05rem) !important; }
  .hero-stack.hero-compact-tight .hero-countdown .countdown-card span:last-child { font-size: 0.68rem !important; }
}
@media (max-height: 700px) {
  .hero-stack.hero-compact-tight {
    padding-top: 4.25rem !important;
    padding-bottom: 1rem !important;
  }
  .hero-stack.hero-compact-tight .hero-garland-slot img,
  .hero-stack.hero-compact-tight .hero-garland-slot svg { max-height: 54px !important; height: 54px !important; }
  .hero-stack.hero-compact-tight .hero-title { font-size: clamp(2.15rem, 4vw, 3.1rem) !important; }
  .hero-stack.hero-compact-tight .hero-countdown .countdown-card span:first-child { font-size: clamp(1.45rem, 2.7vw, 1.85rem) !important; }
}
`;

function ceremonyIso(w: PublicInviteWedding | undefined): string | undefined {
  if (!w) return undefined;
  const d = w.religiousCeremonyAt ?? w.civilCeremonyAt ?? w.date;
  if (!d) return undefined;
  const t = new Date(d as Date | string).getTime();
  return Number.isFinite(t) ? new Date(d as Date | string).toISOString() : undefined;
}

function formatCeremonyDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

function formatCeremonyTime(iso: string | undefined, override: string): string {
  if (override.trim()) return override.trim();
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatFooterDots(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const y = d.getFullYear();
  return `${day} • ${month} • ${y}`;
}

export type PublicInviteBotanicoProps = {
  cfg: ResolvedPublicInvitePageConfig;
  wedding: PublicInviteWedding | undefined;
  bride: string;
  groom: string;
  invite: PublicInviteResponse;
  heroDateLine: string;
  targetMs: number | null;
  countdown: { days: number; hours: number; minutes: number; seconds: number; passed: boolean };
  companionRows: { name: string; age: string; phoneDigits: string }[];
  setCompanionRows: Dispatch<SetStateAction<{ name: string; age: string; phoneDigits: string }[]>>;
  rsvpSaved: boolean;
  submitBotanicoRsvp: (data: { mainName: string; mainPhoneDigits: string; mainAge: string }) => void | Promise<void>;
  patchRsvpPending: boolean;
};

export function PublicInviteBotanico({
  cfg,
  wedding,
  bride,
  groom,
  invite,
  heroDateLine,
  targetMs,
  countdown,
  companionRows,
  setCompanionRows,
  rsvpSaved,
  submitBotanicoRsvp,
  patchRsvpPending,
}: PublicInviteBotanicoProps) {
  const iso = ceremonyIso(wedding);
  const localNome = (cfg.cerimoniaLocalNome ?? "").trim() || wedding?.venue || "—";
  const mapUrl = (cfg.mapEmbedUrl ?? "").trim();
  const mapDisplay = resolveMapDisplay(mapUrl);
  const primary = cfg.primaryColor;
  const noivaPrimeiro = primeiroNome(bride);
  const noivoPrimeiro = primeiroNome(groom);
  const heroNomesLinha = `${noivoPrimeiro} & ${noivaPrimeiro}`;
  const giftsSoonHref = `${getSpaBaseHref()}presentes-em-breve.html`;

  const [mainName, setMainName] = useState("");
  const [mainPhone, setMainPhone] = useState("");
  const [mainAge, setMainAge] = useState("");

  useEffect(() => {
    if (invite.guest?.name) {
      setMainName((prev) => (prev.trim() === "" ? invite.guest!.name! : prev));
    }
  }, [invite.guest?.name]);

  const inputFieldClass =
    "w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#7FB3D3]/40 bg-white text-[#2E3A42] placeholder:text-gray-400";

  const rootStyle: CSSProperties = {
    ["--invite-primary" as string]: primary,
    color: cfg.textColor,
    fontFamily: "'Lato', sans-serif",
  };

  const bgTexture = resolveMediaUrl((cfg.botanicoBgTextureUrl ?? "").trim());

  useEffect(() => {
    document.title = heroNomesLinha || "Casamento";
  }, [heroNomesLinha]);

  const padrinhos = cfg.padrinhos?.length ? cfg.padrinhos : [];

  return (
    <div className="font-sans antialiased min-h-screen text-[#2E3A42]" style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: BOTANICO_STYLE }} />
      <div style={{ lineHeight: 0, fontSize: 0 }} dangerouslySetInnerHTML={{ __html: BOTANICO_FLORAL_DEFS_RAW }} />

      <div
        className="bg-pattern"
        style={
          bgTexture
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(244,249,253,0.85) 100%), url(${bgTexture})`,
                backgroundSize: "cover, cover",
                backgroundPosition: "center, center",
                backgroundRepeat: "no-repeat, no-repeat",
              }
            : undefined
        }
      />

      <nav className="botanico-nav fixed top-0 left-0 right-0 z-50 w-full">
        <div className="relative max-w-6xl mx-auto w-full px-6 py-4 flex min-h-[56px] items-center justify-center">
          {/* Monograma / logo do casal (à esquerda) */}
          {cfg.navLogoUrl ? (
            <div
              className="absolute left-6 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center"
              style={{
                height: 56,
                width: "auto",
                borderRadius: 8,
                overflow: "hidden",
                background: "rgba(255,255,255,0.10)",
                padding: "2px 4px",
              }}
            >
              <img
                src={resolveMediaUrl(cfg.navLogoUrl)}
                alt={cfg.navInitials ?? "monograma"}
                style={{ height: 50, width: "auto", objectFit: "contain", display: "block" }}
              />
            </div>
          ) : (
            <div
              className="absolute left-6 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center drop-shadow-lg"
              style={{ width: 82, height: 58 }}
            >
              <svg width="82" height="58" viewBox="0 0 82 58" fill="none" aria-hidden className="absolute inset-0">
                <use href="#roseYellowSm" x="0" y="19" width="22" height="22" opacity="0.95"/>
                <use href="#roseYellowSm" x="60" y="19" width="22" height="22" opacity="0.95"/>
                <use href="#leafSm" x="3" y="6" width="15" height="22" transform="rotate(-22 10 17)" opacity="0.9"/>
                <use href="#leafSm" x="64" y="6" width="15" height="22" transform="rotate(22 71 17)" opacity="0.9"/>
                <ellipse cx="41" cy="29" rx="24" ry="19" stroke="rgba(201,150,42,0.85)" strokeWidth="1.4" fill="rgba(127,179,211,0.15)"/>
                <ellipse cx="41" cy="29" rx="20.5" ry="15.5" stroke="rgba(201,150,42,0.4)" strokeWidth="0.7" fill="none"/>
                <path d="M36 11 Q41 9 46 11" stroke="rgba(201,150,42,0.85)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                <circle cx="41" cy="9.5" r="1.6" fill="rgba(201,150,42,0.90)"/>
                <path d="M36 47 Q41 49 46 47" stroke="rgba(201,150,42,0.85)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                <circle cx="41" cy="48.5" r="1.6" fill="rgba(201,150,42,0.90)"/>
              </svg>
              <span
                className="relative text-[14px] font-semibold tracking-[0.13em] text-[#2C5F7A]"
                style={{ fontFamily: "'Cormorant Garamond', serif", zIndex: 1 }}
              >
                {cfg.navInitials}
              </span>
            </div>
          )}
          <div className="hidden md:flex absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 items-center gap-3 text-[10px] uppercase tracking-widest font-bold text-[#3d5260] lg:gap-6 lg:text-xs">
            <a href="#inicio" className="transition hover:text-[#2C5F7A]">
              Início
            </a>
            <a href="#historia" className="transition hover:text-[#2C5F7A]">
              História
            </a>
            <a href="#evento" className="transition hover:text-[#2C5F7A]">
              O Evento
            </a>
            <a href="#padrinhos" className="transition hover:text-[#2C5F7A]">
              Padrinhos
            </a>
            <a href="#presentes" className="transition hover:text-[#2C5F7A]">
              Presentes
            </a>
            <a href="#rsvp" className="transition hover:text-[#2C5F7A]">
              RSVP
            </a>
          </div>
        </div>
        <div className="md:hidden border-t border-[#D9EAF3]/80 px-3 py-2 bg-white/95">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-widest font-bold text-[#3d5260]">
            <a href="#inicio" className="transition hover:text-[#2C5F7A]">Início</a>
            <a href="#historia" className="transition hover:text-[#2C5F7A]">História</a>
            <a href="#evento" className="transition hover:text-[#2C5F7A]">O Evento</a>
            <a href="#padrinhos" className="transition hover:text-[#2C5F7A]">Padrinhos</a>
            <a href="#presentes" className="transition hover:text-[#2C5F7A]">Presentes</a>
            <a href="#rsvp" className="transition hover:text-[#2C5F7A]">RSVP</a>
          </div>
        </div>
      </nav>

      <section
        id="inicio"
        className="hero-stack hero-compact-tight relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-4 pt-[7.5rem] pb-6 sm:pt-24 sm:pb-8 md:pt-24 md:pb-9"
      >
        <div
          className="hero-video-container"
          style={{
            backgroundImage: (() => {
              const u = resolveMediaUrl((cfg.heroPosterImageUrl || wedding?.coverImageUrl || "").trim());
              const grad = "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))";
              return u ? `${grad}, url(${u})` : "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.55))";
            })(),
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {(cfg.heroVideoUrl ?? "").trim() ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={
                resolveMediaUrl((cfg.heroPosterImageUrl || wedding?.coverImageUrl || "").trim()) || undefined
              }
            >
              <source src={resolveMediaUrl((cfg.heroVideoUrl ?? "").trim())} type="video/mp4" />
            </video>
          ) : null}
        </div>
        <div className="hero-video-overlay" aria-hidden />

        <div className="relative z-10 w-full max-w-4xl text-white px-2 sm:px-4 fade-up">
          <div className="hero-garland-slot flex justify-center mb-2 sm:mb-3 md:mb-3.5">
            <BotanicoDeco
              cfg={cfg}
              rasterKey="botanicoHeroGarlandUrl"
              symbolId="heroGarland"
              vbW={520}
              vbH={90}
              className="hero-garland w-full max-w-[min(100%,520px)] h-[52px] sm:h-[64px] md:h-[76px] lg:h-[84px] object-contain object-bottom"
              loading="eager"
            />
          </div>

          <p className="hero-subtitle text-base sm:text-lg md:text-xl lg:text-3xl mb-2 sm:mb-2.5 md:mb-3 tracking-widest font-light uppercase text-white drop-shadow-md">
            Vamos nos casar
          </p>
          <h1
            className="hero-title text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-8xl mb-3 sm:mb-4 md:mb-5 lg:mb-6 drop-shadow-2xl text-white leading-[1.05] px-1"
            style={{ fontFamily: "'Cinzel', 'Cormorant Garamond', serif" }}
          >
            {heroNomesLinha}
          </h1>
          <div
            className="hero-date bg-white/85 backdrop-blur-sm rounded-full px-4 py-2 sm:px-7 sm:py-2.5 md:px-9 md:py-3 inline-block border border-white/60 text-lg sm:text-xl md:text-2xl lg:text-3xl mb-5 sm:mb-6 md:mb-8 lg:mb-9 text-[#2C5F7A] shadow-sm max-w-[95vw]"
            style={{ fontFamily: "'Cinzel', 'Cormorant Garamond', serif" }}
          >
            {heroDateLine || "—"}
          </div>

          <div
            id="countdown"
            className="hero-countdown mx-auto flex max-w-full flex-wrap sm:flex-nowrap justify-center gap-2.5 sm:gap-4 md:gap-6 lg:gap-8"
          >
            {targetMs == null ? null : countdown.passed ? (
              <p className="text-2xl text-white drop-shadow-md" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {cfg.mensagemAposCerimonia}
              </p>
            ) : cfg.showCountdown ? (
              <>
                <div className="countdown-card bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 md:p-7 w-[calc(50%-0.25rem)] min-w-[4.5rem] max-w-[8rem] sm:w-24 sm:max-w-none md:w-36 flex-1 sm:flex-initial shadow-2xl border-b-4 border-[#D9EAF3]">
                  <span
                    className="block text-2xl sm:text-3xl md:text-5xl font-bold font-serif tabular-nums leading-none"
                    style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}
                  >
                    {countdown.days}
                  </span>
                  <span className="text-[0.7rem] sm:text-[0.75rem] uppercase tracking-tighter text-gray-500 leading-tight mt-1.5 block">
                    {cfg.countdownDayLabel}
                  </span>
                </div>
                <div className="countdown-card bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 md:p-7 w-[calc(50%-0.25rem)] min-w-[4.5rem] max-w-[8rem] sm:w-24 sm:max-w-none md:w-36 flex-1 sm:flex-initial shadow-2xl border-b-4 border-[#D9EAF3]">
                  <span
                    className="block text-2xl sm:text-3xl md:text-5xl font-bold font-serif tabular-nums leading-none"
                    style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}
                  >
                    {countdown.hours}
                  </span>
                  <span className="text-[0.7rem] sm:text-[0.75rem] uppercase tracking-tighter text-gray-500 leading-tight mt-1.5 block">
                    {cfg.countdownHourLabel}
                  </span>
                </div>
                <div className="countdown-card bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 md:p-7 w-[calc(50%-0.25rem)] min-w-[4.5rem] max-w-[8rem] sm:w-24 sm:max-w-none md:w-36 flex-1 sm:flex-initial shadow-2xl border-b-4 border-[#D9EAF3]">
                  <span
                    className="block text-2xl sm:text-3xl md:text-5xl font-bold font-serif tabular-nums leading-none"
                    style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}
                  >
                    {countdown.minutes}
                  </span>
                  <span className="text-[0.7rem] sm:text-[0.75rem] uppercase tracking-tighter text-gray-500 leading-tight mt-1.5 block">
                    {cfg.countdownMinLabel}
                  </span>
                </div>
                <div className="countdown-card bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 md:p-7 w-[calc(50%-0.25rem)] min-w-[4.5rem] max-w-[8rem] sm:w-24 sm:max-w-none md:w-36 flex-1 sm:flex-initial shadow-2xl border-b-4 border-[#C9962A]">
                  <span
                    className="block text-2xl sm:text-3xl md:text-5xl font-bold font-serif tabular-nums leading-none"
                    style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}
                  >
                    {countdown.seconds}
                  </span>
                  <span className="text-[0.7rem] sm:text-[0.75rem] uppercase tracking-tighter text-gray-500 leading-tight mt-1.5 block">
                    {cfg.countdownSecondLabel}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section id="historia" className="py-24 px-6 relative overflow-hidden" style={{ backgroundColor: "#F4F9FD" }}>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="flex justify-center mb-8">
            <BotanicoDeco
              cfg={cfg}
              rasterKey="botanicoDividerUrl"
              symbolId="floralDivider"
              vbW={340}
              vbH={60}
              className="w-full max-w-[340px] h-[55px] object-contain"
            />
          </div>

          <h2 className="font-serif text-5xl mb-10" style={{ color: primary, fontFamily: "'Cinzel', 'Cormorant Garamond', serif" }}>
            {cfg.historiaTitle}
          </h2>

          <div
            className="p-10 rounded-3xl border-l-8 italic text-xl leading-relaxed text-gray-700 shadow-inner relative overflow-hidden border border-[#D9EAF3]/80"
            style={{ backgroundColor: "#EBF5FC", borderLeftColor: "#C9962A" }}
          >
            {cfg.historiaBody}
          </div>

          <p className="mt-8 font-bold uppercase tracking-widest text-sm" style={{ color: primary }}>
            {cfg.historiaSince}
          </p>
        </div>
      </section>

      <section id="evento" className="py-24 px-6 relative overflow-hidden" style={{ backgroundColor: "#EBF4FA" }}>
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-8">
              <BotanicoDeco
                cfg={cfg}
                rasterKey="botanicoDividerUrl"
                symbolId="floralDivider"
                vbW={340}
                vbH={60}
                className="w-full max-w-[340px] h-[55px] object-contain"
              />
            </div>
            <h2 className="font-serif text-5xl" style={{ color: primary, fontFamily: "'Cinzel', 'Cormorant Garamond', serif" }}>
              {cfg.sectionGrandeDiaTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="bg-white p-10 rounded-3xl shadow-xl border-t-4 relative" style={{ borderTopColor: "#7FB3D3" }}>
              <h3 className="font-serif text-3xl mb-8 border-b pb-4" style={{ color: primary, fontFamily: "'Cormorant Garamond', serif", borderColor: "#D9EAF3" }}>
                {cfg.blockCerimoniaTitle}
              </h3>
              <div className="space-y-6 mb-8">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: "#D9EAF3", color: primary }}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm uppercase font-bold text-gray-400">{cfg.localLabel}</p>
                    <p className="text-lg font-bold text-gray-800">{localNome}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: "#D9EAF3", color: primary }}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm uppercase font-bold text-gray-400">{cfg.dataLabel}</p>
                    <p className="text-lg font-bold text-gray-800">{formatCeremonyDate(iso)}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full flex-shrink-0" style={{ backgroundColor: "#D9EAF3", color: primary }}>
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm uppercase font-bold text-gray-400">Horário</p>
                    <p className="text-lg font-bold text-gray-800">{formatCeremonyTime(iso, cfg.horarioCerimoniaText ?? "")}</p>
                  </div>
                </div>
              </div>
              {mapDisplay?.mode === "iframe" ? (
                <div className="rounded-2xl overflow-hidden shadow-md h-64 border-2 border-[#A8C9E0]">
                  <iframe src={mapDisplay.src} width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" title="Mapa do local" />
                </div>
              ) : mapDisplay?.mode === "external" ? (
                <div
                  className="rounded-2xl overflow-hidden shadow-md min-h-[16rem] border-2 border-[#A8C9E0] flex flex-col items-center justify-center gap-4 p-8 text-center"
                  style={{ backgroundColor: "#EBF5FC" }}
                >
                  <p className="text-sm text-gray-600 leading-relaxed">
                    O link colado é de compartilhamento do Google Maps e não pode ser exibido embutido aqui. Use o botão
                    abaixo para abrir o mapa, ou em{" "}
                    <strong className="text-[#2C5F7A]">Google Maps → Compartilhar → Incorporar um mapa</strong> copie
                    apenas o endereço que começa com{" "}
                    <code className="text-xs bg-white px-1 py-0.5 rounded border border-gray-200">https://www.google.com/maps/embed?...</code>
                  </p>
                  <a
                    href={mapDisplay.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-bold text-white shadow-md transition hover:brightness-110"
                    style={{ backgroundColor: "#2C5F7A" }}
                  >
                    Abrir localização no Google Maps
                  </a>
                </div>
              ) : null}
            </div>

            <div className="bg-white p-10 rounded-3xl shadow-xl border-t-8 relative" style={{ borderTopColor: "#C9962A" }}>
              <h3 className="font-serif text-3xl mb-8 border-b pb-4 flex items-center" style={{ color: primary, fontFamily: "'Cormorant Garamond', serif", borderColor: "#D9EAF3" }}>
                <svg className="mr-3 flex-shrink-0" width="28" height="28" fill="none" stroke="#C9962A" strokeWidth="2" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                {cfg.eventoBlocoDicasTitle}
              </h3>
              <div className="space-y-8">
                <div>
                  <h4 className="font-bold uppercase text-sm mb-2 tracking-widest" style={{ color: primary }}>
                    {cfg.dicaTrajeTitle}
                  </h4>
                  <p className="text-gray-600 leading-relaxed">{cfg.dicaTrajeBody}</p>
                </div>
                <div className="p-6 rounded-2xl border-l-4 border-[#2C5F7A]" style={{ backgroundColor: "#EBF5FC" }}>
                  <h4 className="font-bold mb-2" style={{ color: primary }}>
                    {cfg.dicaEstacionamentoTitle}
                  </h4>
                  <p className="text-gray-600 text-sm">{cfg.dicaEstacionamentoBody}</p>
                </div>
                <div className="p-6 rounded-2xl border-l-4 border-[#C9962A]" style={{ backgroundColor: "#FBF5E6" }}>
                  <h4 className="font-bold text-[#C9962A] mb-2">{cfg.dicaCriancasTitle}</h4>
                  <p className="text-gray-600 text-sm">{cfg.dicaCriancasBody}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="padrinhos" className="py-24 px-6 overflow-hidden relative" style={{ backgroundColor: "#F4F9FD" }}>
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="flex justify-center mb-8">
            <BotanicoDeco
              cfg={cfg}
              rasterKey="botanicoDividerUrl"
              symbolId="floralDivider"
              vbW={340}
              vbH={60}
              className="w-full max-w-[340px] h-[55px] object-contain"
            />
          </div>
          <h2 className="font-serif text-5xl mb-16" style={{ color: primary, fontFamily: "'Cinzel', 'Cormorant Garamond', serif" }}>
            {cfg.padrinhosTitle}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
            {padrinhos.map((p, i) => (
              <div key={`${p.name}-${i}`} className="group padrinho-card relative">
                <PadrinhoFloralTop variant={i} flourishUrl={cfg.botanicoPadrinhoFlourishUrl} />
                <div
                  className="avatar-ring w-56 h-56 rounded-full overflow-hidden border-4 shadow-xl mx-auto mb-4"
                  style={{ borderColor: "#C9962A", backgroundColor: "#D9EAF3" }}
                >
                  <img
                    src={resolveMediaUrl(p.photoUrl)}
                    alt={p.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-500 transform group-hover:scale-110"
                  />
                </div>
                <h3 className="font-serif text-2xl font-bold" style={{ color: primary, fontFamily: "'Cormorant Garamond', serif" }}>
                  {p.name}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="rsvp" className="py-24 px-6 relative overflow-hidden bg-white" style={{ borderTop: "8px solid #C9962A" }}>
        <div className="max-w-3xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-8">
              <BotanicoDeco
                cfg={cfg}
                rasterKey="botanicoDividerUrl"
                symbolId="floralDivider"
                vbW={340}
                vbH={60}
                className="w-full max-w-[340px] h-[55px] object-contain"
              />
            </div>
            <h2 className="font-serif text-5xl mb-4" style={{ color: primary, fontFamily: "'Cinzel', 'Cormorant Garamond', serif" }}>
              {cfg.rsvpSectionTitle}
            </h2>
            <p className="text-lg text-gray-600 italic">{cfg.rsvpSectionSubtitle}</p>
          </div>

          <div
            id="rsvp-success"
            className={rsvpSaved ? "text-center p-12 rounded-3xl border-2 shadow-xl mb-8 bg-[#EBF5FC] border-[#2C5F7A] text-gray-800" : "hidden"}
          >
            <h3 className="font-serif text-4xl text-[#2C5F7A] mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              {cfg.rsvpSuccessTitle}
            </h3>
            <p className="text-lg">{cfg.rsvpSuccessMessage}</p>
          </div>

          {!rsvpSaved ? (
            <form
              id="rsvp-form"
              className="space-y-8 p-8 md:p-12 rounded-3xl border shadow-sm"
              style={{ backgroundColor: "rgba(235,244,250,0.5)", borderColor: "#D9EAF3" }}
              onSubmit={(e) => {
                e.preventDefault();
                void submitBotanicoRsvp({ mainName, mainPhoneDigits: mainPhone, mainAge });
              }}
            >
              <div>
                <h3 className="font-serif text-2xl mb-6 border-b pb-2" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary, borderColor: "rgba(44,95,122,0.1)" }}>
                  {cfg.seusDadosTitle}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="mainName" className="block text-sm mb-1 font-bold" style={{ color: primary }}>
                      {cfg.convidadoLabel}
                    </label>
                    <input
                      id="mainName"
                      type="text"
                      required
                      className={inputFieldClass}
                      value={mainName}
                      onChange={(e) => setMainName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="mainPhone" className="block text-sm mb-1 font-bold" style={{ color: primary }}>
                      WhatsApp (com DDD)
                    </label>
                    <input
                      id="mainPhone"
                      type="tel"
                      required
                      placeholder="(00) 00000-0000"
                      className={inputFieldClass}
                      value={mainPhone}
                      onChange={(e) => setMainPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="mainAge" className="block text-sm mb-1 font-bold" style={{ color: primary }}>
                      Idade
                    </label>
                    <input
                      id="mainAge"
                      type="number"
                      required
                      min={0}
                      className={inputFieldClass}
                      value={mainAge}
                      onChange={(e) => setMainAge(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div id="companions-container" className="space-y-6">
                {companionRows.map((row, i) => (
                  <div key={i} className="p-6 bg-white rounded-2xl shadow-sm relative" style={{ borderLeft: "8px solid #C9962A" }}>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-serif font-bold text-xl italic" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                        {cfg.acompanhanteLabel} {i + 1}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setCompanionRows(companionRows.filter((_, j) => j !== i))}
                        className="text-red-400 text-xs uppercase font-bold"
                      >
                        {cfg.removerLabel}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-1 font-bold">Nome Completo</label>
                        <input
                          type="text"
                          className={inputFieldClass}
                          value={row.name}
                          onChange={(e) => {
                            const next = [...companionRows];
                            next[i] = { ...next[i], name: e.target.value };
                            setCompanionRows(next);
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 font-bold">Idade</label>
                        <input
                          type="number"
                          min={0}
                          className={inputFieldClass}
                          value={row.age}
                          onChange={(e) => {
                            const next = [...companionRows];
                            next[i] = { ...next[i], age: e.target.value };
                            setCompanionRows(next);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setCompanionRows([...companionRows, { name: "", age: "", phoneDigits: "" }])}
                  className="bg-white font-bold px-8 py-3 rounded-full text-sm uppercase tracking-widest border-2 transition-all text-[#2C5F7A] border-[#2C5F7A] hover:bg-[#2C5F7A] hover:text-white"
                >
                  {cfg.adicionarAcompanhanteLabel}
                </button>
              </div>
              <div className="pt-6" style={{ borderTop: "1px solid rgba(44,95,122,0.1)" }}>
                <button
                  type="submit"
                  disabled={patchRsvpPending}
                  className="w-full text-white font-bold px-8 py-5 rounded-2xl uppercase tracking-widest text-lg shadow-lg transition hover:brightness-110 disabled:opacity-50"
                  style={{ backgroundColor: "#2C5F7A" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#7FB3D3";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#2C5F7A";
                  }}
                >
                  {patchRsvpPending ? "Enviando…" : cfg.ctaRsvp}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </section>

      <section id="presentes" className="py-24 px-6 text-center relative overflow-hidden" style={{ backgroundColor: "#EBF5FC" }}>
        <div className="max-w-3xl mx-auto p-12 bg-white rounded-3xl shadow-xl border-t-8 relative z-10" style={{ borderTopColor: "#C9962A" }}>
          <div className="flex justify-center mb-8">
            <BotanicoDeco
              cfg={cfg}
              rasterKey="botanicoDividerUrl"
              symbolId="floralDivider"
              vbW={340}
              vbH={60}
              className="w-full max-w-[340px] h-[55px] object-contain"
            />
          </div>
          <h2 className="font-serif text-5xl mb-6" style={{ color: primary, fontFamily: "'Cinzel', 'Cormorant Garamond', serif" }}>
            {cfg.giftsSectionTitle}
          </h2>
          <p className="text-xl mb-4 text-gray-700">{cfg.giftsTagline}</p>
          <p className="mb-8 text-gray-500 italic">{cfg.giftsPresentesDisclaimer}</p>
          <a
            href={giftsSoonHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-white px-10 py-5 rounded-2xl text-xl font-bold uppercase tracking-widest transition shadow-lg transform hover:-translate-y-1 hover:brightness-110"
            style={{ backgroundColor: "#C9962A" }}
          >
            {cfg.giftsVerPresentesButton}
          </a>
        </div>
      </section>

      <section className="py-24 px-6 max-w-4xl mx-auto bg-[#F4F9FD]">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-8">
            <BotanicoDeco
              cfg={cfg}
              rasterKey="botanicoDividerUrl"
              symbolId="floralDivider"
              vbW={340}
              vbH={60}
              className="w-full max-w-[340px] h-[55px] object-contain"
            />
          </div>
          <h2 className="font-serif text-4xl" style={{ color: primary, fontFamily: "'Cinzel', 'Cormorant Garamond', serif" }}>
            {cfg.faqTitle}
          </h2>
        </div>
        <div className="space-y-4">
          {(cfg.faqItems ?? []).map((item, i) => (
            <details key={i} className="group bg-white rounded-2xl shadow-sm border" style={{ borderColor: "#D9EAF3" }}>
              <summary className="p-6 cursor-pointer font-bold text-lg flex justify-between items-center list-none" style={{ color: primary }}>
                {item.q}
                <span className="text-[#C9962A] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="p-6 pt-0 text-gray-600" style={{ borderTop: "1px solid #D9EAF3" }}>
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      <footer className="text-center py-20 px-6 relative overflow-hidden border-t border-[#D9EAF3]" style={{ backgroundColor: "#E8F2FA", color: "#2E3A42" }}>
        <div className="flex justify-center mb-6 max-w-[400px] mx-auto opacity-90">
          <BotanicoDeco
            cfg={cfg}
            rasterKey="botanicoFooterGarlandUrl"
            symbolId="footerGarland"
            vbW={400}
            vbH={80}
            className="w-full h-[68px] object-contain"
          />
        </div>

        <p className="font-serif text-3xl mb-4 italic" style={{ fontFamily: "'Cinzel', 'Cormorant Garamond', serif", color: primary }}>
          {heroNomesLinha}
        </p>
        <p className="text-sm text-gray-500 uppercase tracking-widest">{formatFooterDots(iso)}</p>

        <div className="flex justify-center mt-6 opacity-70 max-w-[260px] mx-auto">
          <BotanicoDeco
            cfg={cfg}
            rasterKey="botanicoDividerUrl"
            symbolId="floralDivider"
            vbW={340}
            vbH={60}
            className="w-full h-[42px] object-contain"
          />
        </div>
      </footer>
    </div>
  );
}
