import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { CSSProperties } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, CreditCard, CheckCircle, AlertCircle, Copy, Clock, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import { createOrder, fetchOrderStatus, fetchPaymentConfig } from "@/lib/shop-api";
import type { CartItem, CreateOrderResult } from "@/lib/shop-api";
import { displayPhoneBr, stripPhoneDigits } from "@/lib/phone-br";

const HONEYMOON_QUOTA_UNIT = 50;

// Asaas.js global type declaration
declare global {
  interface Window {
    AsaasJs?: {
      tokenizeCreditCard(params: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        cvv: string;
      }): Promise<{ creditCardToken: string }>;
    };
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totalAmount: number;
  guestToken: string;
  guestName: string;
  /** ID do casamento — necessário para carregar config de tokenização. */
  weddingId: number;
  /** Telefone do convidado dono do link (pré-preenchimento; editável). */
  guestPhone?: string | null;
  primaryColor: string;
  onSuccess: () => void;
}

type PayMethod = "pix" | "credit_card";
type Step = "details" | "card" | "processing" | "pix_waiting" | "success" | "error";

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pixTimeRemaining(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const m = Math.floor(diff / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function loadAsaasScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar Asaas.js"));
    document.head.appendChild(script);
  });
}

export function ShopCheckoutDialog({
  open,
  onClose,
  items,
  totalAmount,
  guestToken,
  guestName,
  weddingId,
  guestPhone,
  primaryColor,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const rootStyle: CSSProperties = { ["--invite-primary" as string]: primaryColor };

  const [step, setStep] = useState<Step>("details");
  const [buyerName, setBuyerName] = useState(guestName);
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerCpf, setBuyerCpf] = useState("");
  const [honeymoonQuotaUnits, setHoneymoonQuotaUnits] = useState(0);
  const [muralMessage, setMuralMessage] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("pix");
  const [errorMsg, setErrorMsg] = useState("");

  // Card holder non-sensitive fields (safe to store in state)
  const [holderCpf, setHolderCpf] = useState("");
  const [holderPhone, setHolderPhone] = useState("");
  const [holderPostalCode, setHolderPostalCode] = useState("");
  const [holderAddressNumber, setHolderAddressNumber] = useState("");
  const [installments, setInstallments] = useState(1);

  // Card sensitive fields — uncontrolled refs; never stored in React state
  const cardNumberRef = useRef<HTMLInputElement>(null);
  const cardHolderRef = useRef<HTMLInputElement>(null);
  const cardExpiryRef = useRef<HTMLInputElement>(null);
  const cardCvvRef = useRef<HTMLInputElement>(null);

  // PIX result
  const [orderResult, setOrderResult] = useState<CreateOrderResult | null>(null);
  const [pixTimer, setPixTimer] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Idempotency key — generated once per dialog open
  const idempotencyKeyRef = useRef<string>("");

  // Payment config — public key for Asaas.js tokenization
  const [asaasScriptLoaded, setAsaasScriptLoaded] = useState(false);
  const [asaasPublicKey, setAsaasPublicKey] = useState<string | null>(null);
  const [asaasEnvironment, setAsaasEnvironment] = useState<"sandbox" | "production">("sandbox");

  const quotaAmount = honeymoonQuotaUnits * HONEYMOON_QUOTA_UNIT;
  const checkoutTotal = useMemo(() => totalAmount + quotaAmount, [totalAmount, quotaAmount]);

  // Load payment config once
  useEffect(() => {
    if (!weddingId) return;
    fetchPaymentConfig(weddingId).then((cfg) => {
      if (!cfg) return;
      setAsaasPublicKey(cfg.asaasPublicKey ?? null);
      setAsaasEnvironment(cfg.asaasEnvironment as "sandbox" | "production");
    }).catch(() => { /* non-critical */ });
  }, [weddingId]);

  // Load Asaas.js when config is available and payment method is credit_card
  const loadAsaasJs = useCallback(async () => {
    if (asaasScriptLoaded || !asaasPublicKey) return;
    try {
      const baseUrl = asaasEnvironment === "production"
        ? "https://api.asaas.com"
        : "https://sandbox.asaas.com";
      await loadAsaasScript(`${baseUrl}/api/v3/payments/paymentForm.js`);
      setAsaasScriptLoaded(true);
    } catch {
      // Script load failure — will surface as error on submit
    }
  }, [asaasScriptLoaded, asaasPublicKey, asaasEnvironment]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("details");
      setBuyerName(guestName);
      setBuyerPhone(guestPhone ? displayPhoneBr(stripPhoneDigits(guestPhone)) : "");
      setHoneymoonQuotaUnits(0);
      setMuralMessage("");
      setPayMethod("pix");
      setErrorMsg("");
      setOrderResult(null);
      setBuyerCpf("");
      setHolderCpf(""); setHolderPhone(""); setHolderPostalCode(""); setHolderAddressNumber(""); setInstallments(1);
      idempotencyKeyRef.current = generateIdempotencyKey();
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [open, guestName, guestPhone]);

  // PIX timer
  useEffect(() => {
    if (step !== "pix_waiting" || !orderResult?.pixExpiresAt) return;
    const tick = () => setPixTimer(pixTimeRemaining(orderResult.pixExpiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [step, orderResult?.pixExpiresAt]);

  // PIX polling
  useEffect(() => {
    if (step !== "pix_waiting" || !orderResult?.orderId) return;
    pollingRef.current = setInterval(async () => {
      try {
        const status = await fetchOrderStatus(orderResult.orderId, guestToken);
        if (status.status === "paid") {
          clearInterval(pollingRef.current!);
          setStep("success");
          onSuccess();
        } else if (status.status === "expired" || status.status === "cancelled" || status.status === "failed") {
          clearInterval(pollingRef.current!);
          setErrorMsg("Pagamento expirado ou cancelado.");
          setStep("error");
        }
      } catch { /* keep polling */ }
    }, 5000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [step, orderResult?.orderId, onSuccess]);

  const inputClass = cn(
    "w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 bg-white text-[#333] placeholder:text-gray-400",
    "focus:ring-[color:var(--invite-primary)] focus:border-[color:var(--invite-primary)]",
  );

  async function handleContinue() {
    if (!buyerName.trim()) { toast({ variant: "destructive", title: "Informe seu nome" }); return; }
    const phoneDigits = stripPhoneDigits(buyerPhone);
    if (phoneDigits.length < 10) {
      toast({ variant: "destructive", title: "Informe um telefone válido com DDD" });
      return;
    }
    if (buyerCpf.replace(/\D/g, "").length !== 11) {
      toast({ variant: "destructive", title: "Informe um CPF válido (11 dígitos)" });
      return;
    }
    if (payMethod === "credit_card") {
      await loadAsaasJs();
      setStep("card");
      return;
    }
    await submitOrder();
  }

  async function handleCardSubmit() {
    const number = cardNumberRef.current?.value?.replace(/\s/g, "") ?? "";
    const holderName = cardHolderRef.current?.value ?? "";
    const expiry = cardExpiryRef.current?.value ?? "";
    const cvv = cardCvvRef.current?.value ?? "";

    if (!number || !holderName || !expiry || !cvv || !holderCpf) {
      toast({ variant: "destructive", title: "Preencha todos os dados do cartão e CPF do titular" });
      return;
    }

    const [expMonth, expYearRaw] = expiry.split("/");
    const expYear = expYearRaw?.trim().length === 2 ? `20${expYearRaw.trim()}` : expYearRaw?.trim();

    if (!expMonth || !expYear) {
      toast({ variant: "destructive", title: "Validade inválida. Use o formato MM/AA" });
      return;
    }

    if (!window.AsaasJs) {
      toast({ variant: "destructive", title: "Módulo de segurança do cartão não carregado. Recarregue a página e tente novamente." });
      return;
    }

    setStep("processing");

    try {
      // Tokenize via Asaas.js — raw card data never leaves the browser as-is
      const { creditCardToken } = await window.AsaasJs.tokenizeCreditCard({
        holderName,
        number,
        expiryMonth: expMonth.trim(),
        expiryYear: expYear,
        cvv,
      });

      // Clear sensitive field values immediately after tokenization
      if (cardNumberRef.current) cardNumberRef.current.value = "";
      if (cardCvvRef.current) cardCvvRef.current.value = "";

      await submitOrder({
        creditCardToken,
        holderName,
        holderCpf: holderCpf.replace(/\D/g, ""),
        holderPhone,
        holderPostalCode,
        holderAddressNumber,
        installments,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao processar dados do cartão.";
      setErrorMsg(msg);
      setStep("error");
    }
  }

  interface CardTokenPayload {
    creditCardToken: string;
    holderName: string;
    holderCpf: string;
    holderPhone: string;
    holderPostalCode: string;
    holderAddressNumber: string;
    installments: number;
  }

  async function submitOrder(card?: CardTokenPayload) {
    if (step !== "processing") setStep("processing");
    try {
      const payload = {
        guestToken,
        buyerName: buyerName.trim(),
        buyerPhone: stripPhoneDigits(buyerPhone),
        buyerCpf: buyerCpf.replace(/\D/g, "") || undefined,
        honeymoonQuotaUnits: honeymoonQuotaUnits > 0 ? honeymoonQuotaUnits : undefined,
        muralMessage: muralMessage.trim() || null,
        paymentMethod: payMethod,
        items: items.map((item) => ({
          giftId: item.giftId,
          quantity: item.quantity,
          customPrice: item.isHoneymoonFund ? (item.customPrice ?? item.unitPrice) : undefined,
        })),
        ...(card ? {
          creditCardToken: card.creditCardToken,
          holderName: card.holderName,
          holderCpf: card.holderCpf,
          holderPhone: card.holderPhone,
          holderPostalCode: card.holderPostalCode,
          holderAddressNumber: card.holderAddressNumber,
          installments: card.installments,
        } : {}),
      };

      const result = await createOrder(payload, idempotencyKeyRef.current);
      setOrderResult(result);

      if (payMethod === "pix") {
        setStep("pix_waiting");
      } else {
        if (result.status === "paid") {
          setStep("success");
          onSuccess();
        } else if (result.status === "failed") {
          setErrorMsg("Cartão recusado. Verifique os dados e tente novamente.");
          setStep("error");
        } else {
          setStep("success");
          onSuccess();
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao processar pagamento.");
      setStep("error");
    }
  }

  const installmentValue = installments > 1 ? checkoutTotal / installments : checkoutTotal;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto border-gray-200 bg-[#FDFCF8] text-[#333]"
        style={rootStyle}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>
            {step === "details" && "Finalizar Compra"}
            {step === "card" && "Dados do Cartão"}
            {step === "processing" && "Processando…"}
            {step === "pix_waiting" && "Aguardando Pagamento PIX"}
            {step === "success" && "Compra Confirmada!"}
            {step === "error" && "Erro no Pagamento"}
          </DialogTitle>
        </DialogHeader>

        {/* Step: details */}
        {step === "details" && (
          <div className="space-y-4">
            <div
              className="rounded-lg border border-dashed p-3 space-y-2"
              style={{ borderColor: `${primaryColor}88`, backgroundColor: `${primaryColor}08` }}
            >
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 shrink-0" style={{ color: primaryColor }} aria-hidden />
                <p className="text-sm font-semibold" style={{ color: primaryColor }}>
                  Quota para a lua de mel (opcional)
                </p>
              </div>
              <p className="text-xs text-gray-600 leading-snug">
                Cada cota equivale a {fmtBrl(HONEYMOON_QUOTA_UNIT)}. Você pode somar à compra para os noivos; o valor entra neste mesmo pagamento.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" aria-label="Menos uma cota"
                    onClick={() => setHoneymoonQuotaUnits((n) => Math.max(0, n - 1))}>−</Button>
                  <span className="w-8 text-center tabular-nums font-medium text-sm">{honeymoonQuotaUnits}</span>
                  <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0" aria-label="Mais uma cota"
                    onClick={() => setHoneymoonQuotaUnits((n) => Math.min(100, n + 1))}>+</Button>
                </div>
                <span className="text-sm text-gray-700">
                  {honeymoonQuotaUnits === 0 ? "Nenhuma cota extra" : `${fmtBrl(quotaAmount)} (${honeymoonQuotaUnits} × ${fmtBrl(HONEYMOON_QUOTA_UNIT)})`}
                </span>
              </div>
            </div>

            {/* Order summary */}
            <div className="rounded-lg border border-gray-100 bg-white p-3 space-y-1">
              {items.map((item, i) => {
                const price = item.isHoneymoonFund ? (item.customPrice ?? item.unitPrice) : item.unitPrice;
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.name} ×{item.quantity}</span>
                    <span className="font-medium">{fmtBrl(price * item.quantity)}</span>
                  </div>
                );
              })}
              {honeymoonQuotaUnits > 0 && (
                <div className="flex justify-between text-sm text-gray-700">
                  <span>Cotas lua de mel ×{honeymoonQuotaUnits}</span>
                  <span className="font-medium">{fmtBrl(quotaAmount)}</span>
                </div>
              )}
              <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                <span>Total</span>
                <span style={{ color: primaryColor }}>{fmtBrl(checkoutTotal)}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold">Nome de quem está pagando *</label>
              <Input className={inputClass} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Nome completo" autoComplete="name" />
              <p className="text-xs text-gray-500 mt-1">Use o nome de quem efetua o pagamento (pode ser diferente do convidado do convite).</p>
            </div>

            <div>
              <label className="text-sm font-semibold">Telefone (WhatsApp) *</label>
              <Input className={inputClass} value={buyerPhone}
                onChange={(e) => setBuyerPhone(displayPhoneBr(stripPhoneDigits(e.target.value)))}
                placeholder="(00) 00000-0000" inputMode="tel" autoComplete="tel" />
              <p className="text-xs text-gray-500 mt-1">Obrigatório para contato e confirmação; edite se outra pessoa for pagar.</p>
            </div>

            <div>
              <label className="text-sm font-semibold">CPF *</label>
              <Input
                className={inputClass}
                value={buyerCpf}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  const fmt = digits.length <= 3 ? digits
                    : digits.length <= 6 ? `${digits.slice(0, 3)}.${digits.slice(3)}`
                    : digits.length <= 9 ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
                    : `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
                  setBuyerCpf(fmt);
                }}
                placeholder="000.000.000-00"
                inputMode="numeric"
                autoComplete="off"
              />
              <p className="text-xs text-gray-500 mt-1">Obrigatório para emissão do comprovante de pagamento.</p>
            </div>

            <div>
              <label className="text-sm font-semibold">Mensagem para o Mural (opcional)</label>
              <textarea className={`${inputClass} min-h-[80px] resize-none`} value={muralMessage}
                onChange={(e) => setMuralMessage(e.target.value)} maxLength={500} placeholder="Uma mensagem para os noivos…" />
              <p className="text-xs text-gray-400 text-right">{muralMessage.length}/500</p>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">Forma de pagamento</label>
              <div className="grid gap-2">
                {([
                  { id: "pix" as const, label: "PIX", icon: <QrCode className="w-5 h-5" />, desc: "Pagamento instantâneo" },
                  { id: "credit_card" as const, label: "Cartão de Crédito", icon: <CreditCard className="w-5 h-5" />, desc: "Até 12x" },
                ] as const).map((pm) => (
                  <button key={pm.id} type="button" onClick={() => setPayMethod(pm.id)}
                    className={cn("flex items-center gap-3 p-3 rounded-lg border text-left transition-colors", payMethod === pm.id ? "bg-black/[0.03]" : "border-gray-200")}
                    style={payMethod === pm.id ? { borderColor: primaryColor } : {}}>
                    {pm.icon}
                    <div>
                      <div className="font-medium text-sm">{pm.label}</div>
                      <div className="text-xs text-gray-500">{pm.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full text-white rounded-full" style={{ backgroundColor: primaryColor }} onClick={() => void handleContinue()}>
              Continuar
            </Button>
          </div>
        )}

        {/* Step: card — sensitive fields use uncontrolled refs (never stored in React state) */}
        {step === "card" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 border">
              🔒 Seus dados de cartão são criptografados e tokenizados localmente antes de qualquer envio.
            </p>
            <div>
              <label className="text-sm font-semibold">Número do cartão</label>
              <input ref={cardNumberRef} className={inputClass} placeholder="0000 0000 0000 0000" maxLength={19}
                autoComplete="cc-number" inputMode="numeric" />
            </div>
            <div>
              <label className="text-sm font-semibold">Nome no cartão</label>
              <input ref={cardHolderRef} className={inputClass} autoComplete="cc-name" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-semibold">Validade (MM/AA)</label>
                <input ref={cardExpiryRef} className={inputClass} placeholder="MM/AA" maxLength={5} autoComplete="cc-exp" />
              </div>
              <div>
                <label className="text-sm font-semibold">CVV</label>
                <input ref={cardCvvRef} className={inputClass} maxLength={4} autoComplete="cc-csc" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">CPF do titular *</label>
              <Input className={inputClass} value={holderCpf} onChange={(e) => setHolderCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-semibold">CEP</label>
                <Input className={inputClass} value={holderPostalCode} onChange={(e) => setHolderPostalCode(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Número</label>
                <Input className={inputClass} value={holderAddressNumber} onChange={(e) => setHolderAddressNumber(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">Parcelas</label>
              <select className={`${inputClass} mt-1`} value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}x de {fmtBrl(checkoutTotal / n)}</option>
                ))}
              </select>
            </div>
            {installments > 1 && (
              <p className="text-xs text-gray-500 text-right">Total: {fmtBrl(installmentValue * installments)}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("details")}>Voltar</Button>
              <Button className="flex-1 text-white" style={{ backgroundColor: primaryColor }} onClick={() => void handleCardSubmit()}>
                Pagar {fmtBrl(checkoutTotal)}
              </Button>
            </div>
          </div>
        )}

        {/* Step: processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center py-10 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: primaryColor }} />
            <p className="text-sm text-gray-600">Processando pagamento…</p>
          </div>
        )}

        {/* Step: pix_waiting */}
        {step === "pix_waiting" && orderResult && (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-600">Escaneie o QR Code ou copie o código PIX. A confirmação é automática.</div>

            {orderResult.pixQrCode && (
              <div className="flex justify-center">
                <img src={`data:image/png;base64,${orderResult.pixQrCode}`} alt="QR Code PIX" className="w-48 h-48 border rounded-lg" />
              </div>
            )}

            {orderResult.pixCopyPaste && (
              <div className="space-y-2">
                <div className="text-xs break-all p-2 bg-white rounded border border-gray-200 max-h-20 overflow-hidden">{orderResult.pixCopyPaste}</div>
                <Button variant="outline" size="sm" className="w-full gap-2"
                  onClick={async () => {
                    try { await copyTextToClipboard(orderResult.pixCopyPaste!); toast({ title: "Código PIX copiado!" }); }
                    catch { toast({ variant: "destructive", title: "Não foi possível copiar" }); }
                  }}>
                  <Copy className="w-4 h-4" /> Copiar código PIX
                </Button>
              </div>
            )}

            {pixTimer && (
              <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>Expira em {pixTimer}</span>
              </div>
            )}

            <div className="flex items-center gap-2 justify-center text-xs text-gray-400">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400" />
              Aguardando confirmação do pagamento…
            </div>

            <Button variant="outline" className="w-full" onClick={onClose}>Fechar e pagar depois</Button>
          </div>
        )}

        {/* Step: success */}
        {step === "success" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <CheckCircle className="w-14 h-14 text-green-600" />
              <p className="text-lg font-semibold" style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}>Obrigado pelo seu presente!</p>
              <p className="text-sm text-gray-600">Seu pagamento foi confirmado. Os noivos já foram notificados.</p>
            </div>
            <Button className="w-full text-white rounded-full" style={{ backgroundColor: primaryColor }} onClick={onClose}>Fechar</Button>
          </div>
        )}

        {/* Step: error */}
        {step === "error" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-2 py-4">
              <AlertCircle className="w-14 h-14 text-red-500" />
              <p className="text-sm text-gray-700">{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("details")}>Tentar novamente</Button>
              <Button variant="outline" className="flex-1" onClick={onClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
