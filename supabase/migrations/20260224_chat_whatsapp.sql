-- ============================================================
-- Chat & WhatsApp: insurance_companies + chat_interactions
-- Created: 2026-02-24 (Prompt 6)
-- ============================================================

-- ┌─────────────────────────────────────────────┐
-- │ A) insurance_companies                      │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS insurance_companies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  code              TEXT UNIQUE,
  emergency_phone   TEXT,
  customer_service_phone TEXT,
  whatsapp_number   TEXT,
  website           TEXT,
  active            BOOLEAN NOT NULL DEFAULT true,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ins_companies_active ON insurance_companies(active);
CREATE INDEX IF NOT EXISTS idx_ins_companies_name ON insurance_companies(name);

-- Seed essential insurers
INSERT INTO insurance_companies (name, code, emergency_phone, customer_service_phone, website, active) VALUES
  ('ASSA Compañía de Seguros', 'ASSA', '800-2772', '279-7700', 'https://www.assanet.com', true),
  ('Mapfre Panamá', 'MAPFRE', '800-6273', '302-3800', 'https://www.mapfre.com.pa', true),
  ('FEDPA Seguros', 'FEDPA', '800-3337', '270-0130', 'https://www.fedpaseguros.com', true),
  ('Acerta Seguros', 'ACERTA', '800-2228', '300-3600', 'https://www.acerta.com.pa', true),
  ('Vivir Seguros', 'VIVIR', NULL, '282-1500', 'https://www.vivirseguros.com', true),
  ('Universal de Seguros', 'UNIVERSAL', NULL, '300-1300', 'https://www.universalseguros.com', true),
  ('Aseguradora del Istmo', 'ISTMO', NULL, '269-2988', 'https://www.aseguradoradelistmo.com', true),
  ('Pan American Life (PALIC)', 'PALIC', NULL, '206-4100', 'https://www.palig.com', true),
  ('Internacional de Seguros', 'INTERNACIONAL', '800-0911', '302-3600', 'https://www.interseguros.com', true)
ON CONFLICT (code) DO NOTHING;

-- ┌─────────────────────────────────────────────┐
-- │ B) chat_interactions                        │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS chat_interactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel           TEXT NOT NULL CHECK (channel IN ('whatsapp','portal')),
  client_id         UUID,
  phone             TEXT,
  message           TEXT NOT NULL,
  response          TEXT,
  intent            TEXT,
  escalated         BOOLEAN NOT NULL DEFAULT false,
  ip_address        TEXT,
  session_id        TEXT,
  metadata          JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_inter_channel ON chat_interactions(channel);
CREATE INDEX IF NOT EXISTS idx_chat_inter_phone ON chat_interactions(phone);
CREATE INDEX IF NOT EXISTS idx_chat_inter_intent ON chat_interactions(intent);
CREATE INDEX IF NOT EXISTS idx_chat_inter_escalated ON chat_interactions(escalated) WHERE escalated = true;
CREATE INDEX IF NOT EXISTS idx_chat_inter_created ON chat_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_inter_client ON chat_interactions(client_id);

-- ┌─────────────────────────────────────────────┐
-- │ C) RLS                                      │
-- └─────────────────────────────────────────────┘
ALTER TABLE insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_interactions ENABLE ROW LEVEL SECURITY;

-- insurance_companies: readable by authenticated, writable by master
CREATE POLICY ins_companies_read ON insurance_companies FOR SELECT USING (true);
CREATE POLICY ins_companies_write ON insurance_companies FOR ALL USING (is_master()) WITH CHECK (is_master());

-- chat_interactions: master only
CREATE POLICY chat_inter_master ON chat_interactions FOR ALL USING (is_master()) WITH CHECK (is_master());

-- ┌─────────────────────────────────────────────┐
-- │ D) Updated_at trigger for insurance_companies│
-- └─────────────────────────────────────────────┘
CREATE TRIGGER trg_insurance_companies_updated_at
  BEFORE UPDATE ON insurance_companies
  FOR EACH ROW EXECUTE FUNCTION adm_cot_set_updated_at();
