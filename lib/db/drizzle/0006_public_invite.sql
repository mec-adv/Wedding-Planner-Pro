CREATE TABLE IF NOT EXISTS "public_invite_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"wedding_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_invite_templates_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS "public_invite_templates_wedding_one_default"
	ON "public_invite_templates" ("wedding_id")
	WHERE "is_default" = true;

ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "invite_token" varchar(64);
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "invite_token_expires_at" timestamp with time zone;
ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "public_invite_template_id" integer;

UPDATE "guests" SET "invite_token" = md5(random()::text || id::text || clock_timestamp()::text) || md5(random()::text || id::text || clock_timestamp()::text)
WHERE "invite_token" IS NULL;

ALTER TABLE "guests" ALTER COLUMN "invite_token" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "guests_invite_token_unique" ON "guests" ("invite_token");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'guests_public_invite_template_id_public_invite_templates_id_fk'
  ) THEN
    ALTER TABLE "guests" ADD CONSTRAINT "guests_public_invite_template_id_public_invite_templates_id_fk"
      FOREIGN KEY ("public_invite_template_id") REFERENCES "public"."public_invite_templates"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

ALTER TABLE "gift_orders" ADD COLUMN IF NOT EXISTS "guest_id" integer;
ALTER TABLE "gift_orders" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(128);
ALTER TABLE "gift_orders" ADD COLUMN IF NOT EXISTS "couple_message" text;
ALTER TABLE "gift_orders" ADD COLUMN IF NOT EXISTS "couple_message_status" varchar(20) DEFAULT 'pending' NOT NULL;
ALTER TABLE "gift_orders" ADD COLUMN IF NOT EXISTS "couple_message_processed_at" timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gift_orders_guest_id_guests_id_fk'
  ) THEN
    ALTER TABLE "gift_orders" ADD CONSTRAINT "gift_orders_guest_id_guests_id_fk"
      FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "gift_orders_wedding_idempotency_unique"
	ON "gift_orders" ("wedding_id", "idempotency_key")
	WHERE "idempotency_key" IS NOT NULL;
