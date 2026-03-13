import { useState } from "react";
import { useParams } from "wouter";
import { useListGifts, useCreateGiftOrder } from "@workspace/api-client-react";
import type { GiftOrderInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gift, QrCode, FileText, CreditCard, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PaymentMethod = "pix" | "boleto" | "credit_card";

interface CheckoutState {
  giftId: number | null;
  giftName: string;
  amount: number;
  step: "select" | "details" | "card_details" | "payment" | "result";
  guestName: string;
  guestEmail: string;
  guestCpf: string;
  paymentMethod: PaymentMethod;
  cardNumber: string;
  cardName: string;
  cardExpiry: string;
  cardCvv: string;
  cardHolderCpf: string;
  cardHolderPhone: string;
  cardHolderPostalCode: string;
  cardHolderAddressNumber: string;
  installmentCount: number;
}

interface PaymentResultData {
  success: boolean;
  message: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  bankSlipUrl?: string;
  invoiceUrl?: string;
}

const INITIAL_STATE: CheckoutState = {
  giftId: null,
  giftName: "",
  amount: 0,
  step: "select",
  guestName: "",
  guestEmail: "",
  guestCpf: "",
  paymentMethod: "pix",
  cardNumber: "",
  cardName: "",
  cardExpiry: "",
  cardCvv: "",
  cardHolderCpf: "",
  cardHolderPhone: "",
  cardHolderPostalCode: "",
  cardHolderAddressNumber: "",
  installmentCount: 1,
};

export default function Checkout() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { toast } = useToast();
  const { data: gifts, isLoading } = useListGifts(wid);
  const createOrderMutation = useCreateGiftOrder();

  const [state, setState] = useState<CheckoutState>({ ...INITIAL_STATE });
  const [result, setResult] = useState<PaymentResultData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectGift = (gift: { id: number; name: string; price: number }) => {
    setState({
      ...state,
      giftId: gift.id,
      giftName: gift.name,
      amount: gift.price || 0,
      step: "details",
    });
    setIsOpen(true);
  };

  const handlePayment = async () => {
    if (!state.guestName.trim()) {
      toast({ variant: "destructive", title: "Informe seu nome" });
      return;
    }
    if (state.amount <= 0) {
      toast({ variant: "destructive", title: "Valor deve ser maior que zero" });
      return;
    }

    if (state.paymentMethod === "credit_card") {
      setState({ ...state, step: "card_details" });
      return;
    }

    await processPayment();
  };

  const handleCardPayment = async () => {
    if (!state.cardNumber || !state.cardName || !state.cardExpiry || !state.cardCvv) {
      toast({ variant: "destructive", title: "Preencha todos os dados do cartão" });
      return;
    }
    if (!state.cardHolderCpf) {
      toast({ variant: "destructive", title: "CPF do titular é obrigatório" });
      return;
    }
    await processPayment();
  };

  const processPayment = async () => {
    setState(prev => ({ ...prev, step: "payment" }));

    try {
      const [expMonth, expYear] = state.cardExpiry.split("/");

      const orderData: GiftOrderInput = {
        giftId: state.giftId ?? 0,
        guestName: state.guestName,
        guestEmail: state.guestEmail || null,
        guestCpf: state.guestCpf || null,
        amount: state.amount,
        paymentMethod: state.paymentMethod,
        creditCardNumber: state.paymentMethod === "credit_card" ? state.cardNumber.replace(/\s/g, "") : null,
        creditCardHolderName: state.paymentMethod === "credit_card" ? state.cardName : null,
        creditCardExpiryMonth: state.paymentMethod === "credit_card" ? (expMonth || null) : null,
        creditCardExpiryYear: state.paymentMethod === "credit_card" ? (expYear || null) : null,
        creditCardCcv: state.paymentMethod === "credit_card" ? state.cardCvv : null,
        creditCardHolderCpf: state.paymentMethod === "credit_card" ? state.cardHolderCpf : null,
        creditCardHolderEmail: state.paymentMethod === "credit_card" ? (state.guestEmail || null) : null,
        creditCardHolderPhone: state.paymentMethod === "credit_card" ? (state.cardHolderPhone || null) : null,
        creditCardHolderPostalCode: state.paymentMethod === "credit_card" ? (state.cardHolderPostalCode || null) : null,
        creditCardHolderAddressNumber: state.paymentMethod === "credit_card" ? (state.cardHolderAddressNumber || null) : null,
        installmentCount: state.paymentMethod === "credit_card" && state.installmentCount > 1 ? state.installmentCount : null,
      };

      const orderResult = await createOrderMutation.mutateAsync({
        weddingId: wid,
        data: orderData,
      });
      setResult({
        success: true,
        message: state.paymentMethod === "credit_card"
          ? "Pagamento com cartão processado com sucesso!"
          : "Pagamento criado com sucesso! Complete o pagamento abaixo.",
        pixQrCode: orderResult.pixQrCode || undefined,
        pixCopyPaste: orderResult.pixCopyPaste || undefined,
        bankSlipUrl: orderResult.bankSlipUrl || undefined,
        invoiceUrl: orderResult.invoiceUrl || undefined,
      });
      setState(prev => ({ ...prev, step: "result" }));
    } catch (e: unknown) {
      setResult({
        success: false,
        message: e instanceof Error ? e.message : "Erro ao processar pagamento. Tente novamente.",
      });
      setState(prev => ({ ...prev, step: "result" }));
    }
  };

  const resetCheckout = () => {
    setState({ ...INITIAL_STATE });
    setResult(null);
    setIsOpen(false);
  };

  const paymentMethods: { id: PaymentMethod; label: string; icon: React.ReactNode; description: string }[] = [
    { id: "pix", label: "PIX", icon: <QrCode className="w-5 h-5" />, description: "Pagamento instantâneo" },
    { id: "boleto", label: "Boleto", icon: <FileText className="w-5 h-5" />, description: "Vencimento em 3 dias" },
    { id: "credit_card", label: "Cartão de Crédito", icon: <CreditCard className="w-5 h-5" />, description: "Até 12x" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif text-foreground">Lista de Presentes</h1>
        <p className="text-muted-foreground mt-1">Escolha um presente e faça sua contribuição.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="h-40" /></Card>
          ))}
        </div>
      ) : gifts?.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Gift className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhum presente disponível no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gifts?.map(gift => {
            const value = Number(gift.price) || 0;
            return (
              <Card key={gift.id} className="hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer group"
                onClick={() => selectGift({ id: gift.id, name: gift.name, price: value })}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">{gift.name}</CardTitle>
                    <Badge variant="success">Disponível</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {gift.description && (
                    <p className="text-sm text-muted-foreground mb-3">{gift.description}</p>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-semibold text-primary">
                      {value > 0 ? `R$ ${value.toFixed(2)}` : "Valor livre"}
                    </span>
                    <Button variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      Presentear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetCheckout(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {state.step === "result" ? (result?.success ? "Obrigado!" : "Erro") :
               state.step === "card_details" ? "Dados do Cartão" :
               `Presentear: ${state.giftName}`}
            </DialogTitle>
          </DialogHeader>

          {state.step === "details" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Seu Nome *</label>
                <Input
                  value={state.guestName}
                  onChange={e => setState({ ...state, guestName: e.target.value })}
                  placeholder="Maria da Silva"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Seu Email</label>
                <Input
                  type="email"
                  value={state.guestEmail}
                  onChange={e => setState({ ...state, guestEmail: e.target.value })}
                  placeholder="maria@email.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Valor (R$)</label>
                <Input
                  type="number"
                  min={1}
                  step="0.01"
                  value={state.amount}
                  onChange={e => setState({ ...state, amount: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Forma de Pagamento</label>
                <div className="space-y-2">
                  {paymentMethods.map(pm => (
                    <button
                      key={pm.id}
                      onClick={() => setState({ ...state, paymentMethod: pm.id })}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                        state.paymentMethod === pm.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className={state.paymentMethod === pm.id ? "text-primary" : "text-muted-foreground"}>
                        {pm.icon}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{pm.label}</div>
                        <div className="text-xs text-muted-foreground">{pm.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handlePayment} className="w-full" size="lg">
                {state.paymentMethod === "credit_card" ? "Continuar" : `Confirmar - R$ ${state.amount.toFixed(2)}`}
              </Button>
            </div>
          )}

          {state.step === "card_details" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Número do Cartão *</label>
                <Input
                  value={state.cardNumber}
                  onChange={e => setState({ ...state, cardNumber: e.target.value })}
                  placeholder="0000 0000 0000 0000"
                  maxLength={19}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nome no Cartão *</label>
                <Input
                  value={state.cardName}
                  onChange={e => setState({ ...state, cardName: e.target.value })}
                  placeholder="MARIA DA SILVA"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Validade *</label>
                  <Input
                    value={state.cardExpiry}
                    onChange={e => setState({ ...state, cardExpiry: e.target.value })}
                    placeholder="MM/AAAA"
                    maxLength={7}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">CVV *</label>
                  <Input
                    value={state.cardCvv}
                    onChange={e => setState({ ...state, cardCvv: e.target.value })}
                    placeholder="123"
                    maxLength={4}
                    type="password"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">CPF do Titular *</label>
                <Input
                  value={state.cardHolderCpf}
                  onChange={e => setState({ ...state, cardHolderCpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone do Titular</label>
                <Input
                  value={state.cardHolderPhone}
                  onChange={e => setState({ ...state, cardHolderPhone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">CEP</label>
                  <Input
                    value={state.cardHolderPostalCode}
                    onChange={e => setState({ ...state, cardHolderPostalCode: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Número</label>
                  <Input
                    value={state.cardHolderAddressNumber}
                    onChange={e => setState({ ...state, cardHolderAddressNumber: e.target.value })}
                    placeholder="123"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Parcelas</label>
                <select
                  className="w-full border rounded-md p-2 text-sm"
                  value={state.installmentCount}
                  onChange={e => setState({ ...state, installmentCount: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>
                      {n}x de R$ {(state.amount / n).toFixed(2)}
                      {n === 1 ? " (à vista)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setState({ ...state, step: "details" })} className="flex-1">
                  Voltar
                </Button>
                <Button onClick={handleCardPayment} className="flex-1" size="lg">
                  Pagar R$ {state.amount.toFixed(2)}
                </Button>
              </div>
            </div>
          )}

          {state.step === "payment" && (
            <div className="py-8 text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-muted-foreground">Processando pagamento...</p>
            </div>
          )}

          {state.step === "result" && result && (
            <div className="py-4 space-y-4">
              <div className="text-center">
                {result.success ? (
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
                )}
                <p className={result.success ? "text-foreground font-medium" : "text-destructive"}>
                  {result.message}
                </p>
              </div>

              {result.pixQrCode && (
                <div className="text-center space-y-3 bg-muted/30 rounded-lg p-4">
                  <p className="text-sm font-medium">Escaneie o QR Code PIX:</p>
                  <img
                    src={`data:image/png;base64,${result.pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 mx-auto border rounded-lg"
                  />
                  {result.pixCopyPaste && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Ou copie o código:</p>
                      <div className="flex gap-2">
                        <Input value={result.pixCopyPaste} readOnly className="text-xs" />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { navigator.clipboard.writeText(result.pixCopyPaste || ""); toast({ title: "Código copiado!" }); }}
                        >
                          Copiar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {result.bankSlipUrl && (
                <div className="text-center bg-muted/30 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Boleto gerado:</p>
                  <Button asChild variant="outline">
                    <a href={result.bankSlipUrl} target="_blank" rel="noopener noreferrer">
                      <FileText className="w-4 h-4 mr-2" /> Visualizar Boleto
                    </a>
                  </Button>
                </div>
              )}

              {result.invoiceUrl && !result.bankSlipUrl && !result.pixQrCode && (
                <div className="text-center bg-muted/30 rounded-lg p-4">
                  <Button asChild variant="outline">
                    <a href={result.invoiceUrl} target="_blank" rel="noopener noreferrer">
                      Ver Fatura
                    </a>
                  </Button>
                </div>
              )}

              <Button onClick={resetCheckout} variant={result.success ? "default" : "outline"} className="w-full">
                {result.success ? "Voltar à Lista" : "Tentar Novamente"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
