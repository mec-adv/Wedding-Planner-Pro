import { useState, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, CreditCard, CheckCircle, AlertCircle, Copy, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/clipboard";
import { createOrder, fetchOrderStatus } from "@/lib/shop-api";
import type { CartItem, CreateOrderResult } from "@/lib/shop-api";

interface Props {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  totalAmount: number;
  guestToken: string;
  guestName: string;
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

export function ShopCheckoutDialog({
  open,
  onClose,
  items,
  totalAmount,
  guestToken,
  guestName,
  primaryColor,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const rootStyle: CSSProperties = { ["--invite-primary" as string]: primaryColor };

  const [step, setStep] = useState<Step>("details");
  const [buyerName, setBuyerName] = useState(guestName);
  const [muralMessage, setMuralMessage] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("pix");
  const [errorMsg, setErrorMsg] = useState("");

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [holderCpf, setHolderCpf] = useState("");
  const [holderPhone, setHolderPhone] = useState("");
  const [holderPostalCode, setHolderPostalCode] = useState("");
  const [holderAddressNumber, setHolderAddressNumber] = useState("");
  const [installments, setInstallments] = useState(1);

  // PIX result
  const [orderResult, setOrderResult] = useState<CreateOrderResult | null>(null);
  const [pixTimer, setPixTimer] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("details");
      setBuyerName(guestName);
      setMuralMessage("");
      setPayMethod("pix");
      setErrorMsg("");
      setOrderResult(null);
      setCardNumber(""); setCardHolder(""); setCardExpiry(""); setCardCvv(""); setHolderCpf("");
      setHolderPhone(""); setHolderPostalCode(""); setHolderAddressNumber(""); setInstallments(1);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [open, guestName]);

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
    if (payMethod === "credit_card") { setStep("card"); return; }
    await submitOrder();
  }

  async function handleCardSubmit() {
    const [expMonth, expYear] = cardExpiry.split("/");
    if (!cardNumber || !cardHolder || !expMonth || !expYear || !cardCvv || !holderCpf) {
      toast({ variant: "destructive", title: "Preencha todos os dados do cartão e CPF do titular" });
      return;
    }
    await submitOrder({ cardNumber, cardHolder, expMonth: expMonth.trim(), expYear: expYear.trim(), cardCvv, holderCpf, holderPhone, holderPostalCode, holderAddressNumber, installments });
  }

  async function submitOrder(card?: { cardNumber: string; cardHolder: string; expMonth: string; expYear: string; cardCvv: string; holderCpf: string; holderPhone: string; holderPostalCode: string; holderAddressNumber: string; installments: number }) {
    setStep("processing");
    try {
      const payload = {
        guestToken,
        buyerName: buyerName.trim(),
        muralMessage: muralMessage.trim() || null,
        paymentMethod: payMethod,
        items: items.map((item) => ({
          giftId: item.giftId,
          quantity: item.quantity,
          customPrice: item.isHoneymoonFund ? (item.customPrice ?? item.unitPrice) : undefined,
        })),
        ...(card ? {
          cardNumber: card.cardNumber.replace(/\s/g, ""),
          cardHolderName: card.cardHolder,
          cardExpiryMonth: card.expMonth,
          cardExpiryYear: card.expYear.length === 2 ? `20${card.expYear}` : card.expYear,
          cardCcv: card.cardCvv,
          holderName: card.cardHolder,
          holderCpf: card.holderCpf.replace(/\D/g, ""),
          holderPhone: card.holderPhone,
          holderPostalCode: card.holderPostalCode,
          holderAddressNumber: card.holderAddressNumber,
          installments: card.installments,
        } : {}),
      };

      const result = await createOrder(payload);
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

  const installmentValue = installments > 1 ? totalAmount / installments : totalAmount;

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
              <div className="border-t pt-1 mt-1 flex justify-between font-semibold">
                <span>Total</span>
                <span style={{ color: primaryColor }}>{fmtBrl(totalAmount)}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold">Seu nome *</label>
              <Input className={inputClass} value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-semibold">Mensagem para o Mural (opcional)</label>
              <textarea
                className={`${inputClass} min-h-[80px] resize-none`}
                value={muralMessage}
                onChange={(e) => setMuralMessage(e.target.value)}
                maxLength={500}
                placeholder="Uma mensagem para os noivos…"
              />
              <p className="text-xs text-gray-400 text-right">{muralMessage.length}/500</p>
            </div>

            <div>
              <label className="text-sm font-semibold mb-2 block">Forma de pagamento</label>
              <div className="grid gap-2">
                {([
                  { id: "pix" as const, label: "PIX", icon: <QrCode className="w-5 h-5" />, desc: "Pagamento instantâneo" },
                  { id: "credit_card" as const, label: "Cartão de Crédito", icon: <CreditCard className="w-5 h-5" />, desc: "Até 12x" },
                ] as const).map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPayMethod(pm.id)}
                    className={cn("flex items-center gap-3 p-3 rounded-lg border text-left transition-colors", payMethod === pm.id ? "bg-black/[0.03]" : "border-gray-200")}
                    style={payMethod === pm.id ? { borderColor: primaryColor } : {}}
                  >
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

        {/* Step: card */}
        {step === "card" && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Número do cartão</label>
              <Input className={inputClass} value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="0000 0000 0000 0000" maxLength={19} />
            </div>
            <div>
              <label className="text-sm font-semibold">Nome no cartão</label>
              <Input className={inputClass} value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-semibold">Validade (MM/AA)</label>
                <Input className={inputClass} value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/AA" maxLength={5} />
              </div>
              <div>
                <label className="text-sm font-semibold">CVV</label>
                <Input className={inputClass} value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} maxLength={4} />
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
                  <option key={n} value={n}>{n}x de {fmtBrl(totalAmount / n)}</option>
                ))}
              </select>
            </div>
            {installments > 1 && (
              <p className="text-xs text-gray-500 text-right">Total: {fmtBrl(installmentValue * installments)}</p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("details")}>Voltar</Button>
              <Button className="flex-1 text-white" style={{ backgroundColor: primaryColor }} onClick={() => void handleCardSubmit()}>Pagar {fmtBrl(totalAmount)}</Button>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  onClick={async () => {
                    try { await copyTextToClipboard(orderResult.pixCopyPaste!); toast({ title: "Código PIX copiado!" }); }
                    catch { toast({ variant: "destructive", title: "Não foi possível copiar" }); }
                  }}
                >
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
