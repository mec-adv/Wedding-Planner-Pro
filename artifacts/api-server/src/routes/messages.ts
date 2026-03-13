import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, messagesTable, messageTemplatesTable, guestsTable } from "@workspace/db";
import {
  ListMessagesParams,
  CreateMessageParams,
  CreateMessageBody,
  DeleteMessageParams,
  ListMessageTemplatesParams,
  CreateMessageTemplateParams,
  CreateMessageTemplateBody,
  UpdateMessageTemplateParams,
  UpdateMessageTemplateBody,
  DeleteMessageTemplateParams,
  SendBulkWhatsappParams,
  SendBulkWhatsappBody,
} from "@workspace/api-zod";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();

router.get("/weddings/:weddingId/messages", authMiddleware, async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const messages = await db.select().from(messagesTable).where(eq(messagesTable.weddingId, params.data.weddingId));
  res.json(messages.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/weddings/:weddingId/messages", async (req, res): Promise<void> => {
  const params = CreateMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [message] = await db.insert(messagesTable).values({
    senderName: parsed.data.senderName || "Anônimo",
    content: parsed.data.content || "",
    messageType: parsed.data.messageType,
    weddingId: params.data.weddingId,
  }).returning();
  res.status(201).json({ ...message, createdAt: message.createdAt.toISOString() });
});

router.delete("/weddings/:weddingId/messages/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = DeleteMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(messagesTable).where(and(eq(messagesTable.id, params.data.id), eq(messagesTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

router.get("/weddings/:weddingId/message-templates", authMiddleware, async (req, res): Promise<void> => {
  const params = ListMessageTemplatesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const templates = await db.select().from(messageTemplatesTable).where(eq(messageTemplatesTable.weddingId, params.data.weddingId));
  res.json(templates.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

router.post("/weddings/:weddingId/message-templates", authMiddleware, async (req, res): Promise<void> => {
  const params = CreateMessageTemplateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateMessageTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [template] = await db.insert(messageTemplatesTable).values({
    name: parsed.data.name || "Novo Modelo",
    content: parsed.data.content || "",
    category: parsed.data.category,
    variables: parsed.data.variables,
    weddingId: params.data.weddingId,
  }).returning();
  res.status(201).json({ ...template, createdAt: template.createdAt.toISOString() });
});

router.patch("/weddings/:weddingId/message-templates/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = UpdateMessageTemplateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateMessageTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [template] = await db.update(messageTemplatesTable).set(parsed.data)
    .where(and(eq(messageTemplatesTable.id, params.data.id), eq(messageTemplatesTable.weddingId, params.data.weddingId))).returning();
  if (!template) { res.status(404).json({ error: "Modelo não encontrado" }); return; }
  res.json({ ...template, createdAt: template.createdAt.toISOString() });
});

router.delete("/weddings/:weddingId/message-templates/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = DeleteMessageTemplateParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(messageTemplatesTable).where(and(eq(messageTemplatesTable.id, params.data.id), eq(messageTemplatesTable.weddingId, params.data.weddingId)));
  res.sendStatus(204);
});

router.post("/weddings/:weddingId/send-bulk-whatsapp", authMiddleware, async (req, res): Promise<void> => {
  const params = SendBulkWhatsappParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = SendBulkWhatsappBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const guestId of parsed.data.guestIds) {
    const [guest] = await db.select().from(guestsTable)
      .where(and(eq(guestsTable.id, guestId), eq(guestsTable.weddingId, params.data.weddingId)));

    if (!guest) { failed++; errors.push(`Convidado ID ${guestId} não encontrado`); continue; }
    if (!guest.phone) { failed++; errors.push(`${guest.name} não tem telefone cadastrado`); continue; }

    try {
      const { sendWhatsAppMessage } = await import("../lib/evolution-api");
      const message = parsed.data.message || `Olá ${guest.name}! Você recebeu uma mensagem sobre o casamento.`;
      await sendWhatsAppMessage(params.data.weddingId, guest.phone, message);
      sent++;
    } catch (e: any) {
      failed++;
      errors.push(`Erro ao enviar para ${guest.name}: ${e.message}`);
    }
  }

  res.json({ sent, failed, errors });
});

export default router;
