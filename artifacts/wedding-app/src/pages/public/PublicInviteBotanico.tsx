import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { CSSProperties } from "react";
import type { PublicInviteResponse, PublicInviteWedding } from "@workspace/api-client-react";
import type { ResolvedPublicInvitePageConfig } from "./public-invite-page-config";
import floralDefs from "./botanico-floral-defs.svg?raw";
import { PadrinhoFloralTop } from "./padrinho-floral-top";
import { resolveMapDisplay } from "./map-embed-url";

/** Primeiro nome para o hero/rodapé (ex.: "Millena Vieira Martins" → "Millena"). */
export function primeiroNome(nomeCompleto: string): string {
  const t = nomeCompleto.trim();
  if (!t) return "";
  return t.split(/\s+/)[0] ?? "";
}

const BOTANICO_STYLE = `
html, body { margin: 0; padding: 0; background-color: #0D1B2A; }
html { scroll-behavior: smooth; }
.bg-pattern {
  background-color: #F4F9FD;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cg opacity='0.07'%3E%3Cpath d='M50 95 Q48 75 50 55 Q52 35 50 15' stroke='%232C5F7A' stroke-width='1.5' fill='none'/%3E%3Cpath d='M50 70 Q36 60 26 54' stroke='%232C5F7A' stroke-width='1' fill='none'/%3E%3Cpath d='M50 70 Q64 60 74 54' stroke='%232C5F7A' stroke-width='1' fill='none'/%3E%3Cpath d='M50 50 Q37 41 28 36' stroke='%232C5F7A' stroke-width='0.9' fill='none'/%3E%3Cpath d='M50 50 Q63 41 72 36' stroke='%232C5F7A' stroke-width='0.9' fill='none'/%3E%3Cellipse cx='24' cy='52' rx='8' ry='4' transform='rotate(-30 24 52)' fill='%233A7558'/%3E%3Cellipse cx='76' cy='52' rx='8' ry='4' transform='rotate(30 76 52)' fill='%233A7558'/%3E%3Cellipse cx='26' cy='34' rx='7' ry='3.5' transform='rotate(-20 26 34)' fill='%233A7558'/%3E%3Cellipse cx='74' cy='34' rx='7' ry='3.5' transform='rotate(20 74 34)' fill='%233A7558'/%3E%3Ccircle cx='50' cy='14' r='7' fill='%23F5C842'/%3E%3Ccircle cx='50' cy='14' r='3' fill='%23C9962A'/%3E%3Ccircle cx='25' cy='51' r='5' fill='%237FB3D3'/%3E%3Ccircle cx='75' cy='51' r='5' fill='%237FB3D3'/%3E%3Ccircle cx='27' cy='33' r='3.5' fill='%23F5C842' opacity='0.8'/%3E%3Ccircle cx='73' cy='33' r='3.5' fill='%23F5C842' opacity='0.8'/%3E%3C/g%3E%3C/svg%3E");
  background-size: 100px 100px;
  position: fixed; top: 0; left: 0;
  width: 100%; height: 100%; z-index: -2;
}
.hero-video-container {
  position: absolute; inset: 0;
  width: 100%; height: 100%; overflow: hidden; z-index: -1;
}
.hero-video-container video {
  min-width: 100%; min-height: 100%;
  object-fit: cover; filter: brightness(0.4);
}
.petals-container { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
.petal { position: absolute; animation: floatPetal linear infinite; opacity: 0; will-change: transform, opacity; }
@keyframes floatPetal {
  0%   { opacity: 0;   transform: translateY(-20px) rotate(0deg) translateX(0px); }
  8%   { opacity: 0.65; }
  50%  { transform: translateY(55vh) rotate(260deg) translateX(20px); }
  92%  { opacity: 0.40; }
  100% { opacity: 0;   transform: translateY(110vh) rotate(560deg) translateX(-40px); }
}
nav.botanico-nav {
  background: rgba(10, 18, 38, 0.96);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 20px rgba(0,0,0,0.4);
  border-bottom: 1.5px solid rgba(201,150,42,0.45);
}
.hero-stack { position: relative; z-index: 0; }
.countdown-card { transition: transform 0.2s; }
.countdown-card:hover { transform: translateY(-3px); }
.padrinho-card .avatar-ring { transition: box-shadow 0.3s; }
.padrinho-card:hover .avatar-ring { box-shadow: 0 0 0 5px rgba(245,200,66,0.45); }
details summary::-webkit-details-marker { display: none; }
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-up { animation: fadeUp 0.8s ease both; }
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

  const [mainName, setMainName] = useState("");
  const [mainPhone, setMainPhone] = useState("");
  const [mainAge, setMainAge] = useState("");

  useEffect(() => {
    if (invite.guest?.name) {
      setMainName((prev) => (prev.trim() === "" ? invite.guest!.name! : prev));
    }
  }, [invite.guest?.name]);

  const inputFieldClass =
    "w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none bg-white text-[#2E3A42] placeholder:text-gray-400";

  const rootStyle: CSSProperties = {
    ["--invite-primary" as string]: primary,
    color: cfg.textColor,
    fontFamily: "'Lato', sans-serif",
  };

  useEffect(() => {
    document.title = heroNomesLinha || "Casamento";
  }, [heroNomesLinha]);

  useEffect(() => {
    const container = document.getElementById("petals-container");
    if (!container) return;
    container.innerHTML = "";
    const shapes = [
      { w: 17, h: 11, r: "80% 0 80% 0",     color: "linear-gradient(135deg, #4A7FC1 0%, #1A2F6E 100%)" },
      { w: 16, h: 10, r: "70% 30% 70% 30%", color: "linear-gradient(135deg, #F0C030 0%, #9B6B00 100%)" },
      { w: 14, h: 9,  r: "60% 40% 80% 20%", color: "linear-gradient(120deg, #A0CDE0 0%, #4A7FC1 100%)" },
      { w: 13, h: 8,  r: "50% 50% 70% 30%", color: "linear-gradient(120deg, #F7D444 0%, #D4A017 100%)" },
      { w: 18, h: 11, r: "80% 20% 80% 20%", color: "linear-gradient(150deg, #6BAED6 0%, #2952A3 100%)" },
      { w: 12, h: 8,  r: "40% 60% 40% 60%", color: "linear-gradient(135deg, #FFF4C2 0%, #E8A820 100%)" },
      { w: 14, h: 10, r: "60% 60% 40% 40%", color: "linear-gradient(180deg, #4A7FC1 0%, #1A2F6E 100%)" },
      { w: 11, h: 7,  r: "50% 50% 60% 40%", color: "linear-gradient(135deg, #D0E8F8 0%, #6BAED6 100%)" },
    ];
    for (let i = 0; i < 36; i++) {
      const s = shapes[Math.floor(Math.random() * shapes.length)];
      const petal = document.createElement("div");
      petal.className = "petal";
      petal.style.cssText = `
        width:${s.w}px; height:${s.h}px;
        background:${s.color};
        border-radius:${s.r};
        left:${Math.random() * 100}vw;
        animation-duration:${12 + Math.random() * 10}s;
        animation-delay:${Math.random() * 18}s;
        box-shadow: inset -1px -1px 2px rgba(0,0,0,0.15), inset 1px 1px 2px rgba(255,255,255,0.3);
      `;
      container.appendChild(petal);
    }
  }, []);

  const padrinhos = cfg.padrinhos?.length ? cfg.padrinhos : [];

  return (
    <div className="text-[#2E3A42] font-sans antialiased min-h-screen" style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: BOTANICO_STYLE }} />
      <div style={{ lineHeight: 0, fontSize: 0 }} dangerouslySetInnerHTML={{ __html: floralDefs }} />

      <div className="bg-pattern" />

      <nav className="botanico-nav fixed top-0 left-0 right-0 z-50 w-full">
        <div className="max-w-6xl mx-auto w-full px-6 py-4 flex justify-between items-center">
          {/* Monograma botânico */}
          <div className="relative flex items-center justify-center drop-shadow-lg" style={{ width: 82, height: 58 }}>
            <svg width="82" height="58" viewBox="0 0 82 58" fill="none" aria-hidden className="absolute inset-0">
              {/* Rosas laterais */}
              <use href="#roseYellowSm" x="0" y="19" width="22" height="22" opacity="0.95"/>
              <use href="#roseYellowSm" x="60" y="19" width="22" height="22" opacity="0.95"/>
              {/* Folhas */}
              <use href="#leafSm" x="3" y="6" width="15" height="22" transform="rotate(-22 10 17)" opacity="0.9"/>
              <use href="#leafSm" x="64" y="6" width="15" height="22" transform="rotate(22 71 17)" opacity="0.9"/>
              {/* Oval externo */}
              <ellipse cx="41" cy="29" rx="24" ry="19" stroke="rgba(201,150,42,0.90)" strokeWidth="1.4" fill="rgba(0,0,0,0.28)"/>
              {/* Oval interno */}
              <ellipse cx="41" cy="29" rx="20.5" ry="15.5" stroke="rgba(201,150,42,0.42)" strokeWidth="0.7" fill="none"/>
              {/* Ornamento superior */}
              <path d="M36 11 Q41 9 46 11" stroke="rgba(201,150,42,0.85)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              <circle cx="41" cy="9.5" r="1.6" fill="rgba(201,150,42,0.90)"/>
              {/* Ornamento inferior */}
              <path d="M36 47 Q41 49 46 47" stroke="rgba(201,150,42,0.85)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
              <circle cx="41" cy="48.5" r="1.6" fill="rgba(201,150,42,0.90)"/>
            </svg>
            <span
              className="relative text-[14px] font-semibold tracking-[0.13em] text-white"
              style={{ fontFamily: "'Cormorant Garamond', serif", textShadow: '0 1px 4px rgba(0,0,0,0.65)', zIndex: 1 }}
            >
              {cfg.navInitials}
            </span>
          </div>
          <div className="hidden md:flex space-x-6 text-xs uppercase tracking-widest font-bold">
            <a href="#inicio" className="text-white drop-shadow-md transition hover:text-[#C9962A]">
              Início
            </a>
            <a href="#historia" className="text-white drop-shadow-md transition hover:text-[#C9962A]">
              História
            </a>
            <a href="#evento" className="text-white drop-shadow-md transition hover:text-[#C9962A]">
              O Evento
            </a>
            <a href="#padrinhos" className="text-white drop-shadow-md transition hover:text-[#C9962A]">
              Padrinhos
            </a>
            <a href="#presentes" className="text-white drop-shadow-md transition hover:text-[#C9962A]">
              Presentes
            </a>
            <a href="#rsvp" className="text-white drop-shadow-md transition hover:text-[#C9962A]">
              RSVP
            </a>
          </div>
        </div>
      </nav>

      <section id="inicio" className="hero-stack relative h-screen flex items-center justify-center text-center overflow-hidden">
        <div
          className="hero-video-container"
          style={{
            backgroundImage: (() => {
              const u = (cfg.heroPosterImageUrl || wedding?.coverImageUrl || "").trim();
              const grad = "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))";
              return u ? `${grad}, url(${u})` : "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.55))";
            })(),
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {(cfg.heroVideoUrl ?? "").trim() ? (
            <video autoPlay muted loop playsInline poster={cfg.heroPosterImageUrl || wedding?.coverImageUrl || undefined}>
              <source src={cfg.heroVideoUrl} type="video/mp4" />
            </video>
          ) : null}
        </div>
        <div className="petals-container" id="petals-container" />

        <div className="absolute left-0 bottom-0 pointer-events-none hidden lg:block opacity-55">
          <svg width="180" height="340" viewBox="0 0 200 380" aria-hidden>
            <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
          </svg>
        </div>
        <div className="absolute right-0 bottom-0 pointer-events-none hidden lg:block opacity-55 scale-x-[-1]">
          <svg width="180" height="340" viewBox="0 0 200 380" aria-hidden>
            <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
          </svg>
        </div>

        <div className="relative z-10 text-white p-6 max-w-4xl fade-up">
          <div className="flex justify-center mb-4">
            <svg width="100%" height="75" viewBox="0 0 520 90" className="max-w-[520px]" aria-hidden>
              <use href="#heroGarland" x="0" y="0" width="520" height="90" />
            </svg>
          </div>

          <p className="text-lg md:text-2xl mb-4 tracking-widest font-light uppercase">Vamos nos casar</p>
          <h1 className="text-6xl md:text-9xl mb-8 drop-shadow-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {heroNomesLinha}
          </h1>
          <div className="bg-white/10 backdrop-blur-md rounded-full px-8 py-3 inline-block border border-white/30 text-xl md:text-2xl mb-12" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {heroDateLine || "—"}
          </div>

          <div id="countdown" className="flex justify-center flex-wrap gap-4 md:gap-8">
            {targetMs == null ? null : countdown.passed ? (
              <p className="text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {cfg.mensagemAposCerimonia}
              </p>
            ) : cfg.showCountdown ? (
              <>
                <div className="countdown-card bg-white rounded-2xl p-4 md:p-6 w-20 md:w-32 shadow-2xl border-b-4 border-[#D9EAF3]">
                  <span className="block text-2xl md:text-4xl font-bold font-serif" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                    {countdown.days}
                  </span>
                  <span className="text-xs uppercase tracking-tighter text-gray-500">Dias</span>
                </div>
                <div className="countdown-card bg-white rounded-2xl p-4 md:p-6 w-20 md:w-32 shadow-2xl border-b-4 border-[#D9EAF3]">
                  <span className="block text-2xl md:text-4xl font-bold font-serif" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                    {countdown.hours}
                  </span>
                  <span className="text-xs uppercase tracking-tighter text-gray-500">Horas</span>
                </div>
                <div className="countdown-card bg-white rounded-2xl p-4 md:p-6 w-20 md:w-32 shadow-2xl border-b-4 border-[#D9EAF3]">
                  <span className="block text-2xl md:text-4xl font-bold font-serif" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                    {countdown.minutes}
                  </span>
                  <span className="text-xs uppercase tracking-tighter text-gray-500">Minutos</span>
                </div>
                <div className="countdown-card bg-white rounded-2xl p-4 md:p-6 w-20 md:w-32 shadow-2xl border-b-4 border-[#C9962A]">
                  <span className="block text-2xl md:text-4xl font-bold font-serif" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                    {countdown.seconds}
                  </span>
                  <span className="text-xs uppercase tracking-tighter text-gray-500">Segundos</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section id="historia" className="py-24 px-6 relative overflow-hidden" style={{ backgroundColor: "#F4F9FD" }}>
        <div className="absolute top-0 left-0 pointer-events-none hidden md:block opacity-35">
          <svg width="155" height="155" viewBox="0 0 160 160" aria-hidden>
            <use href="#cornerTL" x="0" y="0" width="160" height="160" />
          </svg>
        </div>
        <div className="absolute top-0 right-0 pointer-events-none hidden md:block opacity-35 scale-x-[-1]">
          <svg width="155" height="155" viewBox="0 0 160 160" aria-hidden>
            <use href="#cornerTL" x="0" y="0" width="160" height="160" />
          </svg>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="flex justify-center mb-8">
            <svg width="100%" height="55" viewBox="0 0 340 60" className="max-w-[340px]" aria-hidden>
              <use href="#floralDivider" x="0" y="0" width="340" height="60" />
            </svg>
          </div>

          <h2 className="font-serif text-5xl mb-10" style={{ color: primary, fontFamily: "'Cormorant Garamond', serif" }}>
            {cfg.historiaTitle}
          </h2>

          <div
            className="p-10 rounded-3xl border-l-8 border-[#C9962A] italic text-xl leading-relaxed text-gray-700 shadow-inner relative overflow-hidden"
            style={{ backgroundColor: "#EBF5FC", borderLeftColor: "#C9962A" }}
          >
            <div className="absolute -top-4 -right-4 pointer-events-none opacity-22">
              <svg width="110" height="130" viewBox="0 0 200 380" className="scale-[0.55] translate-x-[30px] -translate-y-[60px]" aria-hidden>
                <use href="#bouquetLeft" x="0" y="0" width="200" height="380" transform="scale(-1,1) translate(-200,0)" />
              </svg>
            </div>
            <div className="absolute -bottom-2 -left-2 pointer-events-none opacity-18">
              <svg width="80" height="100" viewBox="0 0 200 380" className="scale-[0.4] -translate-x-[100px] translate-y-[120px]" aria-hidden>
                <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
              </svg>
            </div>
            {cfg.historiaBody}
          </div>

          <p className="mt-8 font-bold uppercase tracking-widest text-sm text-[#C9962A]">{cfg.historiaSince}</p>
        </div>
      </section>

      <section id="evento" className="py-24 px-6 relative overflow-hidden" style={{ backgroundColor: "#EBF4FA" }}>
        <div className="absolute bottom-0 right-0 pointer-events-none hidden lg:block opacity-22 -rotate-[10deg] scale-x-[-1]">
          <svg width="160" height="300" viewBox="0 0 200 380" aria-hidden>
            <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
          </svg>
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="flex justify-center mb-8">
              <svg width="100%" height="55" viewBox="0 0 340 60" className="max-w-[340px]" aria-hidden>
                <use href="#floralDivider" x="0" y="0" width="340" height="60" />
              </svg>
            </div>
            <h2 className="font-serif text-5xl" style={{ color: primary, fontFamily: "'Cormorant Garamond', serif" }}>
              {cfg.sectionGrandeDiaTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="bg-white p-10 rounded-3xl shadow-xl border-t-4 border-[#7FB3D3] relative">
              <div className="absolute -top-5 -left-5 pointer-events-none opacity-30">
                <svg width="70" height="70" viewBox="0 0 160 160" aria-hidden>
                  <use href="#cornerTL" x="0" y="0" width="160" height="160" />
                </svg>
              </div>
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
                    <p className="text-lg font-bold">{localNome}</p>
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
                    <p className="text-lg font-bold">{formatCeremonyDate(iso)}</p>
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
                    <p className="text-lg font-bold">{formatCeremonyTime(iso, cfg.horarioCerimoniaText ?? "")}</p>
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

            <div className="bg-white p-10 rounded-3xl shadow-xl border-t-8 border-[#C9962A] relative">
              <div className="absolute -top-5 -right-5 pointer-events-none opacity-28 scale-x-[-1]">
                <svg width="70" height="70" viewBox="0 0 160 160" aria-hidden>
                  <use href="#cornerTL" x="0" y="0" width="160" height="160" />
                </svg>
              </div>
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
        <div className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:block opacity-25">
          <svg width="120" height="300" viewBox="0 0 200 380" aria-hidden>
            <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
          </svg>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:block opacity-25 scale-x-[-1]">
          <svg width="120" height="300" viewBox="0 0 200 380" aria-hidden>
            <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
          </svg>
        </div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="flex justify-center mb-8">
            <svg width="100%" height="55" viewBox="0 0 340 60" className="max-w-[340px]" aria-hidden>
              <use href="#floralDivider" x="0" y="0" width="340" height="60" />
            </svg>
          </div>
          <h2 className="font-serif text-5xl mb-16" style={{ color: primary, fontFamily: "'Cormorant Garamond', serif" }}>
            {cfg.padrinhosTitle}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
            {padrinhos.map((p, i) => (
              <div key={`${p.name}-${i}`} className="group padrinho-card relative">
                <PadrinhoFloralTop variant={i} />
                <div
                  className="avatar-ring w-56 h-56 rounded-full overflow-hidden border-4 shadow-xl mx-auto mb-4"
                  style={{ borderColor: "#C9962A", backgroundColor: "#D9EAF3" }}
                >
                  <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition duration-500 transform group-hover:scale-110" />
                </div>
                <h3 className="font-serif text-2xl font-bold" style={{ color: primary, fontFamily: "'Cormorant Garamond', serif" }}>
                  {p.name}
                </h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="rsvp" className="py-24 px-6 bg-white relative overflow-hidden" style={{ borderTop: "8px solid #C9962A" }}>
        <div className="absolute top-6 left-0 pointer-events-none hidden md:block opacity-20">
          <svg width="110" height="110" viewBox="0 0 160 160" aria-hidden>
            <use href="#cornerTL" x="0" y="0" width="160" height="160" />
          </svg>
        </div>
        <div className="absolute top-6 right-0 pointer-events-none hidden md:block opacity-20 scale-x-[-1]">
          <svg width="110" height="110" viewBox="0 0 160 160" aria-hidden>
            <use href="#cornerTL" x="0" y="0" width="160" height="160" />
          </svg>
        </div>

        <div className="max-w-3xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-8">
              <svg width="100%" height="55" viewBox="0 0 340 60" className="max-w-[340px]" aria-hidden>
                <use href="#floralDivider" x="0" y="0" width="340" height="60" />
              </svg>
            </div>
            <h2 className="font-serif text-5xl text-[#2C5F7A] mb-4" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Confirmação de Presença
            </h2>
            <p className="text-lg text-gray-600 italic">Será uma alegria contar com você. Confirme até 08/05/2026.</p>
          </div>

          <div
            id="rsvp-success"
            className={rsvpSaved ? "text-center p-12 rounded-3xl border-2 shadow-xl mb-8" : "hidden"}
            style={{ backgroundColor: "#EBF5FC", borderColor: "#2C5F7A" }}
          >
            <h3 className="font-serif text-4xl text-[#2C5F7A] mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Obrigado!
            </h3>
            <p className="text-lg">Sua presença foi confirmada. Nos vemos em breve!</p>
          </div>

          {!rsvpSaved ? (
            <form
              id="rsvp-form"
              className="space-y-8 p-8 md:p-12 rounded-3xl border shadow-sm"
              style={{ backgroundColor: "rgba(235,244,250,0.3)", borderColor: "#D9EAF3" }}
              onSubmit={(e) => {
                e.preventDefault();
                void submitBotanicoRsvp({ mainName, mainPhoneDigits: mainPhone, mainAge });
              }}
            >
              <div>
                <h3 className="font-serif text-2xl text-[#2C5F7A] mb-6 border-b pb-2" style={{ fontFamily: "'Cormorant Garamond', serif", borderColor: "rgba(44,95,122,0.1)" }}>
                  Seus Dados
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label htmlFor="mainName" className="block text-sm mb-1 font-bold text-[#2C5F7A]">
                      Nome Completo
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
                    <label htmlFor="mainPhone" className="block text-sm mb-1 font-bold text-[#2C5F7A]">
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
                    <label htmlFor="mainAge" className="block text-sm mb-1 font-bold text-[#2C5F7A]">
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
                      <h4 className="font-serif font-bold text-xl italic text-[#2C5F7A]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                        Acompanhante {i + 1}
                      </h4>
                      <button
                        type="button"
                        onClick={() => setCompanionRows(companionRows.filter((_, j) => j !== i))}
                        className="text-red-500 text-xs uppercase font-bold"
                      >
                        Remover
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
                  + Adicionar Acompanhante
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
                  {patchRsvpPending ? "Enviando…" : "Confirmar Presença"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </section>

      <section id="presentes" className="py-24 px-6 text-center relative overflow-hidden" style={{ backgroundColor: "#EBF5FC" }}>
        <div className="absolute bottom-0 left-0 pointer-events-none hidden md:block opacity-18">
          <svg width="130" height="250" viewBox="0 0 200 380" aria-hidden>
            <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
          </svg>
        </div>
        <div className="absolute bottom-0 right-0 pointer-events-none hidden md:block opacity-18 scale-x-[-1]">
          <svg width="130" height="250" viewBox="0 0 200 380" aria-hidden>
            <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
          </svg>
        </div>

        <div className="max-w-3xl mx-auto p-12 bg-white rounded-3xl shadow-xl border-t-8 border-[#C9962A] relative z-10">
          <div className="flex justify-center mb-8">
            <svg width="100%" height="55" viewBox="0 0 340 60" className="max-w-[340px]" aria-hidden>
              <use href="#floralDivider" x="0" y="0" width="340" height="60" />
            </svg>
          </div>
          <h2 className="font-serif text-5xl text-[#2C5F7A] mb-6" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Lista de Presentes
          </h2>
          <p className="text-xl mb-4 text-gray-700">Sua presença é o nosso maior presente!</p>
          <p className="mb-8 text-gray-500 italic">
            Os presentes são fictícios. Para nos presentear, basta escolher os itens e clicar no botão abaixo.
          </p>
          <a
            href={(cfg.giftsExternalPageUrl ?? "presentes.html").trim() || "presentes.html"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-white px-10 py-5 rounded-2xl text-xl font-bold uppercase tracking-widest transition shadow-lg transform hover:-translate-y-1 hover:brightness-110"
            style={{ backgroundColor: "#C9962A" }}
          >
            Ver Presentes 🎁
          </a>
        </div>
      </section>

      <section className="py-24 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-8">
            <svg width="100%" height="55" viewBox="0 0 340 60" className="max-w-[340px]" aria-hidden>
              <use href="#floralDivider" x="0" y="0" width="340" height="60" />
            </svg>
          </div>
          <h2 className="font-serif text-4xl" style={{ color: primary, fontFamily: "'Cormorant Garamond', serif" }}>
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

      <footer className="text-white text-center py-20 px-6 relative overflow-hidden" style={{ backgroundColor: primary }}>
        <div className="absolute left-0 inset-y-0 flex items-center pointer-events-none hidden lg:flex opacity-22">
          <svg width="140" height="260" viewBox="0 0 200 380" aria-hidden>
            <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
          </svg>
        </div>
        <div className="absolute right-0 inset-y-0 flex items-center pointer-events-none hidden lg:flex opacity-22 scale-x-[-1]">
          <svg width="140" height="260" viewBox="0 0 200 380" aria-hidden>
            <use href="#bouquetLeft" x="0" y="0" width="200" height="380" />
          </svg>
        </div>

        <div className="flex justify-center mb-6">
          <svg width="100%" height="68" viewBox="0 0 400 80" className="max-w-[400px] opacity-55" aria-hidden>
            <use href="#footerGarland" x="0" y="0" width="400" height="80" />
          </svg>
        </div>

        <p className="font-serif text-3xl mb-4 italic" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          {heroNomesLinha}
        </p>
        <p className="text-sm opacity-70 uppercase tracking-widest">{formatFooterDots(iso)}</p>

        <div className="flex justify-center mt-6">
          <svg width="260" height="42" viewBox="0 0 340 60" className="opacity-35" aria-hidden>
            <use href="#floralDivider" x="0" y="0" width="340" height="60" />
          </svg>
        </div>
      </footer>
    </div>
  );
}
