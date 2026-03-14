-- ============================================================
-- ADM COT — PagueloFacil + Morosidad Integration
-- Created: 2026-03-13
-- 
-- 1. Add PagueloFacil metadata columns to adm_cot_payments
-- 2. Add CONFIRMADO_PF and PENDIENTE_CONFIRMACION to status CHECK
-- 3. Add due_date column for SLA / morosidad tracking
-- ============================================================

-- A) Drop old status check and add new one with CONFIRMADO_PF + PENDIENTE_CONFIRMACION
ALTER TABLE adm_cot_payments DROP CONSTRAINT IF EXISTS adm_cot_payments_status_check;
ALTER TABLE adm_cot_payments ADD CONSTRAINT adm_cot_payments_status_check
  CHECK (status IN ('PENDIENTE','PENDIENTE_CONFIRMACION','CONFIRMADO_PF','AGRUPADO','PAGADO','DEVOLUCION'));

-- B) Add PagueloFacil metadata columns
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_payments' AND column_name = 'pf_cod_oper') THEN
    ALTER TABLE adm_cot_payments ADD COLUMN pf_cod_oper TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_payments' AND column_name = 'pf_confirmed_at') THEN
    ALTER TABLE adm_cot_payments ADD COLUMN pf_confirmed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_payments' AND column_name = 'pf_rec_cod_oper') THEN
    ALTER TABLE adm_cot_payments ADD COLUMN pf_rec_cod_oper TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_payments' AND column_name = 'pf_card_type') THEN
    ALTER TABLE adm_cot_payments ADD COLUMN pf_card_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_payments' AND column_name = 'pf_card_display') THEN
    ALTER TABLE adm_cot_payments ADD COLUMN pf_card_display TEXT;
  END IF;
END $$;

-- C) Add due_date column for SLA and morosidad tracking (15-day rule)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_payments' AND column_name = 'due_date') THEN
    ALTER TABLE adm_cot_payments ADD COLUMN due_date DATE;
  END IF;
END $$;

-- D) Add pf_cod_oper to adm_cot_recurrences for linking to PagueloFacil recurrence
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_recurrences' AND column_name = 'pf_cod_oper') THEN
    ALTER TABLE adm_cot_recurrences ADD COLUMN pf_cod_oper TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_recurrences' AND column_name = 'pf_rec_cod_oper') THEN
    ALTER TABLE adm_cot_recurrences ADD COLUMN pf_rec_cod_oper TEXT;
  END IF;
END $$;

-- E) Index for morosidad queries: overdue PENDIENTE_CONFIRMACION payments
CREATE INDEX IF NOT EXISTS idx_adm_cot_payments_overdue
  ON adm_cot_payments(due_date, status)
  WHERE status = 'PENDIENTE_CONFIRMACION' AND due_date IS NOT NULL;

-- F) Index for PF cod_oper lookup
CREATE INDEX IF NOT EXISTS idx_adm_cot_payments_pf_cod ON adm_cot_payments(pf_cod_oper)
  WHERE pf_cod_oper IS NOT NULL;
