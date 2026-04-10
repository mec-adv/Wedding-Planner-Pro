import type { CSSProperties } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/phone-input";
import { QrCode, FileText, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { CheckoutState, PaymentResultData } from "./public-invite-types";

interface InviteCheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  checkout: CheckoutState;
  onChange: (patch: Partial<CheckoutState>) => void;
  payResult: PaymentResultData | null;
  primaryColor: string;
  onContinue: () => void;
  onCardPayment: () => void;
}

const PAYMENT_METHODS = [
  { id: "pix" as const, label: "PIX", icon: <QrCode className="w-5 h-5" />, description: "Pagamento instantâneo" },
  { id: "boleto" as const, label: "Boleto", icon: <FileText className="w-5 h-5" />, description: "Vencimento em 3 dias" },
  { id: "credit_card" as const, label: "Cartão de Crédito", icon: <CreditCard className="w-5 h-5" />, description: "Até 12x" },
];

export function InviteCheckoutDialog({
  open,
  onClose,
  checkout,
  onChange,
  payResult,
  primaryColor,
  onContinue,
  onCardPayment,
}: InviteCheckoutDialogProps) {
  const { toast } = useToast();
  const inputFieldClass = cn(
    "w-full border border-gray-300 rounded px-4 py-2 focus:outline-none focus:ring-1 bg-white text-[#333] placeholder:text-gray-400",
    "focus:ring-[color:var(--invite-primary)] focus:border-[color:var(--invite-primary)]",
  );
  const rootStyle: CSSProperties = { ["--invite-primary" as string]: primaryColor } as CSSProperties;

  const stepTitle = () => {
    if (checkout.step === "result") return payResult?.success ? "Obrigado!" : "Erro";
    if (checkout.step === "card_details") return "Dados do cartão";
    return `Presentear: ${checkout.giftName}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto border-gray-200 bg-[#FDFCF8] text-[#333]"
        style={rootStyle}
      >
        <DialogHeader>
          <DialogTitle
            className="text-xl"
            style={{ fontFamily: "'Cormorant Garamond', serif", color: primaryColor }}
          >
            {stepTitle()}
          </DialogTitle>
        </DialogHeader>

        {/* Step: details */}
        {checkout.step === "details" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Seu nome *</label>
              <Input
                className={inputFieldClass}
                value={checkout.guestName}
                onChange={(e) => onChange({ guestName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Email</label>
              <Input
                type="email"
                className={inputFieldClass}
                value={checkout.guestEmail}
                onChange={(e) => onChange({ guestEmail: e.target.value })}
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
                onChange={(e) => onChange({ amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Mensagem para o casal (opcional)</label>
              <textarea
                className={`${inputFieldClass} min-h-[80px]`}
                value={checkout.coupleMessage}
                onChange={(e) => onChange({ coupleMessage: e.target.value })}
                maxLength={2000}
                placeholder="Um carinho, um votinho…"
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Forma de pagamento</label>
              <p className="text-xs text-gray-500 mb-2">Recomendamos PIX ou boleto.</p>
              <div className="grid gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => onChange({ paymentMethod: pm.id })}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                      checkout.paymentMethod === pm.id ? "bg-black/[0.03]" : "border-gray-200",
                    )}
                    style={checkout.paymentMethod === pm.id ? { borderColor: primaryColor } : {}}
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
            <Button
              className="w-full text-white rounded-full"
              style={{ backgroundColor: primaryColor }}
              onClick={onContinue}
            >
              Continuar
            </Button>
          </div>
        )}

        {/* Step: card_details */}
        {checkout.step === "card_details" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">Número do cartão</label>
              <Input
                className={inputFieldClass}
                value={checkout.cardNumber}
                onChange={(e) => onChange({ cardNumber: e.target.value })}
                placeholder="0000 0000 0000 0000"
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Nome no cartão</label>
              <Input
                className={inputFieldClass}
                value={checkout.cardName}
                onChange={(e) => onChange({ cardName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-semibold">Validade (MM/AA)</label>
                <Input
                  className={inputFieldClass}
                  value={checkout.cardExpiry}
                  onChange={(e) => onChange({ cardExpiry: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">CVV</label>
                <Input
                  className={inputFieldClass}
                  value={checkout.cardCvv}
                  onChange={(e) => onChange({ cardCvv: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">CPF do titular *</label>
              <Input
                className={inputFieldClass}
                value={checkout.cardHolderCpf}
                onChange={(e) => onChange({ cardHolderCpf: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-semibold">Celular do titular</label>
              <PhoneInput
                className={inputFieldClass}
                value={checkout.cardHolderPhoneDigits}
                onDigitsChange={(digits) => onChange({ cardHolderPhoneDigits: digits })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-semibold">CEP</label>
                <Input
                  className={inputFieldClass}
                  value={checkout.cardHolderPostalCode}
                  onChange={(e) => onChange({ cardHolderPostalCode: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Número</label>
                <Input
                  className={inputFieldClass}
                  value={checkout.cardHolderAddressNumber}
                  onChange={(e) => onChange({ cardHolderAddressNumber: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">Parcelas</label>
              <select
                className={`${inputFieldClass} mt-1`}
                value={checkout.installmentCount}
                onChange={(e) => onChange({ installmentCount: Number(e.target.value) })}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onChange({ step: "details" })}
              >
                Voltar
              </Button>
              <Button
                className="flex-1 text-white"
                style={{ backgroundColor: primaryColor }}
                onClick={onCardPayment}
              >
                Pagar
              </Button>
            </div>
          </div>
        )}

        {/* Step: payment (loading) */}
        {checkout.step === "payment" && (
          <div className="flex flex-col items-center py-8 gap-2">
            <div
              className="animate-spin rounded-full h-10 w-10 border-b-2"
              style={{ borderColor: primaryColor }}
            />
            <p className="text-sm text-gray-600">Processando pagamento…</p>
          </div>
        )}

        {/* Step: result */}
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
                <div className="text-xs break-all p-2 bg-white rounded border border-gray-200">
                  {payResult.pixCopyPaste}
                </div>
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
              <Button asChild className="w-full text-white" style={{ backgroundColor: primaryColor }}>
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
            <Button
              className="w-full"
              style={{ backgroundColor: primaryColor, color: "#fff" }}
              onClick={onClose}
            >
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
