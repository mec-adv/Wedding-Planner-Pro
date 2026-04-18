import { db, integrationSettingsTable, eq } from "@workspace/db";

export interface AsaasSettings {
  asaasApiKey: string;
  asaasEnvironment: string | null;
  asaasWebhookToken: string | null;
}

// Params for PIX payment
export interface CreatePixPaymentParams {
  amount: number;
  customerName: string;
  customerEmail?: string;
  customerCpf?: string;
  expirationSeconds?: number;
}

// Params for credit card payment.
// Pass creditCardToken (from Asaas.js) OR raw card fields — not both.
export interface CreateCreditCardPaymentParams {
  amount: number;
  customerName: string;
  customerEmail?: string;
  customerCpf?: string;
  // Tokenized (preferred):
  creditCardToken?: string;
  // Raw card fields (server-side charge):
  cardNumber?: string;
  cardHolderName?: string;
  cardExpiryMonth?: string;
  cardExpiryYear?: string;
  cardCcv?: string;
  holderName: string;
  holderCpf: string;
  holderEmail?: string;
  holderPhone?: string;
  holderPostalCode?: string;
  holderAddressNumber?: string;
  installmentCount?: number;
}

export interface PaymentResult {
  id: string;
  status: string;
  billingType: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  pixExpiresAt: string | null;
}

export interface PaymentStatus {
  id: string;
  status: string;
  billingType: string;
  value: number;
  dueDate: string;
}

export async function getAsaasConfig(weddingId: number): Promise<AsaasSettings | null> {
  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));
  if (!settings || !settings.asaasApiKey) return null;
  return settings as AsaasSettings;
}

function getAsaasBaseUrl(environment: string | null): string {
  return environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

async function findOrCreateCustomer(
  baseUrl: string,
  apiKey: string,
  name: string,
  email?: string,
  cpf?: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: apiKey },
    body: JSON.stringify({
      name,
      email: email || undefined,
      cpfCnpj: cpf || "00000000000",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Falha ao criar cliente no Asaas: ${err}`);
  }

  const data = await response.json() as { id: string };
  return data.id;
}

export async function createPixPayment(
  weddingId: number,
  params: CreatePixPaymentParams,
): Promise<PaymentResult> {
  const settings = await getAsaasConfig(weddingId);
  if (!settings) throw new Error("Asaas não configurado para este casamento");

  const baseUrl = getAsaasBaseUrl(settings.asaasEnvironment);
  const customerId = await findOrCreateCustomer(
    baseUrl, settings.asaasApiKey,
    params.customerName, params.customerEmail, params.customerCpf,
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const expiresAt = params.expirationSeconds
    ? new Date(Date.now() + params.expirationSeconds * 1000).toISOString()
    : undefined;

  const paymentResponse = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: settings.asaasApiKey },
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value: params.amount,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `Presente de casamento - ${params.customerName}`,
      externalReference: `wedding_${weddingId}`,
      pixAddressKey: undefined,
      pixAddressKeyType: undefined,
    }),
  });

  if (!paymentResponse.ok) {
    const err = await paymentResponse.text();
    throw new Error(`Falha ao criar cobrança PIX: ${err}`);
  }

  const paymentData = await paymentResponse.json() as { id: string; status: string; billingType: string; invoiceUrl: string | null; bankSlipUrl: string | null };

  let pixQrCode: string | null = null;
  let pixCopyPaste: string | null = null;
  let pixExpiresAt: string | null = expiresAt ?? null;

  try {
    const pixResponse = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
      headers: { access_token: settings.asaasApiKey },
    });
    if (pixResponse.ok) {
      const pixData = await pixResponse.json() as { encodedImage: string; payload: string; expirationDate?: string };
      pixQrCode = pixData.encodedImage;
      pixCopyPaste = pixData.payload;
      if (pixData.expirationDate) pixExpiresAt = pixData.expirationDate;
    }
  } catch {
    // QR fetch failed but payment was created; polling/webhook will confirm
  }

  return {
    id: paymentData.id,
    status: paymentData.status,
    billingType: paymentData.billingType,
    invoiceUrl: paymentData.invoiceUrl,
    bankSlipUrl: paymentData.bankSlipUrl,
    pixQrCode,
    pixCopyPaste,
    pixExpiresAt,
  };
}

export async function createCreditCardPayment(
  weddingId: number,
  params: CreateCreditCardPaymentParams,
): Promise<PaymentResult> {
  const settings = await getAsaasConfig(weddingId);
  if (!settings) throw new Error("Asaas não configurado para este casamento");

  const baseUrl = getAsaasBaseUrl(settings.asaasEnvironment);
  const customerId = await findOrCreateCustomer(
    baseUrl, settings.asaasApiKey,
    params.customerName, params.customerEmail, params.customerCpf,
  );

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);

  const installmentCount = params.installmentCount && params.installmentCount > 1
    ? params.installmentCount
    : 1;

  const holderInfo = {
    name: params.holderName,
    cpfCnpj: params.holderCpf,
    email: params.holderEmail || params.customerEmail || "",
    phone: params.holderPhone || "",
    postalCode: params.holderPostalCode || "",
    addressNumber: params.holderAddressNumber || "",
  };

  const body: Record<string, unknown> = {
    customer: customerId,
    billingType: "CREDIT_CARD",
    value: params.amount,
    dueDate: dueDate.toISOString().split("T")[0],
    description: `Presente de casamento - ${params.customerName}`,
    externalReference: `wedding_${weddingId}`,
    creditCardHolderInfo: holderInfo,
  };

  if (params.creditCardToken) {
    body.creditCardToken = params.creditCardToken;
  } else {
    body.creditCard = {
      holderName: params.cardHolderName || params.holderName,
      number: params.cardNumber,
      expiryMonth: params.cardExpiryMonth,
      expiryYear: params.cardExpiryYear,
      ccv: params.cardCcv,
    };
  }

  if (installmentCount > 1) {
    body.installmentCount = installmentCount;
    body.installmentValue = Math.ceil((params.amount / installmentCount) * 100) / 100;
  }

  const paymentResponse = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: settings.asaasApiKey },
    body: JSON.stringify(body),
  });

  if (!paymentResponse.ok) {
    const err = await paymentResponse.text();
    throw new Error(`Falha ao criar cobrança no cartão: ${err}`);
  }

  const paymentData = await paymentResponse.json() as { id: string; status: string; billingType: string; invoiceUrl: string | null; bankSlipUrl: string | null };

  return {
    id: paymentData.id,
    status: paymentData.status,
    billingType: paymentData.billingType,
    invoiceUrl: paymentData.invoiceUrl,
    bankSlipUrl: paymentData.bankSlipUrl,
    pixQrCode: null,
    pixCopyPaste: null,
    pixExpiresAt: null,
  };
}

export async function getAsaasPaymentStatus(
  weddingId: number,
  asaasPaymentId: string,
): Promise<PaymentStatus> {
  const settings = await getAsaasConfig(weddingId);
  if (!settings) throw new Error("Asaas não configurado para este casamento");

  const baseUrl = getAsaasBaseUrl(settings.asaasEnvironment);

  const response = await fetch(`${baseUrl}/payments/${asaasPaymentId}`, {
    headers: { access_token: settings.asaasApiKey },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Falha ao consultar pagamento no Asaas: ${err}`);
  }

  return response.json() as Promise<PaymentStatus>;
}

export async function cancelAsaasPayment(
  weddingId: number,
  asaasPaymentId: string,
): Promise<void> {
  const settings = await getAsaasConfig(weddingId);
  if (!settings) throw new Error("Asaas não configurado para este casamento");

  const baseUrl = getAsaasBaseUrl(settings.asaasEnvironment);

  const response = await fetch(`${baseUrl}/payments/${asaasPaymentId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: settings.asaasApiKey },
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null) as { errors?: Array<{ description: string }> } | null;
    const msg = data?.errors?.[0]?.description ?? await response.text();
    throw new Error(`Falha ao cancelar/estornar no Asaas: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Legacy function kept for backward compatibility with the old gift_orders flow
// ---------------------------------------------------------------------------
export async function createAsaasPayment(weddingId: number, params: {
  amount: number;
  paymentMethod: string;
  customerName: string;
  customerEmail?: string;
  customerCpf?: string;
  // Raw card fields — legacy only; new code uses createCreditCardPayment with token
  creditCardNumber?: string;
  creditCardHolderName?: string;
  creditCardExpiryMonth?: string;
  creditCardExpiryYear?: string;
  creditCardCcv?: string;
  creditCardHolderCpf?: string;
  creditCardHolderEmail?: string;
  creditCardHolderPhone?: string;
  creditCardHolderPostalCode?: string;
  creditCardHolderAddressNumber?: string;
  installmentCount?: number;
}): Promise<{ id: string; status: string; billingType: string; invoiceUrl: string | null; bankSlipUrl: string | null; pixQrCode: string | null; pixCopyPaste: string | null }> {
  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));

  if (!settings || !settings.asaasApiKey) {
    throw new Error("Asaas não configurado para este casamento");
  }

  const baseUrl = getAsaasBaseUrl(settings.asaasEnvironment);
  const billingType = params.paymentMethod === "pix" ? "PIX"
    : params.paymentMethod === "boleto" ? "BOLETO"
    : "CREDIT_CARD";

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const customerResponse = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: settings.asaasApiKey },
    body: JSON.stringify({ name: params.customerName, email: params.customerEmail, cpfCnpj: params.customerCpf || "00000000000" }),
  });

  if (!customerResponse.ok) {
    const errText = await customerResponse.text();
    throw new Error(`Falha ao criar cliente no Asaas: ${errText}`);
  }

  const customerData = await customerResponse.json() as { id: string };

  const paymentBody: Record<string, unknown> = {
    customer: customerData.id,
    billingType,
    value: params.amount,
    dueDate: dueDate.toISOString().split("T")[0],
    description: `Presente de casamento - ${params.customerName}`,
  };

  if (billingType === "CREDIT_CARD") {
    paymentBody.creditCard = {
      holderName: params.creditCardHolderName || params.customerName,
      number: params.creditCardNumber,
      expiryMonth: params.creditCardExpiryMonth,
      expiryYear: params.creditCardExpiryYear,
      ccv: params.creditCardCcv,
    };
    paymentBody.creditCardHolderInfo = {
      name: params.creditCardHolderName || params.customerName,
      email: params.creditCardHolderEmail || params.customerEmail || "",
      cpfCnpj: params.creditCardHolderCpf || params.customerCpf || "00000000000",
      phone: params.creditCardHolderPhone || "",
      postalCode: params.creditCardHolderPostalCode || "",
      addressNumber: params.creditCardHolderAddressNumber || "",
    };
    if (params.installmentCount && params.installmentCount > 1) {
      paymentBody.installmentCount = params.installmentCount;
      paymentBody.installmentValue = Math.ceil((params.amount / params.installmentCount) * 100) / 100;
    }
  }

  const paymentResponse = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", access_token: settings.asaasApiKey },
    body: JSON.stringify(paymentBody),
  });

  if (!paymentResponse.ok) {
    const error = await paymentResponse.text();
    throw new Error(`Falha ao criar cobrança: ${error}`);
  }

  const paymentData = await paymentResponse.json() as { id: string; status: string; billingType: string; invoiceUrl: string | null; bankSlipUrl: string | null };

  let pixQrCode: string | null = null;
  let pixCopyPaste: string | null = null;

  if (billingType === "PIX") {
    try {
      const pixResponse = await fetch(`${baseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: { access_token: settings.asaasApiKey },
      });
      if (pixResponse.ok) {
        const pixData = await pixResponse.json() as { encodedImage: string; payload: string };
        pixQrCode = pixData.encodedImage;
        pixCopyPaste = pixData.payload;
      }
    } catch {
      // PIX QR fetch failed but payment was created
    }
  }

  return { id: paymentData.id, status: paymentData.status, billingType: paymentData.billingType, invoiceUrl: paymentData.invoiceUrl, bankSlipUrl: paymentData.bankSlipUrl, pixQrCode, pixCopyPaste };
}
