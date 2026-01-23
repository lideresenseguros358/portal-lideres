-- TABLA DIAGNOSTIC_RUNS
-- Sistema de autodiagnóstico para flujo IMAP → Vertex → CaseEngine → UI
-- Permite verificar cada paso del pipeline sin depender de Vercel Logs

CREATE TABLE IF NOT EXISTS diagnostic_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- running | success | failed
  test_type TEXT NOT NULL, -- e2e | imap | smtp | cron | env
  
  -- Steps detallados (cada uno true/false/null)
  steps JSONB DEFAULT '{}'::jsonb,
  -- Ejemplo: {"env_ok": true, "smtp_sent": true, "imap_found": false, "vertex_ok": null}
  
  -- IDs de evidencia
  test_email_subject TEXT,
  inbound_email_id UUID,
  case_id UUID,
  ticket TEXT,
  
  -- Resultados
  summary TEXT,
  errors JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Auditoría
  created_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_diagnostic_runs_status ON diagnostic_runs(status);
CREATE INDEX idx_diagnostic_runs_test_type ON diagnostic_runs(test_type);
CREATE INDEX idx_diagnostic_runs_started_at ON diagnostic_runs(started_at DESC);
CREATE INDEX idx_diagnostic_runs_case_id ON diagnostic_runs(case_id) WHERE case_id IS NOT NULL;

-- RLS: Solo master puede ver/crear diagnósticos
ALTER TABLE diagnostic_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Master can view all diagnostics"
  ON diagnostic_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Master can insert diagnostics"
  ON diagnostic_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

COMMENT ON TABLE diagnostic_runs IS 'Registro de ejecuciones de diagnóstico del sistema IMAP/SMTP/Vertex/CaseEngine';
