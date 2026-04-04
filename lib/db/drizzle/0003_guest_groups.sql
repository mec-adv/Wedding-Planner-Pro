CREATE TABLE IF NOT EXISTS "guest_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"wedding_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_groups_wedding_id_weddings_id_fk" FOREIGN KEY ("wedding_id") REFERENCES "public"."weddings"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "guest_groups_wedding_id_name_unique" UNIQUE("wedding_id","name")
);

INSERT INTO "guest_groups" ("wedding_id", "name")
SELECT w."id", v.name
FROM "weddings" w
CROSS JOIN (VALUES ('Colegas'), ('Trabalho'), ('Família')) AS v(name)
WHERE NOT EXISTS (
	SELECT 1 FROM "guest_groups" g WHERE g."wedding_id" = w."id" AND g."name" = v.name
);

ALTER TABLE "guests" ADD COLUMN IF NOT EXISTS "guest_group_id" integer;
DO $$ BEGIN
  ALTER TABLE "guests" ADD CONSTRAINT "guests_guest_group_id_guest_groups_id_fk" FOREIGN KEY ("guest_group_id") REFERENCES "public"."guest_groups"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

UPDATE "guests" g
SET "guest_group_id" = gg."id"
FROM "guest_groups" gg
WHERE gg."wedding_id" = g."wedding_id"
  AND g."group_name" IS NOT NULL
  AND trim(g."group_name") <> ''
  AND lower(trim(gg."name")) = lower(trim(g."group_name"));

INSERT INTO "guest_groups" ("wedding_id", "name")
SELECT DISTINCT g."wedding_id", trim(g."group_name")
FROM "guests" g
WHERE g."group_name" IS NOT NULL AND trim(g."group_name") <> ''
  AND g."guest_group_id" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "guest_groups" gg
    WHERE gg."wedding_id" = g."wedding_id"
      AND lower(trim(gg."name")) = lower(trim(g."group_name"))
  );

UPDATE "guests" g
SET "guest_group_id" = gg."id"
FROM "guest_groups" gg
WHERE gg."wedding_id" = g."wedding_id"
  AND g."group_name" IS NOT NULL
  AND trim(g."group_name") <> ''
  AND lower(trim(gg."name")) = lower(trim(g."group_name"))
  AND g."guest_group_id" IS NULL;

ALTER TABLE "guests" DROP COLUMN IF EXISTS "group_name";
