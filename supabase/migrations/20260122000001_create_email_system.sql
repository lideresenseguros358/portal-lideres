-- ============================================
-- SISTEMA DE CORREOS AUTOMÁTICOS
-- ============================================
-- Tablas para logging, dedupe y scheduling de emails

-- ============================================
-- 1. TABLA DE LOGS DE EMAIL
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Datos del correo
  "to" TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT,
  
  -- Control de dedupe
  dedupe_key TEXT UNIQUE,
  
  -- Estado
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT,
  
  -- Metadata adicional
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_email_logs_dedupe_key ON email_logs(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX idx_email_logs_template ON email_logs(template) WHERE template IS NOT NULL;

-- ============================================
-- 2. TABLA DE JOBS PROGRAMADOS
-- ============================================
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tipo de job
  job_type TEXT NOT NULL,
  
  -- Payload del job
  payload JSONB NOT NULL,
  
  -- Timing
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error TEXT,
  
  -- Reintentos
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para scheduler
CREATE INDEX idx_scheduled_jobs_status_scheduled ON scheduled_jobs(status, scheduled_for) 
  WHERE status IN ('pending', 'processing');
CREATE INDEX idx_scheduled_jobs_type ON scheduled_jobs(job_type);
CREATE INDEX idx_scheduled_jobs_executed_at ON scheduled_jobs(executed_at) WHERE executed_at IS NOT NULL;

-- ============================================
-- 3. RLS POLICIES
-- ============================================

-- Email logs: Solo lectura para masters
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters pueden ver email logs"
  ON email_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Scheduled jobs: Solo lectura para masters
ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters pueden ver scheduled jobs"
  ON scheduled_jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- ============================================
-- 4. FUNCIONES HELPER
-- ============================================

-- Función para limpiar logs viejos (>90 días)
CREATE OR REPLACE FUNCTION cleanup_old_email_logs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM email_logs
  WHERE created_at < now() - interval '90 days';
END;
$$;

-- Función para obtener jobs pendientes
CREATE OR REPLACE FUNCTION get_pending_jobs()
RETURNS TABLE (
  id UUID,
  job_type TEXT,
  payload JSONB,
  scheduled_for TIMESTAMPTZ,
  retry_count INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.job_type,
    j.payload,
    j.scheduled_for,
    j.retry_count
  FROM scheduled_jobs j
  WHERE j.status = 'pending'
    AND j.scheduled_for <= now()
    AND j.retry_count < j.max_retries
  ORDER BY j.scheduled_for ASC
  LIMIT 100;
END;
$$;

-- ============================================
-- 5. TRIGGERS
-- ============================================

-- Actualizar updated_at en scheduled_jobs
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scheduled_jobs_updated_at
  BEFORE UPDATE ON scheduled_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE email_logs IS 'Registro de todos los correos enviados por el sistema';
COMMENT ON TABLE scheduled_jobs IS 'Jobs programados para ejecución diferida';

COMMENT ON COLUMN email_logs.dedupe_key IS 'Clave única para evitar duplicados (nullable)';
COMMENT ON COLUMN email_logs.metadata IS 'Datos adicionales: messageId, fromType, etc.';

COMMENT ON COLUMN scheduled_jobs.job_type IS 'Tipo: reminder, retry, deferred, etc.';
COMMENT ON COLUMN scheduled_jobs.payload IS 'Datos del job en formato JSON';
COMMENT ON COLUMN scheduled_jobs.scheduled_for IS 'Cuándo debe ejecutarse (timezone-aware)';
