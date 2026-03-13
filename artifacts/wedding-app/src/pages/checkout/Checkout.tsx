import { useState } from "react";
import { useParams } from "wouter";
import { useListGifts, useCreateGiftOrder } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gift, CreditCard, QrCode, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type PaymentMethod = "pix" | "boleto" | "credit_card";

interface CheckoutState {
  giftId: number | null;
  giftName: string;
  amount: number;
  step: "select" | "details" | "payment" | "result";
  guestName: string;
  guestEmail: string;
  paymentMethod: PaymentMethod;
}

export default function Checkout() {
  const { weddingId } = useParams();
  const wid = Number(weddingId);
  const { toast } = useToast();
  const { data: gifts, isLoading } = useListGifts(wid);
  const createOrderMutation = useCreateGiftOrder();

  const [state, setState] = useState<CheckoutState>({
    giftId: null,
    giftName: "",
    amount: 0,
    step: "select",
    guestName: "",
    guestEmail: "",
    paymentMethod: "pix",
  });

  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
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

    setState({ ...state, step: "payment" });

    try {
      await createOrderMutation.mutateAsync({
        weddingId: wid,
        data: {
          giftId: state.giftId ?? 0,
          guestName: state.guestName,
          guestEmail: state.guestEmail || undefined,
          amount: state.amount,
          paymentMethod: state.paymentMethod,
        },
      });
      setResult({ success: true, message: "Pagamento processado com sucesso! Obrigado pelo presente." });
      setState({ ...state, step: "result" });
    } catch (e: unknown) {
      setResult({
        success: false,
        message: e instanceof Error ? e.message : "Erro ao processar pagamento. Tente novamente.",
      });
      setState({ ...state, step: "result" });
    }
  };

  const resetCheckout = () => {
    setState({
      giftId: null,
      giftName: "",
      amount: 0,
      step: "select",
      guestName: "",
      guestEmail: "",
      paymentMethod: "pix",
    });
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {state.step === "result" ? (result?.success ? "Obrigado!" : "Erro") : `Presentear: ${state.giftName}`}
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
                Confirmar - R$ {state.amount.toFixed(2)}
              </Button>
            </div>
          )}

          {state.step === "payment" && (
            <div className="py-8 text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto" />
              <p className="text-muted-foreground">Processando pagamento...</p>
            </div>
          )}

          {state.step === "result" && result && (
            <div className="py-6 text-center space-y-4">
              {result.success ? (
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              ) : (
                <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
              )}
              <p className={result.success ? "text-foreground" : "text-destructive"}>
                {result.message}
              </p>
              <Button onClick={resetCheckout} variant={result.success ? "default" : "outline"}>
                {result.success ? "Voltar à Lista" : "Tentar Novamente"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
