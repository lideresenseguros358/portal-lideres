-- =====================================================
-- MIGRACIÓN: Sistema de Reportes de Ajustes Agrupados
-- =====================================================
-- Ejecutar en: Supabase SQL Editor
-- Fecha: 2025-01-24
-- =====================================================

-- Crear tabla de reportes de ajustes agrupados
CREATE TABLE IF NOT EXISTS adjustment_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  broker_notes TEXT,
  admin_notes TEXT,
  payment_mode TEXT CHECK (payment_mode IN ('immediate', 'next_fortnight')),
  fortnight_id UUID REFERENCES fortnights(id) ON DELETE SET NULL,
  paid_date TIMESTAMPTZ,
  rejected_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Crear tabla de relación entre reportes y pending_items
CREATE TABLE IF NOT EXISTS adjustment_report_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES adjustment_reports(id) ON DELETE CASCADE,
  pending_item_id UUID NOT NULL REFERENCES pending_items(id) ON DELETE CASCADE,
  commission_raw DECIMAL(12, 2) NOT NULL,
  broker_commission DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(report_id, pending_item_id)
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_adjustment_reports_broker ON adjustment_reports(broker_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_reports_status ON adjustment_reports(status);
CREATE INDEX IF NOT EXISTS idx_adjustment_reports_fortnight ON adjustment_reports(fortnight_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_report_items_report ON adjustment_report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_report_items_pending ON adjustment_report_items(pending_item_id);

-- RLS Policies
ALTER TABLE adjustment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjustment_report_items ENABLE ROW LEVEL SECURITY;

-- Policy: Brokers pueden ver sus propios reportes
DROP POLICY IF EXISTS "Brokers can view their own reports" ON adjustment_reports;
CREATE POLICY "Brokers can view their own reports"
  ON adjustment_reports
  FOR SELECT
  USING (
    broker_id IN (
      SELECT id FROM brokers WHERE p_id = auth.uid()
    )
  );

-- Policy: Brokers pueden crear reportes
DROP POLICY IF EXISTS "Brokers can create reports" ON adjustment_reports;
CREATE POLICY "Brokers can create reports"
  ON adjustment_reports
  FOR INSERT
  WITH CHECK (
    broker_id IN (
      SELECT id FROM brokers WHERE p_id = auth.uid()
    )
  );

-- Policy: Master puede ver todos los reportes
DROP POLICY IF EXISTS "Master can view all reports" ON adjustment_reports;
CREATE POLICY "Master can view all reports"
  ON adjustment_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Policy: Master puede actualizar reportes
DROP POLICY IF EXISTS "Master can update reports" ON adjustment_reports;
CREATE POLICY "Master can update reports"
  ON adjustment_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Policy: Brokers pueden ver sus items de reporte
DROP POLICY IF EXISTS "Brokers can view their report items" ON adjustment_report_items;
CREATE POLICY "Brokers can view their report items"
  ON adjustment_report_items
  FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM adjustment_reports
      WHERE broker_id IN (
        SELECT id FROM brokers WHERE p_id = auth.uid()
      )
    )
  );

-- Policy: Brokers pueden crear items de reporte
DROP POLICY IF EXISTS "Brokers can create report items" ON adjustment_report_items;
CREATE POLICY "Brokers can create report items"
  ON adjustment_report_items
  FOR INSERT
  WITH CHECK (
    report_id IN (
      SELECT id FROM adjustment_reports
      WHERE broker_id IN (
        SELECT id FROM brokers WHERE p_id = auth.uid()
      )
    )
  );

-- Policy: Master puede ver todos los items
DROP POLICY IF EXISTS "Master can view all report items" ON adjustment_report_items;
CREATE POLICY "Master can view all report items"
  ON adjustment_report_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Function para actualizar updated_at
CREATE OR REPLACE FUNCTION update_adjustment_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trigger_adjustment_report_updated_at ON adjustment_reports;
CREATE TRIGGER trigger_adjustment_report_updated_at
  BEFORE UPDATE ON adjustment_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_adjustment_report_updated_at();

-- Comentarios
COMMENT ON TABLE adjustment_reports IS 'Reportes agrupados de ajustes enviados por brokers';
COMMENT ON TABLE adjustment_report_items IS 'Items individuales que forman parte de un reporte de ajuste';
COMMENT ON COLUMN adjustment_reports.payment_mode IS 'immediate = pagar ya, next_fortnight = sumar en próxima quincena';
COMMENT ON COLUMN adjustment_reports.fortnight_id IS 'ID de quincena donde se sumará (si payment_mode = next_fortnight)';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

SELECT 
  'adjustment_reports' as tabla,
  COUNT(*) as registros
FROM adjustment_reports
UNION ALL
SELECT 
  'adjustment_report_items' as tabla,
  COUNT(*) as registros
FROM adjustment_report_items;
