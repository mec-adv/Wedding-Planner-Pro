import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams, Link } from "wouter";
import {
  useGetPublicInvite,
  usePatchPublicInviteRsvp,
  getGetPublicInviteQueryKey,
} from "@workspace/api-client-react";
import type { GuestCompanion, PublicInviteWedding } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { formatPhoneBrReadOnly, stripPhoneDigits } from "@/lib/phone-br";
import { resolvePublicInvitePageConfig, resolvePublicPresentesHref } from "./public-invite-page-config";
import { PublicInviteBotanico } from "./PublicInviteBotanico";
import { InviteHeroSection } from "./InviteHeroSection";
import { InviteRsvpSection } from "./InviteRsvpSection";
import { InviteMuralSection } from "./InviteMuralSection";
import { InvitePhotoCarouselSection } from "./InvitePhotoCarouselSection";

const oliva = "#708238";
const creme = "#FDFCF8";
const grafite = "#333333";

const DEFAULT_PATTERN_STYLE: CSSProperties = {
  backgroundImage: `radial-gradient(${oliva} 0.5px, transparent 0.5px)`,
  backgroundSize: "20px 20px",
  backgroundColor: creme,
};

function weddingTargetMs(w: PublicInviteWedding | undefined): number | null {
  if (!w) return null;
  const iso = w.religiousCeremonyAt ?? w.civilCeremonyAt ?? w.date;
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function formatHeroDateLine(w: PublicInviteWedding | undefined): string {
  if (!w) return "";
  const iso = w.religiousCeremonyAt ?? w.civilCeremonyAt ?? w.date;
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })} • ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function PublicInvite() {
  const { token } = useParams<{ token: string }>();
  const t = token ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invite, isLoading, isError, error } = useGetPublicInvite(t, {
    query: { enabled: !!t && t.length >= 32, queryKey: getGetPublicInviteQueryKey(t) },
  });

  const patchRsvp = usePatchPublicInviteRsvp();

  const [rsvpStatus, setRsvpStatus] = useState("pending");
  const [dietary, setDietary] = useState("");
  const [companionRows, setCompanionRows] = useState<{ name: string; age: string; phoneDigits: string }[]>([]);
  const [lgpdOk, setLgpdOk] = useState(false);
  const [rsvpSaved, setRsvpSaved] = useState(false);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, passed: false });

  useEffect(() => { document.documentElement.classList.add("scroll-smooth"); return () => { document.documentElement.classList.remove("scroll-smooth"); }; }, []);

  useEffect(() => {
    if (!invite?.guest) return;
    setRsvpStatus(invite.guest.rsvpStatus ?? "pending");
    setDietary(invite.guest.dietaryRestrictions ?? "");
    setCompanionRows((invite.guest.companions ?? []).map((c: GuestCompanion) => ({
      name: c.name, age: String(c.age), phoneDigits: stripPhoneDigits(c.phone ?? ""),
    })));
    if (invite.guest.rsvpStatus === "confirmed") setRsvpSaved(true);
  }, [invite]);

  const targetMs = useMemo(() => weddingTargetMs(invite?.wedding), [invite?.wedding]);

  useEffect(() => {
    if (targetMs == null) return;
    const tick = () => {
      const dist = targetMs - Date.now();
      if (dist < 0) { setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, passed: true }); return; }
      setCountdown({
        days: Math.floor(dist / 86400000),
        hours: Math.floor((dist % 86400000) / 3600000),
        minutes: Math.floor((dist % 3600000) / 60000),
        seconds: Math.floor((dist % 60000) / 1000),
        passed: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const heroDateLine = useMemo(() => formatHeroDateLine(invite?.wedding), [invite?.wedding]);

  const saveRsvp = async () => {
    if (!lgpdOk) { toast({ variant: "destructive", title: "Confirme a ciência sobre o uso dos dados." }); return; }
    const companions = companionRows
      .map((r) => ({ name: r.name.trim(), age: Number(r.age), phone: r.phoneDigits.trim() ? formatPhoneBrReadOnly(r.phoneDigits) : null }))
      .filter((c) => c.name.length > 0);
    for (const c of companions) {
      if (!Number.isFinite(c.age) || c.age < 0 || c.age > 120) {
        toast({ variant: "destructive", title: "Informe idades válidas (0–120) para todos os acompanhantes." });
        return;
      }
    }
    try {
      await patchRsvp.mutateAsync({ token: t, data: { rsvpStatus: rsvpStatus as "pending" | "confirmed" | "declined" | "maybe", dietaryRestrictions: dietary.trim() || null, companions: rsvpStatus === "declined" ? undefined : companions } });
      await queryClient.invalidateQueries({ queryKey: getGetPublicInviteQueryKey(t) });
      setRsvpSaved(true);
      toast({ title: "Presença registrada" });
      setTimeout(() => { document.getElementById("rsvp-success")?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100);
    } catch (e) { toast({ variant: "destructive", title: e instanceof Error ? e.message : "Erro ao salvar" }); }
  };

  const submitBotanicoRsvp = async (data: { mainName: string; mainPhoneDigits: string; mainAge: string }) => {
    if (!data.mainName.trim()) { toast({ variant: "destructive", title: "Informe seu nome completo." }); return; }
    const phoneDigits = stripPhoneDigits(data.mainPhoneDigits);
    if (!phoneDigits.trim()) { toast({ variant: "destructive", title: "Informe seu WhatsApp." }); return; }
    const ageNum = Number(data.mainAge);
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) { toast({ variant: "destructive", title: "Informe uma idade válida." }); return; }
    const companions = companionRows.map((r) => ({ name: r.name.trim(), age: Number(r.age), phone: null as string | null })).filter((c) => c.name.length > 0);
    for (const c of companions) {
      if (!Number.isFinite(c.age) || c.age < 0 || c.age > 120) { toast({ variant: "destructive", title: "Informe idades válidas (0–120)." }); return; }
    }
    try {
      await patchRsvp.mutateAsync({ token: t, data: { rsvpStatus: "confirmed", dietaryRestrictions: [`WhatsApp: ${formatPhoneBrReadOnly(phoneDigits)}`, `Idade: ${ageNum}`].join("\n"), companions: companions.length > 0 ? companions : undefined } });
      await queryClient.invalidateQueries({ queryKey: getGetPublicInviteQueryKey(t) });
      setRsvpSaved(true);
      toast({ title: "Presença registrada" });
      setTimeout(() => { document.getElementById("rsvp-success")?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100);
    } catch (e) { toast({ variant: "destructive", title: e instanceof Error ? e.message : "Erro ao salvar" }); }
  };

  // --- Estados de loading/erro ---
  if (!t || t.length < 32) return <div className="min-h-screen flex items-center justify-center p-6" style={{ color: grafite, backgroundColor: creme }}><p className="opacity-80">Link inválido.</p></div>;
  if (isLoading) return <div className="min-h-screen flex items-center justify-center" style={{ ...DEFAULT_PATTERN_STYLE, color: grafite }}><div className="animate-pulse text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: oliva }}>Carregando convite…</div></div>;
  if (isError || !invite) return <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ ...DEFAULT_PATTERN_STYLE, color: grafite }}><p className="opacity-80">{error instanceof Error ? error.message : "Não encontramos este convite."}</p></div>;

  const w = invite.wedding;
  const bride = w?.brideName ?? "";
  const groom = w?.groomName ?? "";
  const cfg = resolvePublicInvitePageConfig(invite.template?.config);
  const primary = cfg.primaryColor;
  const bg = cfg.backgroundColor;
  const inputFieldClass = cn("w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 bg-white text-[#333] placeholder:text-gray-400", "focus:ring-[color:var(--invite-primary)] focus:border-[color:var(--invite-primary)]");
  const rootStyle: CSSProperties = { backgroundImage: `radial-gradient(${cfg.patternDotColor} 0.5px, transparent 0.5px)`, backgroundSize: "20px 20px", backgroundColor: bg, color: cfg.textColor, fontFamily: "'Lato', sans-serif", ["--invite-primary" as string]: primary };

  const weddingId = w?.id ?? 0;
  const presentesTarget = resolvePublicPresentesHref(cfg, t);

  // Layout alternativo: Botânico
  if (cfg.layout === "botanico") {
    return (
      <>
        <PublicInviteBotanico cfg={cfg} wedding={w} bride={bride} groom={groom} invite={invite} inviteToken={t} heroDateLine={heroDateLine} targetMs={targetMs} countdown={countdown} companionRows={companionRows} setCompanionRows={setCompanionRows} rsvpSaved={rsvpSaved} submitBotanicoRsvp={submitBotanicoRsvp} patchRsvpPending={patchRsvp.isPending} />
      </>
    );
  }

  // Layout padrão
  return (
    <>
      <div className="min-h-screen antialiased text-[15px]" style={rootStyle}>

        <InviteHeroSection cfg={cfg} bride={bride} groom={groom} heroDateLine={heroDateLine} targetMs={targetMs} countdown={countdown} primaryColor={primary} backgroundColor={bg} />

        <InvitePhotoCarouselSection
          imageUrls={cfg.weddingCarouselImageUrls}
          primaryColor={primary}
          layout="classic"
        />

        {/* Seção: O Grande Dia */}
        <section className="py-20 px-6 max-w-4xl mx-auto text-center border-t border-gray-200">
          <h2 className="text-4xl mb-12" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>{cfg.sectionGrandeDiaTitle}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h3 className="text-2xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>{cfg.blockCerimoniaTitle}</h3>
              {w?.venue && <p className="mb-2"><strong>{cfg.localLabel}</strong> {w.venue}</p>}
              {heroDateLine && <p className="mb-2"><strong>{cfg.dataLabel}</strong> {heroDateLine}</p>}
              <p className="mb-6 whitespace-pre-wrap">{cfg.dressCodeText}</p>
            </div>
            <div className="bg-white p-8 rounded-lg shadow-sm">
              <h3 className="text-2xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>{cfg.blockEventoTitle}</h3>
              {w?.description ? <p className="text-gray-600 whitespace-pre-wrap">{w.description}</p> : <p className="text-gray-500 italic">{cfg.emptyDescriptionFallback}</p>}
            </div>
          </div>
        </section>

        <InviteRsvpSection cfg={cfg} primaryColor={primary} backgroundColor={bg} textColor={cfg.textColor} inputFieldClass={inputFieldClass} guestName={invite.guest?.name} lgpdNotice={invite.lgpdNotice} rsvpStatus={rsvpStatus} onRsvpStatusChange={setRsvpStatus} dietary={dietary} onDietaryChange={setDietary} companionRows={companionRows} onCompanionRowsChange={setCompanionRows} lgpdOk={lgpdOk} onLgpdOkChange={setLgpdOk} rsvpSaved={rsvpSaved} isPending={patchRsvp.isPending} onSave={() => void saveRsvp()} />

        {weddingId > 0 && (
          <section id="presentes" className="py-16 px-6 max-w-4xl mx-auto text-center border-t border-gray-200">
            <h2 className="text-4xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>{cfg.giftsSectionTitle}</h2>
            <p className="text-lg mb-2">{cfg.giftsTagline}</p>
            {(cfg.listaPresentesIntro ?? "").trim() !== "" && (
              <p className="text-gray-600 mb-2">{cfg.listaPresentesIntro}</p>
            )}
            {(cfg.giftsPresentesDisclaimer ?? "").trim() !== "" && (
              <p className="text-gray-500 italic mb-8">{cfg.giftsPresentesDisclaimer}</p>
            )}
            {presentesTarget.external ? (
              <a
                href={presentesTarget.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center text-white px-8 py-4 rounded-full text-lg font-semibold uppercase tracking-widest transition shadow-md hover:brightness-110"
                style={{ backgroundColor: primary }}
              >
                {cfg.giftsVerPresentesButton ?? "Ver presentes"}
              </a>
            ) : (
              <Link href={presentesTarget.href}>
                <span
                  className="inline-flex items-center justify-center text-white px-8 py-4 rounded-full text-lg font-semibold uppercase tracking-widest transition shadow-md hover:brightness-110 cursor-pointer"
                  style={{ backgroundColor: primary }}
                >
                  {cfg.giftsVerPresentesButton ?? "Ver presentes"}
                </span>
              </Link>
            )}
          </section>
        )}

        {weddingId > 0 && (
          <InviteMuralSection
            layout="classic"
            primaryColor={primary}
            guestToken={t}
            guestName={invite.guest?.name ?? ""}
          />
        )}

        {/* Link para histórico de pedidos */}
        <div className="text-center py-4 border-t border-gray-100 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {presentesTarget.external ? (
            <a href={presentesTarget.href} target="_blank" rel="noreferrer" className="text-sm underline" style={{ color: primary }}>
              Lista de presentes
            </a>
          ) : (
            <Link href={presentesTarget.href}>
              <span className="text-sm underline cursor-pointer" style={{ color: primary }}>Lista de presentes</span>
            </Link>
          )}
          <Link href={`/p/convite/${t}/pedidos`}>
            <span className="text-sm underline cursor-pointer" style={{ color: primary }}>Ver meus pedidos</span>
          </Link>
        </div>

        <footer className="text-white text-center py-8" style={{ backgroundColor: grafite }}>
          <p className="text-2xl mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{bride} & {groom}</p>
          <p className="text-sm opacity-70">{cfg.footerLine2}</p>
        </footer>
      </div>

    </>
  );
}
