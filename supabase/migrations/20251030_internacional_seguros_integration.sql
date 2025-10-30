-- ============================================================
-- INTEGRACIÓN INTERNACIONAL DE SEGUROS (IS)
-- Fecha: 30 de octubre de 2025
-- ============================================================

-- 1. Tabla de auditoría cifrada para payloads completos
-- Audita TODAS las llamadas a IS (cotización, coberturas, emisión)
-- No referencia ninguna tabla específica ya que cotizaciones no se persisten
CREATE TABLE IF NOT EXISTS audit_payloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID, -- Opcional: ID de póliza si aplica (solo para emisión)
  endpoint TEXT NOT NULL,
  request_json TEXT NOT NULL, -- Cifrado en aplicación
  response_json TEXT NOT NULL, -- Cifrado en aplicación
  status_code INTEGER,
  error_message TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor TEXT DEFAULT 'system',
  environment TEXT CHECK (environment IN ('development', 'production')) DEFAULT 'development',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para búsqueda eficiente
CREATE INDEX IF NOT EXISTS idx_audit_payloads_policy_id ON audit_payloads(policy_id);
CREATE INDEX IF NOT EXISTS idx_audit_payloads_timestamp ON audit_payloads(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_payloads_endpoint ON audit_payloads(endpoint);

-- 2. Tabla de tokens diarios de IS (cache)
CREATE TABLE IF NOT EXISTS is_daily_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(environment)
);

-- 3. Tabla de catálogos IS (cache)
CREATE TABLE IF NOT EXISTS is_catalogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_type TEXT NOT NULL, -- 'marcas', 'modelos', 'planes', etc.
  catalog_data JSONB NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(catalog_type, environment)
);

CREATE INDEX IF NOT EXISTS idx_is_catalogs_type ON is_catalogs(catalog_type);

-- 4. NO se agregan campos a cases
-- La integración IS NO crea casos, solo guarda cliente + póliza al emitir
-- Los datos de cotización se mantienen en memoria en el frontend
-- Los datos de póliza se guardan en tables: clients y policies

-- 5. RLS Policies
-- audit_payloads: solo admins (masters)
ALTER TABLE audit_payloads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_payloads_admin_all" ON audit_payloads;
CREATE POLICY "audit_payloads_admin_all" ON audit_payloads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'master'
    )
  );

-- is_daily_tokens: sistema
ALTER TABLE is_daily_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "is_daily_tokens_system" ON is_daily_tokens;
CREATE POLICY "is_daily_tokens_system" ON is_daily_tokens
  FOR ALL
  USING (true); -- Controlado por Service Role

-- is_catalogs: lectura pública autenticada
ALTER TABLE is_catalogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "is_catalogs_read" ON is_catalogs;
CREATE POLICY "is_catalogs_read" ON is_catalogs
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "is_catalogs_write" ON is_catalogs;
CREATE POLICY "is_catalogs_write" ON is_catalogs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'master'
    )
  );

-- 6. Funciones auxiliares
-- Función para limpiar tokens expirados
CREATE OR REPLACE FUNCTION clean_expired_is_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM is_daily_tokens
  WHERE expires_at < NOW();
END;
$$;

-- Función para obtener token válido
CREATE OR REPLACE FUNCTION get_valid_is_token(env TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token_record RECORD;
BEGIN
  SELECT token, expires_at INTO token_record
  FROM is_daily_tokens
  WHERE environment = env
  AND expires_at > NOW() + INTERVAL '5 minutes'; -- Buffer de 5 minutos
  
  IF FOUND THEN
    RETURN token_record.token;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas nuevas
DROP TRIGGER IF EXISTS update_is_daily_tokens_updated_at ON is_daily_tokens;
CREATE TRIGGER update_is_daily_tokens_updated_at
  BEFORE UPDATE ON is_daily_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_is_catalogs_updated_at ON is_catalogs;
CREATE TRIGGER update_is_catalogs_updated_at
  BEFORE UPDATE ON is_catalogs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ============================================================

COMMENT ON TABLE audit_payloads IS 'Auditoría completa de requests/responses a IS - datos cifrados';
COMMENT ON TABLE is_daily_tokens IS 'Cache de tokens diarios de IS por ambiente';
COMMENT ON TABLE is_catalogs IS 'Cache de catálogos IS (marcas, modelos, planes)';

COMMENT ON COLUMN audit_payloads.request_json IS 'Request JSON cifrado - incluye todos los campos enviados a IS';
COMMENT ON COLUMN audit_payloads.response_json IS 'Response JSON cifrado - respuesta completa de IS';

-- NOTA: La integración IS guarda datos en clients y policies (NO en cases)
-- Al emitir póliza: busca/crea cliente → crea póliza con broker=oficina
-- Cotizaciones se mantienen en memoria del frontend (no persisten)
