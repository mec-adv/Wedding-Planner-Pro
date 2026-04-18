-- ============================================================
-- Migration 0007: Gift Shop v2.0 (orders, order_items,
--   mural_messages, gift_categories, gifts/weddings adjustments)
-- ============================================================

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE "order_status" AS ENUM('pending','paid','failed','expired','refunded','cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_payment_method') THEN
    CREATE TYPE "order_payment_method" AS ENUM('pix','credit_card');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mural_source') THEN
    CREATE TYPE "mural_source" AS ENUM('checkout','public_page');
  END IF;
END $$;

-- gift_categories
CREATE TABLE IF NOT EXISTS "gift_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "wedding_id" integer NOT NULL,
  "name" varchar(100) NOT NULL,
  "sort_order" smallint DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "gift_categories_wedding_id_weddings_id_fk"
    FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action
);

-- orders
CREATE TABLE IF NOT EXISTS "orders" (
  "id" serial PRIMARY KEY NOT NULL,
  "wedding_id" integer NOT NULL,
  "guest_id" integer,
  "companion_id" integer,
  "buyer_name" varchar(255) NOT NULL,
  "status" "order_status" DEFAULT 'pending' NOT NULL,
  "payment_method" "order_payment_method" NOT NULL,
  "installments" smallint DEFAULT 1 NOT NULL,
  "total_amount" numeric(10,2) NOT NULL,
  "asaas_payment_id" varchar(255),
  "asaas_status" varchar(50),
  "mural_message" text,
  "whatsapp_sent_at" timestamp with time zone,
  "email_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancelled_by" integer,
  CONSTRAINT "orders_wedding_id_weddings_id_fk"
    FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "orders_guest_id_guests_id_fk"
    FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "orders_companion_id_guest_companions_id_fk"
    FOREIGN KEY ("companion_id") REFERENCES "public"."guest_companions"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "orders_cancelled_by_users_id_fk"
    FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "orders_wedding_id_idx" ON "orders" ("wedding_id");
CREATE INDEX IF NOT EXISTS "orders_asaas_payment_id_idx" ON "orders" ("asaas_payment_id") WHERE "asaas_payment_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders" ("status");

-- order_items
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "order_id" integer NOT NULL,
  "gift_id" integer,
  "gift_name_snapshot" varchar(255) NOT NULL,
  "unit_price_snapshot" numeric(10,2) NOT NULL,
  "quantity" smallint DEFAULT 1 NOT NULL,
  "subtotal" numeric(10,2) NOT NULL,
  CONSTRAINT "order_items_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "order_items_gift_id_gifts_id_fk"
    FOREIGN KEY ("gift_id") REFERENCES "public"."gifts"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items" ("order_id");

-- mural_messages
CREATE TABLE IF NOT EXISTS "mural_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "wedding_id" integer NOT NULL,
  "guest_id" integer,
  "author_name" varchar(255) NOT NULL,
  "message" text NOT NULL,
  "source" "mural_source" NOT NULL,
  "order_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "mural_messages_wedding_id_weddings_id_fk"
    FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "mural_messages_guest_id_guests_id_fk"
    FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "mural_messages_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "mural_messages_wedding_id_idx" ON "mural_messages" ("wedding_id");

-- gifts: add is_honeymoon_fund
ALTER TABLE "gifts" ADD COLUMN IF NOT EXISTS "is_honeymoon_fund" boolean DEFAULT false NOT NULL;

-- weddings: add gift shop config columns
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "show_progress_bar" boolean DEFAULT false NOT NULL;
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "progress_goal" numeric(12,2);
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "thank_you_message" text;
