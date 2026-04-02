-- ============================================================
-- CACHÉ COMPARTIDA DE CATÁLOGOS DE VEHÍCULOS POR ASEGURADORA
-- Fecha: 01 de abril de 2026
--
-- Propósito: almacenar los catálogos de marcas/modelos de ANCON
-- y Regional de forma compartida entre instancias serverless.
-- Evita llamadas repetidas a las APIs de cada aseguradora en
-- cada cold-start; actúa como L2 entre la memoria de proceso (L1)
-- y la API live de la aseguradora (L3).
--
-- Estructura de catalog_key por aseguradora:
--   ANCON   → 'marcas_modelos'              (10k+ entradas combinadas)
--   REGIONAL → 'marcas'                     (lista de marcas)
--   REGIONAL → 'modelos_<codmarca>'         (modelos por marca, ej: 'modelos_12')
-- ============================================================

CREATE TABLE IF NOT EXISTS insurer_vehicle_catalogs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insurer     TEXT        NOT NULL,  -- 'ANCON' | 'REGIONAL'
  catalog_key TEXT        NOT NULL,  -- clave lógica del catálogo (ver arriba)
  catalog_data JSONB      NOT NULL,  -- payload completo
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  UNIQUE (insurer, catalog_key)
);

CREATE INDEX IF NOT EXISTS idx_ivc_insurer_key ON insurer_vehicle_catalogs (insurer, catalog_key);
CREATE INDEX IF NOT EXISTS idx_ivc_expires     ON insurer_vehicle_catalogs (expires_at);

-- RLS: solo backend (service role) puede leer/escribir
ALTER TABLE insurer_vehicle_catalogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON insurer_vehicle_catalogs
  FOR ALL USING (auth.role() = 'service_role');
