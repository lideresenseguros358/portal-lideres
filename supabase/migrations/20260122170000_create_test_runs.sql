-- =====================================================
-- TABLA: test_runs
-- Almacena resultados de ejecuciones de testing automatizado
-- =====================================================

CREATE TABLE IF NOT EXISTS test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_type TEXT NOT NULL, -- 'e2e-imap', 'cron-run', etc.
  test_id TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  results JSONB,
  verifications JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_test_runs_test_type ON test_runs(test_type);
CREATE INDEX idx_test_runs_created_at ON test_runs(created_at DESC);
CREATE INDEX idx_test_runs_success ON test_runs(success);

-- RLS: Solo masters pueden ver test runs
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can view test runs"
  ON test_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Comentarios
COMMENT ON TABLE test_runs IS 'Almacena resultados de testing automatizado E2E';
COMMENT ON COLUMN test_runs.test_type IS 'Tipo de test: e2e-imap, cron-run, etc.';
COMMENT ON COLUMN test_runs.test_id IS 'ID único del test ejecutado';
COMMENT ON COLUMN test_runs.success IS 'Indica si el test pasó exitosamente';
COMMENT ON COLUMN test_runs.results IS 'Resultados detallados del test en formato JSON';
COMMENT ON COLUMN test_runs.verifications IS 'Verificaciones automáticas realizadas';
