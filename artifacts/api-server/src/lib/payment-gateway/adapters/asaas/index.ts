// NEVER log config.apiKey in this file.
import type {
  GatewayConfig,
  PaymentGateway,
  CreatePixPaymentInput,
  CreateCreditCardPaymentInput,
  PixPaymentResult,
  CreditCardPaymentResult,
  PaymentStatusResult,
  WebhookParseResult,
  NormalizedPaymentStatus,
} from "../../types";

function baseUrl(env: "sandbox" | "production"): string {
  return env === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

async function findOrCreateCustomer(
  url: string,
  apiKey: string,
  name: string,
  email?: string,
  cpf?: string,
): Promise<string> {
  const res = await fetch(`${url}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({ name, email: email || undefined, ...(cpf ? { cpfCnpj: cpf } : {}) }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asaas: falha ao criar cliente (${res.status}): ${text}`);
  }
  const data = await res.json() as { id: string };
  return data.id;
}

function normalizeAsaasStatus(status: string): NormalizedPaymentStatus {
  switch (status) {
    case "CONFIRMED":
    case "RECEIVED": return "paid";
    case "PENDING":
    case "AWAITING_RISK_ANALYSIS": return "pending";
    case "DECLINED":
    case "REFUND_REQUESTED": return "failed";
    case "OVERDUE": return "expired";
    case "DELETED": return "cancelled";
    case "REFUNDED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
    case "AWAITING_CHARGEBACK_REVERSAL":
    case "DUNNING_REQUESTED":
    case "DUNNING_RECEIVED": return "refunded";
    default: return "pending";
  }
}

export class AsaasGateway implements PaymentGateway {
  readonly name = "asaas" as const;

  async testConnection(config: GatewayConfig): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${baseUrl(config.environment)}/finance/balance`, {
        headers: { access_token: config.apiKey },
      });
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        return { success: true, message: `Conectado! Saldo: R$ ${data.balance ?? 0}` };
      }
      return { success: false, message: `Erro na conexão: ${res.status} ${res.statusText}` };
    } catch (e: unknown) {
      return { success: false, message: `Erro: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  async createPixPayment(config: GatewayConfig, input: CreatePixPaymentInput): Promise<PixPaymentResult> {
    const url = baseUrl(config.environment);
    const customerId = await findOrCreateCustomer(url, config.apiKey, input.customerName, input.customerEmail, input.customerCpf);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const expiresAt = input.expirationSeconds
      ? new Date(Date.now() + input.expirationSeconds * 1000).toISOString()
      : undefined;

    const res = await fetch(`${url}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: config.apiKey },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: input.amount,
        dueDate: dueDate.toISOString().split("T")[0],
        description: `Presente de casamento - ${input.customerName}`,
        externalReference: input.externalReference,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Asaas: falha ao criar cobrança PIX (${res.status}): ${text}`);
    }

    const payment = await res.json() as { id: string; status: string };

    let pixQrCode: string | null = null;
    let pixCopyPaste: string | null = null;
    let pixExpiresAt: string | null = expiresAt ?? null;

    try {
      const qrRes = await fetch(`${url}/payments/${payment.id}/pixQrCode`, {
        headers: { access_token: config.apiKey },
      });
      if (qrRes.ok) {
        const qr = await qrRes.json() as { encodedImage: string; payload: string; expirationDate?: string };
        pixQrCode = qr.encodedImage;
        pixCopyPaste = qr.payload;
        if (qr.expirationDate) pixExpiresAt = qr.expirationDate;
      }
    } catch {
      // QR fetch failure is non-critical; webhook/polling will confirm
    }

    return { gatewayPaymentId: payment.id, gatewayStatus: payment.status, pixQrCode, pixCopyPaste, pixExpiresAt };
  }

  async createCreditCardPayment(config: GatewayConfig, input: CreateCreditCardPaymentInput): Promise<CreditCardPaymentResult> {
    const url = baseUrl(config.environment);
    const customerId = await findOrCreateCustomer(url, config.apiKey, input.customerName, input.customerEmail, input.customerCpf);

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);

    const installmentCount = input.installmentCount && input.installmentCount > 1 ? input.installmentCount : 1;

    const body: Record<string, unknown> = {
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: input.amount,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `Presente de casamento - ${input.customerName}`,
      externalReference: input.externalReference,
      creditCardToken: input.creditCardToken,
      creditCardHolderInfo: {
        name: input.holderName,
        cpfCnpj: input.holderCpf,
        email: input.holderEmail || input.customerEmail || "",
        phone: input.holderPhone || "",
        postalCode: input.holderPostalCode || "",
        addressNumber: input.holderAddressNumber || "",
      },
    };

    if (installmentCount > 1) {
      body.installmentCount = installmentCount;
      body.installmentValue = Math.ceil((input.amount / installmentCount) * 100) / 100;
    }

    const res = await fetch(`${url}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: config.apiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Asaas: falha ao criar cobrança no cartão (${res.status}): ${text}`);
    }

    const payment = await res.json() as { id: string; status: string };
    return {
      gatewayPaymentId: payment.id,
      gatewayStatus: payment.status,
      normalizedStatus: normalizeAsaasStatus(payment.status),
    };
  }

  async getPaymentStatus(config: GatewayConfig, gatewayPaymentId: string): Promise<PaymentStatusResult> {
    const res = await fetch(`${baseUrl(config.environment)}/payments/${gatewayPaymentId}`, {
      headers: { access_token: config.apiKey },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Asaas: falha ao consultar pagamento (${res.status}): ${text}`);
    }
    const data = await res.json() as { id: string; status: string };
    return {
      gatewayPaymentId: data.id,
      gatewayStatus: data.status,
      normalizedStatus: normalizeAsaasStatus(data.status),
    };
  }

  async cancelPayment(config: GatewayConfig, gatewayPaymentId: string): Promise<void> {
    const res = await fetch(`${baseUrl(config.environment)}/payments/${gatewayPaymentId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", access_token: config.apiKey },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null) as { errors?: Array<{ description: string }> } | null;
      const msg = data?.errors?.[0]?.description ?? `${res.status} ${res.statusText}`;
      throw new Error(`Asaas: falha ao cancelar/estornar: ${msg}`);
    }
  }

  async verifyAndParseWebhook(
    config: GatewayConfig,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<WebhookParseResult> {
    const token = headers["asaas-access-token"];
    const tokenStr = Array.isArray(token) ? token[0] : token;

    if (!tokenStr || !config.webhookSecret || tokenStr !== config.webhookSecret) {
      throw new Error("Asaas webhook: token inválido");
    }

    const payload = body as { event?: string; payment?: { id?: string } };
    if (!payload?.payment?.id) {
      throw new Error("Asaas webhook: payload inválido");
    }

    const event = payload.event ?? "";
    let normalizedStatus: NormalizedPaymentStatus | null = null;

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      normalizedStatus = "paid";
    } else if (event === "PAYMENT_OVERDUE") {
      normalizedStatus = "expired";
    } else if (event === "PAYMENT_DELETED") {
      normalizedStatus = "cancelled";
    } else if (event === "PAYMENT_REFUNDED") {
      normalizedStatus = "refunded";
    }

    return {
      gatewayPaymentId: payload.payment.id,
      eventName: event,
      normalizedStatus,
    };
  }
}
