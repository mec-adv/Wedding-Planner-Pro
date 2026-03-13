import { eq } from "drizzle-orm";
import { db, integrationSettingsTable } from "@workspace/db";

interface CreatePaymentParams {
  amount: number;
  paymentMethod: string;
  customerName: string;
  customerEmail?: string;
}

export async function createAsaasPayment(weddingId: number, params: CreatePaymentParams): Promise<{ id: string }> {
  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));

  if (!settings || !settings.asaasApiKey) {
    throw new Error("Asaas não configurado para este casamento");
  }

  const baseUrl = settings.asaasEnvironment === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

  const billingType = params.paymentMethod === "pix" ? "PIX"
    : params.paymentMethod === "boleto" ? "BOLETO"
    : "CREDIT_CARD";

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
      cpfCnpj: "00000000000",
    }),
  });

  let customerId: string;
  if (customerResponse.ok) {
    const customerData = await customerResponse.json() as { id: string };
    customerId = customerData.id;
  } else {
    throw new Error("Falha ao criar cliente no Asaas");
  }

  const paymentResponse = await fetch(`${baseUrl}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: settings.asaasApiKey,
    },
    body: JSON.stringify({
      customer: customerId,
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

  const paymentData = await paymentResponse.json() as { id: string };
  return { id: paymentData.id };
}
