-- ========================================
-- MEJORAS AL SCHEMA DE PAGOS
-- Migración incremental — NO recrea tablas existentes
-- ========================================

-- ========================================
-- 1. BANK_TRANSFERS — Categorización y bloqueo
-- ========================================

-- Categoría de transferencia (prima, devolución, comisión, etc.)
ALTER TABLE bank_transfers
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'uncategorized'
  CHECK (category IN ('prima', 'devolucion', 'comision', 'adelanto', 'otro', 'uncategorized'));

-- Bloqueo manual de transferencias
ALTER TABLE bank_transfers
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

ALTER TABLE bank_transfers
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

ALTER TABLE bank_transfers
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMPTZ;

ALTER TABLE bank_transfers
  ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES auth.users(id);

-- Fuente de la transferencia (importación manual, PagueloFacil, sintética por deducción)
ALTER TABLE bank_transfers
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'import'
  CHECK (source IN ('import', 'paguelofacil', 'synthetic', 'manual'));

-- Índice para búsquedas por categoría
CREATE INDEX IF NOT EXISTS idx_bank_transfers_category ON bank_transfers(category);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_blocked ON bank_transfers(is_blocked) WHERE is_blocked = true;

-- ========================================
-- 2. PENDING_PAYMENTS — SLA, modo de pago, cuotas
-- ========================================

-- Fecha límite para SLA (15 días por defecto desde created_at)
ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Fuente del pago (banco, paguelofacil, deducción broker)
ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS payment_source TEXT DEFAULT 'bank'
  CHECK (payment_source IN ('bank', 'paguelofacil', 'broker_deduction', 'manual'));

-- Modo de pago (contado, cuotas, recurrente)
ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'contado'
  CHECK (payment_mode IN ('contado', 'cuotas', 'recurrente'));

-- Información de cuotas
ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS installment_number INTEGER;

ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS total_installments INTEGER;

-- Agrupación de cuotas bajo un pago padre
ALTER TABLE pending_payments
  ADD COLUMN IF NOT EXISTS parent_payment_id UUID REFERENCES pending_payments(id) ON DELETE SET NULL;

-- Índices para cuotas y SLA
CREATE INDEX IF NOT EXISTS idx_pending_payments_due_date ON pending_payments(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_payments_parent ON pending_payments(parent_payment_id) WHERE parent_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pending_payments_mode ON pending_payments(payment_mode);
CREATE INDEX IF NOT EXISTS idx_pending_payments_source ON pending_payments(payment_source);

-- ========================================
-- 3. PAYMENT_DETAILS — Trazabilidad de fuente
-- ========================================

-- Fuente de la transacción (banco, paguelofacil, deducción)
ALTER TABLE payment_details
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'bank'
  CHECK (source IN ('bank', 'paguelofacil', 'broker_deduction', 'manual'));

-- ID de transacción externo (PagueloFacil, etc.)
ALTER TABLE payment_details
  ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- Notas adicionales
ALTER TABLE payment_details
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Índice para buscar por transacción externa
CREATE INDEX IF NOT EXISTS idx_payment_details_txn ON payment_details(transaction_id) WHERE transaction_id IS NOT NULL;

-- ========================================
-- 4. POLICIES ADICIONALES PARA UPDATE en bank_transfers
-- ========================================

-- Masters pueden actualizar bank_transfers (bloqueo, categorización)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'bank_transfers' 
    AND policyname = 'Masters pueden actualizar bank_transfers'
  ) THEN
    CREATE POLICY "Masters pueden actualizar bank_transfers"
      ON bank_transfers FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM auth.users
          WHERE auth.uid() = id
          AND raw_user_meta_data->>'role' = 'master'
        )
      );
  END IF;
END $$;

-- ========================================
-- 5. FUNCIÓN HELPER: Calcular SLA restante
-- ========================================
CREATE OR REPLACE FUNCTION get_payment_sla_days(payment_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_due_date DATE;
  v_created_at TIMESTAMPTZ;
BEGIN
  SELECT due_date, created_at INTO v_due_date, v_created_at
  FROM pending_payments WHERE id = payment_id;
  
  IF v_due_date IS NOT NULL THEN
    RETURN (v_due_date - CURRENT_DATE);
  ELSE
    -- Default: 15 business days from creation
    RETURN 15 - (CURRENT_DATE - v_created_at::date);
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ========================================
-- 6. SET DEFAULT due_date FOR EXISTING RECORDS
-- ========================================
UPDATE pending_payments 
SET due_date = (created_at::date + INTERVAL '15 days')::date
WHERE due_date IS NULL AND status = 'pending';

-- ========================================
-- COMENTARIOS
-- ========================================
COMMENT ON COLUMN bank_transfers.category IS 'Categoría: prima, devolucion, comision, adelanto, otro, uncategorized';
COMMENT ON COLUMN bank_transfers.is_blocked IS 'true si la transferencia está bloqueada manualmente';
COMMENT ON COLUMN bank_transfers.source IS 'Fuente: import (CSV), paguelofacil, synthetic (deducción), manual';
COMMENT ON COLUMN pending_payments.due_date IS 'Fecha límite SLA para el pago';
COMMENT ON COLUMN pending_payments.payment_source IS 'Fuente del pago: bank, paguelofacil, broker_deduction, manual';
COMMENT ON COLUMN pending_payments.payment_mode IS 'Modo: contado, cuotas, recurrente';
COMMENT ON COLUMN pending_payments.installment_number IS 'Número de cuota (1-based)';
COMMENT ON COLUMN pending_payments.total_installments IS 'Total de cuotas para este grupo';
COMMENT ON COLUMN pending_payments.parent_payment_id IS 'FK al pago padre para agrupar cuotas';
COMMENT ON COLUMN payment_details.source IS 'Fuente de la transacción';
COMMENT ON COLUMN payment_details.transaction_id IS 'ID de transacción externo (PagueloFacil, etc.)';
