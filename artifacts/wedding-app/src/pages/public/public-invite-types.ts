export type PaymentMethod = "pix" | "boleto" | "credit_card";

export interface CheckoutState {
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

export const INITIAL_CHECKOUT: CheckoutState = {
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

export interface PaymentResultData {
  success: boolean;
  message: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  bankSlipUrl?: string;
  invoiceUrl?: string;
}

export const RSVP_LABELS: Record<string, string> = {
  pending: "Ainda não sei",
  confirmed: "Confirmo presença",
  declined: "Não poderei ir",
  maybe: "Talvez",
};
