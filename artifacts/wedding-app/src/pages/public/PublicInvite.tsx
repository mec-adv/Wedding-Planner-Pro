import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useParams } from "wouter";
import {
  useGetPublicInvite,
  useListPublicInviteGifts,
  usePatchPublicInviteRsvp,
  useCreatePublicGiftOrder,
  getGetPublicInviteQueryKey,
  getListPublicInviteGiftsQueryKey,
} from "@workspace/api-client-react";
import type {
  GiftOrderInput,
  PublicGiftOrderInput,
  Gift as GiftDto,
  GuestCompanion,
  PublicInviteWedding,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode, FileText, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatPhoneBrReadOnly, stripPhoneDigits } from "@/lib/phone-br";
import { PhoneInput } from "@/components/phone-input";
import { useQueryClient } from "@tanstack/react-query";
import { resolvePublicInvitePageConfig } from "./public-invite-page-config";
import { PublicInviteBotanico } from "./PublicInviteBotanico";

type PaymentMethod = "pix" | "boleto" | "credit_card";

/** Fallback quando o convite ainda não carregou (modelo casamento.html) */
const oliva = "#708238";
const creme = "#FDFCF8";
const grafite = "#333333";

const DEFAULT_PATTERN_STYLE: CSSProperties = {
  backgroundImage: `radial-gradient(${oliva} 0.5px, transparent 0.5px)`,
  backgroundSize: "20px 20px",
  backgroundColor: creme,
};

interface CheckoutState {
  giftId: number | null;
  giftName: string;
  amount: number;
  step: "details" | "card_details" | "payment" | "result";
  guestName: string;
  guestEmail: string;
  guestCpf: string;
  coupleMessage: string;
  paymentMethod: PaymentMethod;
  cardNumber: string;
  cardName: string;
  cardExpiry: string;
  cardCvv: string;
  cardHolderCpf: string;
  cardHolderPhoneDigits: string;
  cardHolderPostalCode: string;
  cardHolderAddressNumber: string;
  installmentCount: number;
}

const INITIAL_CHECKOUT: CheckoutState = {
  giftId: null,
  giftName: "",
  amount: 0,
  step: "details",
  guestName: "",
  guestEmail: "",
  guestCpf: "",
  coupleMessage: "",
  paymentMethod: "pix",
  cardNumber: "",
  cardName: "",
  cardExpiry: "",
  cardCvv: "",
  cardHolderCpf: "",
  cardHolderPhoneDigits: "",
  cardHolderPostalCode: "",
  cardHolderAddressNumber: "",
  installmentCount: 1,
};

interface PaymentResultData {
  success: boolean;
  message: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  bankSlipUrl?: string;
  invoiceUrl?: string;
}

const RSVP_LABELS: Record<string, string> = {
  pending: "Ainda não sei",
  confirmed: "Confirmo presença",
  declined: "Não poderei ir",
  maybe: "Talvez",
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
  const datePart = d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  const timePart = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${datePart} • ${timePart}`;
}

export default function PublicInvite() {
  const { token } = useParams<{ token: string }>();
  const t = token ?? "";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invite, isLoading, isError, error } = useGetPublicInvite(t, {
    query: {
      enabled: !!t && t.length >= 32,
      queryKey: getGetPublicInviteQueryKey(t),
    },
  });
  const { data: gifts, isLoading: giftsLoading } = useListPublicInviteGifts(t, {
    query: {
      enabled: !!t && t.length >= 32,
      queryKey: getListPublicInviteGiftsQueryKey(t),
    },
  });

  const patchRsvp = usePatchPublicInviteRsvp();
  const createOrder = useCreatePublicGiftOrder();

  const [rsvpStatus, setRsvpStatus] = useState<string>("pending");
  const [dietary, setDietary] = useState("");
  const [companionRows, setCompanionRows] = useState<{ name: string; age: string; phoneDigits: string }[]>([]);
  const [lgpdOk, setLgpdOk] = useState(false);
  const [rsvpSaved, setRsvpSaved] = useState(false);

  const [checkout, setCheckout] = useState<CheckoutState>({ ...INITIAL_CHECKOUT });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payResult, setPayResult] = useState<PaymentResultData | null>(null);

  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, passed: false });

  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");
    return () => document.documentElement.classList.remove("scroll-smooth");
  }, []);

  useEffect(() => {
    if (invite?.guest) {
      setRsvpStatus(invite.guest.rsvpStatus ?? "pending");
      setDietary(invite.guest.dietaryRestrictions ?? "");
      setCompanionRows(
        (invite.guest.companions ?? []).map((c: GuestCompanion) => ({
          name: c.name,
          age: String(c.age),
          phoneDigits: stripPhoneDigits(c.phone ?? ""),
        })),
      );
      if (invite.guest.rsvpStatus === "confirmed") {
        setRsvpSaved(true);
      }
    }
  }, [invite]);

  const targetMs = useMemo(() => weddingTargetMs(invite?.wedding), [invite?.wedding]);

  useEffect(() => {
    if (targetMs == null) return;
    const tick = () => {
      const distance = targetMs - Date.now();
      if (distance < 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, passed: true });
        return;
      }
      setCountdown({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
        passed: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const heroDateLine = useMemo(() => formatHeroDateLine(invite?.wedding), [invite?.wedding]);

  const submitBotanicoRsvp = async (data: { mainName: string; mainPhoneDigits: string; mainAge: string }) => {
    if (!data.mainName.trim()) {
      toast({ variant: "destructive", title: "Informe seu nome completo." });
      return;
    }
    const phoneDigits = stripPhoneDigits(data.mainPhoneDigits);
    if (!phoneDigits.trim()) {
      toast({ variant: "destructive", title: "Informe seu WhatsApp." });
      return;
    }
    const ageNum = Number(data.mainAge);
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 120) {
      toast({ variant: "destructive", title: "Informe uma idade válida." });
      return;
    }
    const companions = companionRows
      .map((r) => ({
        name: r.name.trim(),
        age: Number(r.age),
        phone: null as string | null,
      }))
      .filter((c) => c.name.length > 0);
    for (const c of companions) {
      if (!Number.isFinite(c.age) || c.age < 0 || c.age > 120) {
        toast({ variant: "destructive", title: "Informe idades válidas (0–120) para todos os acompanhantes." });
        return;
      }
    }
    const dietaryMerged = [`WhatsApp: ${formatPhoneBrReadOnly(phoneDigits)}`, `Idade: ${ageNum}`].join("\n");
    try {
      await patchRsvp.mutateAsync({
        token: t,
        data: {
          rsvpStatus: "confirmed",
          dietaryRestrictions: dietaryMerged,
          companions: companions.length > 0 ? companions : undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetPublicInviteQueryKey(t) });
      setRsvpSaved(true);
      toast({ title: "Presença registrada" });
      setTimeout(() => {
        document.getElementById("rsvp-success")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: e instanceof Error ? e.message : "Erro ao salvar",
      });
    }
  };

  const saveRsvp = async () => {
    if (!lgpdOk) {
      toast({ variant: "destructive", title: "Confirme a ciência sobre o uso dos dados." });
      return;
    }
    const companions = companionRows
      .map((r) => ({
        name: r.name.trim(),
        age: Number(r.age),
        phone: r.phoneDigits.trim() ? formatPhoneBrReadOnly(r.phoneDigits) : null,
      }))
      .filter((c) => c.name.length > 0);
    for (const c of companions) {
      if (!Number.isFinite(c.age) || c.age < 0 || c.age > 120) {
        toast({ variant: "destructive", title: "Informe idades válidas (0–120) para todos os acompanhantes." });
        return;
      }
    }
    try {
      await patchRsvp.mutateAsync({
        token: t,
        data: {
          rsvpStatus: rsvpStatus as "pending" | "confirmed" | "declined" | "maybe",
          dietaryRestrictions: dietary.trim() || null,
          companions: rsvpStatus === "declined" ? undefined : companions,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetPublicInviteQueryKey(t) });
      setRsvpSaved(true);
      toast({ title: "Presença registrada" });
      setTimeout(() => {
        document.getElementById("rsvp-success")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } catch (e: unknown) {
      toast({
        variant: "destructive",
        title: e instanceof Error ? e.message : "Erro ao salvar",
      });
    }
  };

  const selectGift = (gift: { id: number; name: string; price: number }) => {
    const guestName = invite?.guest?.name ?? "";
    setCheckout({
      ...INITIAL_CHECKOUT,
      giftId: gift.id,
      giftName: gift.name,
      amount: gift.price || 0,
      guestName,
      step: "details",
    });
    setPayResult(null);
    setCheckoutOpen(true);
  };

  const processPayment = async () => {
    if (!checkout.guestName.trim()) {
      toast({ variant: "destructive", title: "Informe seu nome" });
      return;
    }
    if (checkout.amount <= 0) {
      toast({ variant: "destructive", title: "Valor deve ser maior que zero" });
      return;
    }

    setCheckout((prev) => ({ ...prev, step: "payment" }));
    const idempotencyKey =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const [expMonth, expYear] = checkout.cardExpiry.split("/");
      const base: GiftOrderInput = {
        giftId: checkout.giftId ?? 0,
        guestName: checkout.guestName,
        guestEmail: checkout.guestEmail || null,
        guestCpf: checkout.guestCpf || null,
        amount: checkout.amount,
        paymentMethod: checkout.paymentMethod,
        creditCardNumber: checkout.paymentMethod === "credit_card" ? checkout.cardNumber.replace(/\s/g, "") : null,
        creditCardHolderName: checkout.paymentMethod === "credit_card" ? checkout.cardName : null,
        creditCardExpiryMonth: checkout.paymentMethod === "credit_card" ? (expMonth || null) : null,
        creditCardExpiryYear: checkout.paymentMethod === "credit_card" ? (expYear || null) : null,
        creditCardCcv: checkout.paymentMethod === "credit_card" ? checkout.cardCvv : null,
        creditCardHolderCpf: checkout.paymentMethod === "credit_card" ? checkout.cardHolderCpf : null,
        creditCardHolderEmail: checkout.paymentMethod === "credit_card" ? (checkout.guestEmail || null) : null,
        creditCardHolderPhone:
          checkout.paymentMethod === "credit_card" ? checkout.cardHolderPhoneDigits.trim() || null : null,
        creditCardHolderPostalCode: checkout.paymentMethod === "credit_card" ? checkout.cardHolderPostalCode || null : null,
        creditCardHolderAddressNumber: checkout.paymentMethod === "credit_card" ? checkout.cardHolderAddressNumber || null : null,
        installmentCount: checkout.paymentMethod === "credit_card" && checkout.installmentCount > 1 ? checkout.installmentCount : null,
        coupleMessage: checkout.coupleMessage.trim() || null,
      };
      const payload: PublicGiftOrderInput = { ...base, idempotencyKey };

      const orderResult = await createOrder.mutateAsync({ token: t, data: payload });
      setPayResult({
        success: true,
        message:
          checkout.paymentMethod === "credit_card"
            ? "Pagamento com cartão processado com sucesso!"
            : "Pagamento criado com sucesso! Complete o pagamento abaixo.",
        pixQrCode: orderResult.pixQrCode || undefined,
        pixCopyPaste: orderResult.pixCopyPaste || undefined,
        bankSlipUrl: orderResult.bankSlipUrl || undefined,
        invoiceUrl: orderResult.invoiceUrl || undefined,
      });
      setCheckout((prev) => ({ ...prev, step: "result" }));
    } catch (e: unknown) {
      setPayResult({
        success: false,
        message: e instanceof Error ? e.message : "Erro ao processar pagamento.",
      });
      setCheckout((prev) => ({ ...prev, step: "result" }));
    }
  };

  const handlePayment = async () => {
    if (checkout.paymentMethod === "credit_card") {
      setCheckout((prev) => ({ ...prev, step: "card_details" }));
      return;
    }
    await processPayment();
  };

  const handleCardPayment = async () => {
    if (!checkout.cardNumber || !checkout.cardName || !checkout.cardExpiry || !checkout.cardCvv) {
      toast({ variant: "destructive", title: "Preencha todos os dados do cartão" });
      return;
    }
    if (!checkout.cardHolderCpf) {
      toast({ variant: "destructive", title: "CPF do titular é obrigatório" });
      return;
    }
    await processPayment();
  };

  const resetCheckout = () => {
    setCheckout({ ...INITIAL_CHECKOUT });
    setPayResult(null);
    setCheckoutOpen(false);
  };

  const paymentMethods: { id: PaymentMethod; label: string; icon: React.ReactNode; description: string }[] = [
    { id: "pix", label: "PIX", icon: <QrCode className="w-5 h-5" />, description: "Pagamento instantâneo" },
    { id: "boleto", label: "Boleto", icon: <FileText className="w-5 h-5" />, description: "Vencimento em 3 dias" },
    { id: "credit_card", label: "Cartão de Crédito", icon: <CreditCard className="w-5 h-5" />, description: "Até 12x" },
  ];

  if (!t || t.length < 32) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ color: grafite, backgroundColor: creme }}>
        <p className="opacity-80">Link inválido.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ ...DEFAULT_PATTERN_STYLE, color: grafite }}>
        <div className="animate-pulse text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: oliva }}>
          Carregando convite…
        </div>
      </div>
    );
  }

  if (isError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ ...DEFAULT_PATTERN_STYLE, color: grafite }}>
        <p className="opacity-80">{error instanceof Error ? error.message : "Não encontramos este convite."}</p>
      </div>
    );
  }

  const w = invite.wedding;
  const bride = w?.brideName ?? "";
  const groom = w?.groomName ?? "";
  const cfg = resolvePublicInvitePageConfig(invite.template?.config);
  const primary = cfg.primaryColor;
  const bg = cfg.backgroundColor;
  const patternDot = cfg.patternDotColor;
  const text = cfg.textColor;

  const patternStyle: CSSProperties = {
    backgroundImage: `radial-gradient(${patternDot} 0.5px, transparent 0.5px)`,
    backgroundSize: "20px 20px",
    backgroundColor: bg,
  };

  const inputFieldClass = cn(
    "w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 bg-white text-[#333] placeholder:text-gray-400",
    "focus:ring-[color:var(--invite-primary)] focus:border-[color:var(--invite-primary)]",
  );

  const rootStyle: CSSProperties = {
    ...patternStyle,
    color: text,
    fontFamily: "'Lato', sans-serif",
    ["--invite-primary" as string]: primary,
  };

  return (
    <>
      {cfg.layout === "botanico" ? (
        <PublicInviteBotanico
          cfg={cfg}
          wedding={w}
          bride={bride}
          groom={groom}
          invite={invite}
          heroDateLine={heroDateLine}
          targetMs={targetMs}
          countdown={countdown}
          companionRows={companionRows}
          setCompanionRows={setCompanionRows}
          rsvpSaved={rsvpSaved}
          submitBotanicoRsvp={submitBotanicoRsvp}
          patchRsvpPending={patchRsvp.isPending}
        />
      ) : (
    <div className="min-h-screen antialiased text-[15px]" style={rootStyle}>
      <section className="min-h-screen flex flex-col justify-center items-center text-center p-6 relative">
        <div className="max-w-2xl p-10 rounded-xl shadow-sm border border-gray-100" style={{ backgroundColor: bg }}>
          <h2 className="tracking-widest uppercase text-sm mb-4 font-bold" style={{ color: primary }}>
            {cfg.heroTagline}
          </h2>
          <h1
            className="text-6xl md:text-8xl mb-6 leading-tight"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}
          >
            {bride} <span className="italic font-light">&</span> {groom}
          </h1>
          {heroDateLine && (
            <p className="text-xl md:text-2xl mb-8" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              {heroDateLine}
            </p>
          )}

          <div className="flex gap-4 justify-center text-center mb-10 min-h-[4rem] items-center">
            {targetMs == null ? null : countdown.passed ? (
              <p className="text-lg" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                {cfg.mensagemAposCerimonia}
              </p>
            ) : cfg.showCountdown ? (
              <>
                <div className="flex flex-col">
                  <span className="text-3xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                    {countdown.days}
                  </span>
                  <span className="text-xs uppercase">{cfg.countdownDayLabel}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                    {countdown.hours}
                  </span>
                  <span className="text-xs uppercase">{cfg.countdownHourLabel}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-3xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                    {countdown.minutes}
                  </span>
                  <span className="text-xs uppercase">{cfg.countdownMinLabel}</span>
                </div>
              </>
            ) : null}
          </div>

          <a
            href="#rsvp"
            className="inline-block text-white px-8 py-3 rounded-full uppercase tracking-wider text-sm transition shadow-md hover:opacity-90"
            style={{ backgroundColor: primary }}
          >
            {cfg.ctaRsvp}
          </a>
        </div>
      </section>

      <section className="py-20 px-6 max-w-4xl mx-auto text-center border-t border-gray-200">
        <h2 className="text-4xl mb-12" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
          {cfg.sectionGrandeDiaTitle}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
          <div className="bg-white p-8 rounded-lg shadow-sm">
            <h3 className="text-2xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
              {cfg.blockCerimoniaTitle}
            </h3>
            {w?.venue && (
              <p className="mb-2">
                <strong>{cfg.localLabel}</strong> {w.venue}
              </p>
            )}
            {heroDateLine && (
              <p className="mb-2">
                <strong>{cfg.dataLabel}</strong> {heroDateLine}
              </p>
            )}
            <p className="mb-6 whitespace-pre-wrap">{cfg.dressCodeText}</p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-sm">
            <h3 className="text-2xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
              {cfg.blockEventoTitle}
            </h3>
            {w?.description ? (
              <p className="text-gray-600 whitespace-pre-wrap">{w.description}</p>
            ) : (
              <p className="text-gray-500 italic">{cfg.emptyDescriptionFallback}</p>
            )}
          </div>
        </div>
      </section>

      <section id="rsvp" className="py-20 px-6 bg-white border-t border-gray-200">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-4xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
              {cfg.rsvpSectionTitle}
            </h2>
            <p>{cfg.rsvpSectionSubtitle}</p>
          </div>

          {rsvpSaved && (
            <div
              id="rsvp-success"
              className="text-center p-8 rounded-lg border border-green-200 mb-10"
              style={{ backgroundColor: "#f0fdf4" }}
            >
              <h3 className="text-3xl mb-2" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                {cfg.rsvpSuccessTitle}
              </h3>
              <p className="text-lg">{cfg.rsvpSuccessMessage}</p>
            </div>
          )}

          <div className="space-y-6 p-8 rounded-lg shadow-sm border border-gray-100" style={{ backgroundColor: bg }}>
            <div>
              <h3 className="text-2xl mb-4 border-b border-gray-200 pb-2" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                {cfg.seusDadosTitle}
              </h3>
              <p className="text-sm mb-4">
                <span className="font-semibold">{cfg.convidadoLabel}</span> {invite.guest?.name}
              </p>

              <p className="text-sm font-semibold mb-2">{cfg.suaPresencaLabel}</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {(["confirmed", "declined", "maybe", "pending"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRsvpStatus(s)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm uppercase tracking-wide border transition",
                      rsvpStatus === s
                        ? "text-white border-transparent"
                        : "bg-white border-gray-300 hover:border-[color:var(--invite-primary)]",
                    )}
                    style={rsvpStatus === s ? { backgroundColor: primary } : { color: text }}
                  >
                    {RSVP_LABELS[s]}
                  </button>
                ))}
              </div>

              {rsvpStatus !== "declined" && (
                <>
                  <div id="companions-container" className="space-y-4">
                    {companionRows.map((row, i) => (
                      <div
                        key={i}
                        className="p-4 border-l-4 bg-white rounded shadow-sm relative"
                        style={{ borderLeftColor: primary }}
                      >
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-bold text-lg" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                            {cfg.acompanhanteLabel} {i + 1}
                          </h4>
                          <button
                            type="button"
                            className="text-red-400 text-sm hover:text-red-600 transition"
                            onClick={() => setCompanionRows(companionRows.filter((_, j) => j !== i))}
                          >
                            {cfg.removerLabel}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm mb-1 font-semibold">Nome completo</label>
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
                            <label className="block text-sm mb-1 font-semibold">Idade</label>
                            <input
                              type="number"
                              min={0}
                              max={120}
                              className={inputFieldClass}
                              value={row.age}
                              onChange={(e) => {
                                const next = [...companionRows];
                                next[i] = { ...next[i], age: e.target.value };
                                setCompanionRows(next);
                              }}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-sm mb-1 font-semibold">Celular (opcional)</label>
                            <PhoneInput
                              className={inputFieldClass}
                              value={row.phoneDigits}
                              onDigitsChange={(digits: string) => {
                                const next = [...companionRows];
                                next[i] = { ...next[i], phoneDigits: digits };
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
                      className="px-6 py-2 rounded-full hover:text-white transition text-sm uppercase tracking-wide border"
                      style={{ borderColor: primary, color: primary }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = primary;
                        e.currentTarget.style.color = "#fff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = primary;
                      }}
                    >
                      + Adicionar acompanhante
                    </button>
                  </div>
                </>
              )}

              <div className="mt-6">
                <label className="block text-sm mb-1 font-semibold">{cfg.restricoesLabel}</label>
                <input
                  type="text"
                  className={inputFieldClass}
                  value={dietary}
                  onChange={(e) => setDietary(e.target.value)}
                  placeholder={cfg.restricoesPlaceholder}
                />
              </div>

              <label className="flex items-start gap-3 text-sm text-gray-600 cursor-pointer mt-6">
                <input type="checkbox" checked={lgpdOk} onChange={(e) => setLgpdOk(e.target.checked)} className="mt-1" />
                <span>{invite.lgpdNotice}</span>
              </label>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <button
                type="button"
                disabled={patchRsvp.isPending}
                onClick={() => void saveRsvp()}
                className="w-full text-white font-bold px-8 py-4 rounded hover:opacity-90 transition uppercase tracking-widest text-lg shadow-md disabled:opacity-50"
                style={{ backgroundColor: primary }}
              >
                {patchRsvp.isPending ? "Enviando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 text-center border-t border-gray-200">
        <div className="max-w-2xl mx-auto p-10 bg-white rounded-lg shadow-sm border border-gray-100">
          <h2 className="text-4xl mb-4" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
            {cfg.giftsSectionTitle}
          </h2>
          <p className="text-lg mb-6">{cfg.giftsTagline}</p>

          {giftsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 text-left">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : gifts?.length === 0 ? (
            <p className="text-gray-500 italic">{cfg.giftsEmptyMessage}</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 text-left mt-8">
              {gifts?.map((gift: GiftDto) => {
                const value = Number(gift.price) || 0;
                return (
                  <button
                    key={gift.id}
                    type="button"
                    className="text-left p-6 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition bg-[#FDFCF8] w-full"
                    onClick={() => selectGift({ id: gift.id, name: gift.name, price: value })}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
                        {gift.name}
                      </span>
                      <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded" style={{ backgroundColor: `${primary}22`, color: primary }}>
                        Disponível
                      </span>
                    </div>
                    {gift.description && <p className="text-sm text-gray-600 mt-2 line-clamp-3">{gift.description}</p>}
                    <div className="flex justify-between items-center mt-4">
                      <span className="text-lg font-semibold" style={{ color: primary }}>
                        {value > 0 ? `R$ ${value.toFixed(2)}` : "Valor livre"}
                      </span>
                      <span className="text-sm font-semibold underline" style={{ color: primary }}>
                        Presentear
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <footer className="text-white text-center py-8" style={{ backgroundColor: grafite }}>
        <p className="text-2xl mb-2" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          {bride} & {groom}
        </p>
        <p className="text-sm opacity-70">{cfg.footerLine2}</p>
      </footer>
    </div>
      )}

      <Dialog open={checkoutOpen} onOpenChange={(open) => { if (!open) resetCheckout(); }}>
        <DialogContent
          className="max-w-md max-h-[90vh] overflow-y-auto border-gray-200 bg-[#FDFCF8] text-[#333]"
          style={{ ["--invite-primary" as string]: primary } as CSSProperties}
        >
          <DialogHeader>
            <DialogTitle className="text-xl" style={{ fontFamily: "'Cormorant Garamond', serif", color: primary }}>
              {checkout.step === "result" ? (payResult?.success ? "Obrigado!" : "Erro") :
               checkout.step === "card_details" ? "Dados do cartão" :
               `Presentear: ${checkout.giftName}`}
            </DialogTitle>
          </DialogHeader>

          {checkout.step === "details" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Seu nome *</label>
                <Input
                  className={inputFieldClass}
                  value={checkout.guestName}
                  onChange={(e) => setCheckout({ ...checkout, guestName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Email</label>
                <Input
                  type="email"
                  className={inputFieldClass}
                  value={checkout.guestEmail}
                  onChange={(e) => setCheckout({ ...checkout, guestEmail: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Valor (R$)</label>
                <Input
                  type="number"
                  min={1}
                  step="0.01"
                  className={inputFieldClass}
                  value={checkout.amount}
                  onChange={(e) => setCheckout({ ...checkout, amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Mensagem para o casal (opcional)</label>
                <textarea
                  className={`${inputFieldClass} min-h-[80px]`}
                  value={checkout.coupleMessage}
                  onChange={(e) => setCheckout({ ...checkout, coupleMessage: e.target.value })}
                  maxLength={2000}
                  placeholder="Um carinho, um votinho…"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">Forma de pagamento</label>
                <p className="text-xs text-gray-500 mb-2">Recomendamos PIX ou boleto.</p>
                <div className="grid gap-2">
                  {paymentMethods.map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setCheckout({ ...checkout, paymentMethod: pm.id })}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                        checkout.paymentMethod === pm.id ? "bg-black/[0.03]" : "border-gray-200",
                      )}
                      style={
                        checkout.paymentMethod === pm.id
                          ? { borderColor: primary }
                          : { borderColor: undefined }
                      }
                    >
                      {pm.icon}
                      <div>
                        <div className="font-medium">{pm.label}</div>
                        <div className="text-xs text-gray-500">{pm.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full text-white rounded-full" style={{ backgroundColor: primary }} onClick={handlePayment}>
                Continuar
              </Button>
            </div>
          )}

          {checkout.step === "card_details" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Número do cartão</label>
                <Input
                  className={inputFieldClass}
                  value={checkout.cardNumber}
                  onChange={(e) => setCheckout({ ...checkout, cardNumber: e.target.value })}
                  placeholder="0000 0000 0000 0000"
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Nome no cartão</label>
                <Input className={inputFieldClass} value={checkout.cardName} onChange={(e) => setCheckout({ ...checkout, cardName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-semibold">Validade (MM/AA)</label>
                  <Input className={inputFieldClass} value={checkout.cardExpiry} onChange={(e) => setCheckout({ ...checkout, cardExpiry: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-semibold">CVV</label>
                  <Input className={inputFieldClass} value={checkout.cardCvv} onChange={(e) => setCheckout({ ...checkout, cardCvv: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">CPF do titular *</label>
                <Input className={inputFieldClass} value={checkout.cardHolderCpf} onChange={(e) => setCheckout({ ...checkout, cardHolderCpf: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-semibold">Celular do titular</label>
                <PhoneInput
                  className={inputFieldClass}
                  value={checkout.cardHolderPhoneDigits}
                  onDigitsChange={(digits: string) => setCheckout({ ...checkout, cardHolderPhoneDigits: digits })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-semibold">CEP</label>
                  <Input
                    className={inputFieldClass}
                    value={checkout.cardHolderPostalCode}
                    onChange={(e) => setCheckout({ ...checkout, cardHolderPostalCode: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold">Número</label>
                  <Input
                    className={inputFieldClass}
                    value={checkout.cardHolderAddressNumber}
                    onChange={(e) => setCheckout({ ...checkout, cardHolderAddressNumber: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">Parcelas</label>
                <select
                  className={`${inputFieldClass} mt-1`}
                  value={checkout.installmentCount}
                  onChange={(e) => setCheckout({ ...checkout, installmentCount: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setCheckout({ ...checkout, step: "details" })}>
                  Voltar
                </Button>
                <Button className="flex-1 text-white" style={{ backgroundColor: primary }} onClick={handleCardPayment}>
                  Pagar
                </Button>
              </div>
            </div>
          )}

          {checkout.step === "payment" && (
            <div className="flex flex-col items-center py-8 gap-2">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: primary }} />
              <p className="text-sm text-gray-600">Processando pagamento…</p>
            </div>
          )}

          {checkout.step === "result" && payResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center text-center gap-2">
                {payResult.success ? (
                  <CheckCircle className="w-14 h-14 text-green-600" />
                ) : (
                  <AlertCircle className="w-14 h-14 text-red-500" />
                )}
                <p className="text-sm">{payResult.message}</p>
              </div>
              {payResult.success && payResult.pixCopyPaste && (
                <div className="space-y-2">
                  <div className="text-xs break-all p-2 bg-white rounded border border-gray-200">{payResult.pixCopyPaste}</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      void navigator.clipboard.writeText(payResult.pixCopyPaste ?? "");
                      toast({ title: "Copiado" });
                    }}
                  >
                    Copiar PIX
                  </Button>
                </div>
              )}
              {payResult.bankSlipUrl && (
                <Button asChild className="w-full text-white" style={{ backgroundColor: primary }}>
                  <a href={payResult.bankSlipUrl} target="_blank" rel="noreferrer">
                    Abrir boleto
                  </a>
                </Button>
              )}
              {payResult.invoiceUrl && (
                <Button asChild variant="outline" className="w-full">
                  <a href={payResult.invoiceUrl} target="_blank" rel="noreferrer">
                    Ver fatura
                  </a>
                </Button>
              )}
              <Button className="w-full" style={{ backgroundColor: primary, color: "#fff" }} onClick={resetCheckout}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
