import { eq } from "drizzle-orm";
import { db, integrationSettingsTable, weddingsTable } from "@workspace/db";

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

  const [wedding] = await db.select().from(weddingsTable).where(eq(weddingsTable.id, weddingId));
  if (!wedding) {
    throw new Error("Casamento não encontrado");
  }

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
