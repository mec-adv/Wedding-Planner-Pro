-- Dados enriquecidos do casamento: contatos dos noivos e locais das cerimônias (JSONB).
ALTER TABLE "weddings"
  ADD COLUMN IF NOT EXISTS "groom_contact" jsonb;
ALTER TABLE "weddings"
  ADD COLUMN IF NOT EXISTS "bride_contact" jsonb;
ALTER TABLE "weddings"
  ADD COLUMN IF NOT EXISTS "religious_venue_detail" jsonb;
ALTER TABLE "weddings"
  ADD COLUMN IF NOT EXISTS "civil_venue_detail" jsonb;
