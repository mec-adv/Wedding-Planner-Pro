import { eq } from "drizzle-orm";
import { db, integrationSettingsTable } from "@workspace/db";

interface CreatePaymentParams {
  amount: number;
  paymentMethod: string;
  customerName: string;
  customerEmail?: string;
  customerCpf?: string;
}

interface PaymentResult {
  id: string;
  status: string;
  billingType: string;
  invoiceUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
}

export async function getAsaasConfig(weddingId: number) {
  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));
  if (!settings || !settings.asaasApiKey) return null;
  return settings;
}

function getAsaasBaseUrl(environment: string | null): string {
  return environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

export async function createAsaasPayment(weddingId: number, params: CreatePaymentParams): Promise<PaymentResult> {
  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));

  if (!settings || !settings.asaasApiKey) {
    throw new Error("Asaas não configurado para este casamento");
  }

  const baseUrl = getAsaasBaseUrl(settings.asaasEnvironment);

  const billingType = params.paymentMethod === "pix" ? "PIX"
    : params.paymentMethod === "boleto" ? "BOLETO"
    : "CREDIT_CARD";

  if (billingType === "CREDIT_CARD") {
    throw new Error("Pagamento por cartão de crédito requer integração frontend com tokenização Asaas. Use PIX ou Boleto.");
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);

  const customerResponse = await fetch(`${baseUrl}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: settings.asaasApiKey,
    },
    body: JSON.stringify({
      name: params.customerName,
      email: params.customerEmail,
      cpfCnpj: params.customerCpf || "00000000000",
    }),
  });

  if (!customerResponse.ok) {
    const errText = await customerResponse.text();
    throw new Error(`Falha ao criar cliente no Asaas: ${errText}`);
  }

  const customerData = await customerResponse.json() as { id: string };

  const paymentResponse = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: settings.asaasApiKey,
    },
    body: JSON.stringify({
      customer: customerData.id,
      billingType,
      value: params.amount,
      dueDate: dueDate.toISOString().split("T")[0],
      description: `Presente de casamento - ${params.customerName}`,
    }),
  });

  if (!paymentResponse.ok) {
    const error = await paymentResponse.text();
    throw new Error(`Falha ao criar cobrança: ${error}`);
  }

  const paymentData = await paymentResponse.json() as {
    id: string;
    status: string;
    billingType: string;
    invoiceUrl: string | null;
    bankSlipUrl: string | null;
  };

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
      // PIX QR fetch failed but payment was created successfully
    }
  }

  return {
    id: paymentData.id,
    status: paymentData.status,
    billingType: paymentData.billingType,
    invoiceUrl: paymentData.invoiceUrl,
    bankSlipUrl: paymentData.bankSlipUrl,
    pixQrCode,
    pixCopyPaste,
  };
}
