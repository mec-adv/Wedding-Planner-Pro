CREATE TABLE IF NOT EXISTS "guest_companions" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"age" smallint NOT NULL,
	"phone" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_companions_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action
);
CREATE INDEX IF NOT EXISTS "guest_companions_guest_id_idx" ON "guest_companions" ("guest_id");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'guests' AND column_name = 'plus_one_name'
  ) THEN
    INSERT INTO "guest_companions" ("guest_id", "name", "age", "created_at", "updated_at")
    SELECT g."id", trim(g."plus_one_name"), 1, now(), now()
    FROM "guests" g
    WHERE g."plus_one_name" IS NOT NULL AND trim(g."plus_one_name") <> ''
      AND NOT EXISTS (SELECT 1 FROM "guest_companions" c WHERE c."guest_id" = g."id");
  END IF;
END $$;

ALTER TABLE "guests" DROP COLUMN IF EXISTS "plus_one";
ALTER TABLE "guests" DROP COLUMN IF EXISTS "plus_one_name";
