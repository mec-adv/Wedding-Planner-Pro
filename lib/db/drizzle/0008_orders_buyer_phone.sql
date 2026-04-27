-- Telefone de quem efetua o pagamento no checkout da loja (rastreio vs. link do convidado).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "buyer_phone" varchar(50);
