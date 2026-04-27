-- Tabela e enums de conexões WhatsApp (Evolution / Meta futuro).
-- Idempotente: pode rodar mais de uma vez.
-- Preferência: `pnpm --filter @workspace/db push-force` na raiz (sincroniza com o schema Drizzle).

DO $$ BEGIN
  CREATE TYPE whatsapp_provider AS ENUM ('evolution', 'meta_cloud');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_owner_kind AS ENUM ('bride', 'groom', 'event');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE whatsapp_connection_status AS ENUM (
    'pending',
    'qr',
    'connected',
    'disconnected',
    'error'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id serial PRIMARY KEY,
  wedding_id integer NOT NULL REFERENCES weddings (id) ON DELETE CASCADE,
  provider whatsapp_provider NOT NULL DEFAULT 'evolution',
  owner_kind whatsapp_owner_kind NOT NULL,
  label varchar(120),
  phone_number varchar(32),
  status whatsapp_connection_status NOT NULL DEFAULT 'pending',
  evolution_instance_name varchar(120),
  evolution_integration varchar(40) DEFAULT 'WHATSAPP-BAILEYS',
  evolution_instance_api_key text,
  evolution_instance_id varchar(120),
  meta_phone_number_id varchar(64),
  meta_waba_id varchar(64),
  meta_access_token text,
  last_connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conn_wedding_instance_unique
  ON whatsapp_connections (wedding_id, evolution_instance_name);
