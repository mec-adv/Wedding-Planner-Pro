ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "civil_ceremony_at" timestamp with time zone;
ALTER TABLE "weddings" ADD COLUMN IF NOT EXISTS "religious_ceremony_at" timestamp with time zone;

UPDATE "weddings"
SET
  "civil_ceremony_at" = COALESCE("civil_ceremony_at", "date"),
  "religious_ceremony_at" = COALESCE("religious_ceremony_at", "date")
WHERE "civil_ceremony_at" IS NULL OR "religious_ceremony_at" IS NULL;
