-- ============================================================
-- Migration 0010: Payment Gateway Abstraction
--   - Renomeia colunas Asaas-específicas em orders para nomes agnósticos
--   - Adiciona gateway_payment_id, gateway_status, payment_gateway, idempotency_key
--   - Adiciona active_payment_gateway e asaas_public_key em integration_settings
--   - Cria tabela order_transitions (audit log de status)
-- ============================================================

-- 1. Renomear colunas gateway-específicas em orders
ALTER TABLE "orders" RENAME COLUMN "asaas_payment_id" TO "gateway_payment_id";
ALTER TABLE "orders" RENAME COLUMN "asaas_status" TO "gateway_status";

-- 2. Adicionar colunas novas em orders
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_gateway" varchar(30) DEFAULT 'asaas';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(128);

-- 3. Recriar índices com novos nomes
DROP INDEX IF EXISTS "orders_asaas_payment_id_idx";
CREATE INDEX IF NOT EXISTS "orders_gateway_payment_id_idx"
  ON "orders" ("gateway_payment_id") WHERE "gateway_payment_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_idx"
  ON "orders" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;

-- 4. Novas colunas em integration_settings
ALTER TABLE "integration_settings"
  ADD COLUMN IF NOT EXISTS "active_payment_gateway" varchar(30) DEFAULT 'asaas';
ALTER TABLE "integration_settings"
  ADD COLUMN IF NOT EXISTS "asaas_public_key" text;

-- 5. Criar tabela de audit log order_transitions
CREATE TABLE IF NOT EXISTS "order_transitions" (
  "id"            serial PRIMARY KEY NOT NULL,
  "order_id"      integer NOT NULL,
  "from_status"   varchar(20),
  "to_status"     varchar(20) NOT NULL,
  "gateway_event" varchar(100),
  "actor"         varchar(50) NOT NULL,
  "note"          text,
  "created_at"    timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "order_transitions_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "order_transitions_order_id_idx"
  ON "order_transitions" ("order_id");
