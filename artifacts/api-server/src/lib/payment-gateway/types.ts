// Payment gateway abstraction — add new gateways by implementing PaymentGateway.
// NEVER log config.apiKey anywhere in this module or its adapters.

export type PaymentGatewayName = "asaas"; // extensível: | "stripe" | "mercado_pago"

export interface GatewayConfig {
  gatewayName: PaymentGatewayName;
  apiKey: string;
  environment: "sandbox" | "production";
  webhookSecret?: string | null;
  publicKey?: string | null;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreatePixPaymentInput {
  weddingId: number;
  orderId: number;
  guestId: number | null;
  amount: number;
  customerName: string;
  customerEmail?: string;
  customerCpf?: string;
  externalReference: string;
  expirationSeconds?: number;
}

/** Raw card fields are intentionally absent — only tokenized path is allowed. */
export interface CreateCreditCardPaymentInput {
  weddingId: number;
  orderId: number;
  guestId: number | null;
  amount: number;
  customerName: string;
  customerEmail?: string;
  customerCpf?: string;
  externalReference: string;
  creditCardToken: string;
  holderName: string;
  holderCpf: string;
  holderEmail?: string;
  holderPhone?: string;
  holderPostalCode?: string;
  holderAddressNumber?: string;
  installmentCount?: number;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type NormalizedPaymentStatus = "paid" | "pending" | "expired" | "failed" | "refunded" | "cancelled";

export interface PixPaymentResult {
  gatewayPaymentId: string;
  gatewayStatus: string;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  pixExpiresAt: string | null;
}

export interface CreditCardPaymentResult {
  gatewayPaymentId: string;
  gatewayStatus: string;
  normalizedStatus: NormalizedPaymentStatus;
}

export interface PaymentStatusResult {
  gatewayPaymentId: string;
  gatewayStatus: string;
  normalizedStatus: NormalizedPaymentStatus;
}

export interface WebhookParseResult {
  gatewayPaymentId: string;
  eventName: string;
  normalizedStatus: NormalizedPaymentStatus | null;
}

// ---------------------------------------------------------------------------
// Gateway interface
// ---------------------------------------------------------------------------

export interface PaymentGateway {
  readonly name: PaymentGatewayName;

  testConnection(config: GatewayConfig): Promise<{ success: boolean; message: string }>;

  createPixPayment(config: GatewayConfig, input: CreatePixPaymentInput): Promise<PixPaymentResult>;

  createCreditCardPayment(config: GatewayConfig, input: CreateCreditCardPaymentInput): Promise<CreditCardPaymentResult>;

  getPaymentStatus(config: GatewayConfig, gatewayPaymentId: string): Promise<PaymentStatusResult>;

  cancelPayment(config: GatewayConfig, gatewayPaymentId: string): Promise<void>;

  verifyAndParseWebhook(
    config: GatewayConfig,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<WebhookParseResult>;
}
