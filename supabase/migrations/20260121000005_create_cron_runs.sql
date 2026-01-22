-- ============================================
-- TABLA DE HEARTBEAT PARA CRON JOBS
-- ============================================
-- Registro de ejecuciones de cron jobs para monitoreo y debugging
-- Permite verificar que los crons se ejecutan correctamente cada 3 minutos

CREATE TABLE IF NOT EXISTS cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  job_name TEXT NOT NULL, -- 'imap-ingest', 'aplazados-check', etc
  
  -- Timestamps
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ NULL,
  
  -- Resultado
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'failed'
  processed_count INTEGER DEFAULT 0, -- Emails/casos procesados
  error_message TEXT NULL,
  error_stack TEXT NULL,
  
  -- Metadata adicional
  metadata JSONB NULL, -- Info adicional: { messagesProcessed, casesCreated, etc }
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE cron_runs IS 'Heartbeat y logging de ejecuciones de cron jobs';
COMMENT ON COLUMN cron_runs.job_name IS 'Nombre del cron job ejecutado';
COMMENT ON COLUMN cron_runs.started_at IS 'Timestamp de inicio de ejecución';
COMMENT ON COLUMN cron_runs.finished_at IS 'Timestamp de finalización (NULL si aún corriendo)';
COMMENT ON COLUMN cron_runs.status IS 'Estado: running, success, failed';
COMMENT ON COLUMN cron_runs.processed_count IS 'Cantidad de items procesados (emails, casos, etc)';
COMMENT ON COLUMN cron_runs.metadata IS 'Información adicional de la ejecución';

-- Índices para consultas frecuentes
CREATE INDEX idx_cron_runs_job_name ON cron_runs(job_name);
CREATE INDEX idx_cron_runs_started_at ON cron_runs(started_at DESC);
CREATE INDEX idx_cron_runs_status ON cron_runs(status);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- Solo master puede ver logs de cron
CREATE POLICY cron_runs_master_read ON cron_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- System puede insertar/actualizar (no requiere auth)
-- Nota: Los crons corren sin autenticación de usuario
CREATE POLICY cron_runs_system_write ON cron_runs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================
-- FUNCIÓN HELPER PARA LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION log_cron_start(p_job_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_run_id UUID;
BEGIN
  INSERT INTO cron_runs (job_name, started_at, status)
  VALUES (p_job_name, NOW(), 'running')
  RETURNING id INTO v_run_id;
  
  RETURN v_run_id;
END;
$$;

CREATE OR REPLACE FUNCTION log_cron_finish(
  p_run_id UUID,
  p_status TEXT,
  p_processed_count INTEGER DEFAULT 0,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cron_runs
  SET 
    finished_at = NOW(),
    status = p_status,
    processed_count = p_processed_count,
    error_message = p_error_message,
    metadata = p_metadata
  WHERE id = p_run_id;
END;
$$;

COMMENT ON FUNCTION log_cron_start IS 'Registra inicio de ejecución de cron job';
COMMENT ON FUNCTION log_cron_finish IS 'Registra finalización de ejecución de cron job';

-- ============================================
-- VISTA PARA MONITOREO
-- ============================================

CREATE OR REPLACE VIEW cron_runs_summary AS
SELECT 
  job_name,
  COUNT(*) as total_runs,
  COUNT(*) FILTER (WHERE status = 'success') as successful_runs,
  COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
  COUNT(*) FILTER (WHERE status = 'running') as currently_running,
  AVG(EXTRACT(EPOCH FROM (finished_at - started_at))) FILTER (WHERE finished_at IS NOT NULL) as avg_duration_seconds,
  MAX(started_at) as last_run_at,
  SUM(processed_count) as total_processed
FROM cron_runs
GROUP BY job_name;

COMMENT ON VIEW cron_runs_summary IS 'Resumen de ejecuciones de cron jobs por tipo';

-- Grant permissions
GRANT SELECT ON cron_runs_summary TO authenticated;
