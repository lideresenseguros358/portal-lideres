-- ============================================
-- FEDPA Token Persistence
-- Tabla para almacenar tokens de FEDPA por ambiente
-- ============================================

CREATE TABLE IF NOT EXISTS fedpa_tokens (
  amb       TEXT PRIMARY KEY,           -- 'DEV' | 'PROD'
  token     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_ok_at TIMESTAMPTZ,               -- última vez que el token fue verificado OK
  source    TEXT DEFAULT 'generartoken'  -- 'generartoken' | 'manual_seed' | 'probe_renewed'
);

-- Índice para búsqueda rápida por ambiente
CREATE INDEX IF NOT EXISTS idx_fedpa_tokens_amb ON fedpa_tokens(amb);

-- RLS: solo service_role puede leer/escribir
ALTER TABLE fedpa_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON fedpa_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
