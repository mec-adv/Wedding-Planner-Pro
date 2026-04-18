import { db, integrationSettingsTable, eq, pool } from "@workspace/db";
import { weddingRowFromPg } from "./wedding-pg";

export interface ConfirmationEmailParams {
  weddingId: number;
  toEmail: string;
  buyerName: string;
  items: Array<{ name: string; quantity: number; unitPrice: number; subtotal: number }>;
  totalAmount: number;
  paymentMethod: "pix" | "credit_card";
  installments?: number;
  thankYouMessage?: string | null;
  groomName: string;
  brideName: string;
}

export async function sendConfirmationEmail(params: ConfirmationEmailParams): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || "587";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) return; // silently skip — no SMTP configured

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const itemsHtml = params.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 0;color:#333;">${i.name}</td>
          <td style="padding:6px 0;color:#555;text-align:center;">${i.quantity}</td>
          <td style="padding:6px 0;color:#333;text-align:right;">${formatCurrency(i.subtotal)}</td>
        </tr>`,
    )
    .join("");

  const paymentInfo =
    params.paymentMethod === "credit_card" && (params.installments ?? 1) > 1
      ? `Cartão de crédito em ${params.installments}x de ${formatCurrency(params.totalAmount / (params.installments ?? 1))}`
      : params.paymentMethod === "credit_card"
      ? "Cartão de crédito à vista"
      : "PIX";

  const thankYou = params.thankYouMessage?.trim()
    ? `<p style="margin-top:24px;font-size:15px;color:#b76e79;font-style:italic;">${params.thankYouMessage.trim()}</p>`
    : `<p style="margin-top:24px;font-size:14px;color:#999;">Com muito amor, ${params.brideName} &amp; ${params.groomName} 💍</p>`;

  const subject = `Confirmação de presente — ${params.brideName} &amp; ${params.groomName}`;
  const htmlBody = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 20px;">
      <h1 style="color:#b76e79;font-size:24px;text-align:center;">Presente confirmado! 🎁</h1>
      <p style="font-size:16px;color:#333;">Olá, <strong>${params.buyerName}</strong>!</p>
      <p style="font-size:15px;color:#555;">Seu presente para o casamento de <strong>${params.brideName} &amp; ${params.groomName}</strong> foi confirmado com sucesso.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <thead>
          <tr style="border-bottom:1px solid #e2d6d6;">
            <th style="text-align:left;padding:6px 0;color:#888;font-weight:normal;">Presente</th>
            <th style="text-align:center;padding:6px 0;color:#888;font-weight:normal;">Qtd</th>
            <th style="text-align:right;padding:6px 0;color:#888;font-weight:normal;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
        <tfoot>
          <tr style="border-top:1px solid #e2d6d6;">
            <td colspan="2" style="padding:10px 0;font-weight:bold;color:#333;">Total</td>
            <td style="padding:10px 0;font-weight:bold;color:#b76e79;text-align:right;">${formatCurrency(params.totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
      <p style="font-size:14px;color:#555;">Forma de pagamento: <strong>${paymentInfo}</strong></p>
      ${thankYou}
    </div>
  `;

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"${params.brideName} & ${params.groomName}" <${smtpFrom}>`,
    to: params.toEmail,
    subject,
    html: htmlBody,
  });
}

export async function sendEmailInvite(weddingId: number, toEmail: string, guestName: string): Promise<void> {
  const [settings] = await db.select().from(integrationSettingsTable)
    .where(eq(integrationSettingsTable.weddingId, weddingId));

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || "587";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("Configuração de email (SMTP) não definida. Configure SMTP_HOST, SMTP_USER e SMTP_PASS nas variáveis de ambiente.");
  }

  const wRes = await pool.query(`SELECT * FROM weddings WHERE id = $1`, [weddingId]);
  const wRow = wRes.rows[0] as Record<string, unknown> | undefined;
  if (!wRow) {
    throw new Error("Casamento não encontrado para envio de e-mail");
  }
  const wedding = weddingRowFromPg(wRow);

  const weddingDate = wedding.date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const subject = `Convite de Casamento - ${wedding.title}`;
  const htmlBody = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; text-align: center;">
      <h1 style="color: #b76e79; font-size: 28px; margin-bottom: 8px;">${wedding.title}</h1>
      <p style="color: #666; font-size: 16px; margin-bottom: 24px;">
        ${wedding.brideName} &amp; ${wedding.groomName}
      </p>
      <p style="font-size: 18px; color: #333;">
        Olá <strong>${guestName}</strong>,
      </p>
      <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Temos a honra de convidá-lo(a) para celebrar conosco este momento especial!
      </p>
      <div style="background: #fdf2f4; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="font-size: 14px; color: #888; margin: 0;">Data</p>
        <p style="font-size: 18px; color: #333; margin: 4px 0 12px;">${weddingDate}</p>
        ${wedding.venue ? `<p style="font-size: 14px; color: #888; margin: 0;">Local</p><p style="font-size: 18px; color: #333; margin: 4px 0;">${wedding.venue}</p>` : ""}
      </div>
      <p style="font-size: 14px; color: #999; margin-top: 32px;">
        Com carinho, ${wedding.brideName} &amp; ${wedding.groomName}
      </p>
    </div>
  `;

  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"${wedding.title}" <${smtpFrom}>`,
    to: toEmail,
    subject,
    html: htmlBody,
  });
}
