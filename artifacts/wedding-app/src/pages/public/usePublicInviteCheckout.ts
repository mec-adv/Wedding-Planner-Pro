import { useState } from "react";
import { useCreatePublicGiftOrder } from "@workspace/api-client-react";
import type { GiftOrderInput, PublicGiftOrderInput } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  type CheckoutState,
  type PaymentResultData,
  INITIAL_CHECKOUT,
} from "./public-invite-types";

export function usePublicInviteCheckout(token: string) {
  const [checkout, setCheckout] = useState<CheckoutState>({ ...INITIAL_CHECKOUT });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payResult, setPayResult] = useState<PaymentResultData | null>(null);

  const { toast } = useToast();
  const createOrder = useCreatePublicGiftOrder();

  const selectGift = (gift: { id: number; name: string; price: number }, guestName: string) => {
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

  const resetCheckout = () => {
    setCheckout({ ...INITIAL_CHECKOUT });
    setPayResult(null);
    setCheckoutOpen(false);
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
        creditCardNumber:
          checkout.paymentMethod === "credit_card" ? checkout.cardNumber.replace(/\s/g, "") : null,
        creditCardHolderName:
          checkout.paymentMethod === "credit_card" ? checkout.cardName : null,
        creditCardExpiryMonth:
          checkout.paymentMethod === "credit_card" ? (expMonth || null) : null,
        creditCardExpiryYear:
          checkout.paymentMethod === "credit_card" ? (expYear || null) : null,
        creditCardCcv: checkout.paymentMethod === "credit_card" ? checkout.cardCvv : null,
        creditCardHolderCpf:
          checkout.paymentMethod === "credit_card" ? checkout.cardHolderCpf : null,
        creditCardHolderEmail:
          checkout.paymentMethod === "credit_card" ? (checkout.guestEmail || null) : null,
        creditCardHolderPhone:
          checkout.paymentMethod === "credit_card" ? checkout.cardHolderPhoneDigits.trim() || null : null,
        creditCardHolderPostalCode:
          checkout.paymentMethod === "credit_card" ? checkout.cardHolderPostalCode || null : null,
        creditCardHolderAddressNumber:
          checkout.paymentMethod === "credit_card" ? checkout.cardHolderAddressNumber || null : null,
        installmentCount:
          checkout.paymentMethod === "credit_card" && checkout.installmentCount > 1
            ? checkout.installmentCount
            : null,
        coupleMessage: checkout.coupleMessage.trim() || null,
      };
      const payload: PublicGiftOrderInput = { ...base, idempotencyKey };
      const orderResult = await createOrder.mutateAsync({ token, data: payload });

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
    } catch (e) {
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

  return {
    checkout,
    setCheckout,
    checkoutOpen,
    setCheckoutOpen,
    payResult,
    selectGift,
    resetCheckout,
    handlePayment,
    handleCardPayment,
    isProcessing: createOrder.isPending,
  };
}
