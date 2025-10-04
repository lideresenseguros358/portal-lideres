-- =====================================================
-- MIGRATION: Enhance Cases Table for Full Pendientes System
-- Date: 2025-10-03
-- Purpose: Add missing fields for SLA, payments, postpone, etc.
-- =====================================================

-- 1. Add missing columns to cases table
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS client_name TEXT, -- For cases without client_id
ADD COLUMN IF NOT EXISTS sla_date DATE, -- SLA deadline
ADD COLUMN IF NOT EXISTS sla_days INTEGER DEFAULT 7, -- SLA days (7-15 for Generales, 8-20 for Personas)
ADD COLUMN IF NOT EXISTS postponed_until DATE, -- For APLAZADO status
ADD COLUMN IF NOT EXISTS premium NUMERIC(12,2), -- Prima
ADD COLUMN IF NOT EXISTS payment_method TEXT, -- Forma de pago
ADD COLUMN IF NOT EXISTS management_type TEXT DEFAULT 'COTIZACION', -- COTIZACION, EMISION, REHABILITACION, etc.
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false, -- Papelera (30 días)
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, -- When moved to trash
ADD COLUMN IF NOT EXISTS discount_to_broker BOOLEAN DEFAULT false, -- Descontar a corredor
ADD COLUMN IF NOT EXISTS direct_payment BOOLEAN DEFAULT false, -- Pago directo del corredor
ADD COLUMN IF NOT EXISTS claimed_by_broker_id UUID REFERENCES public.brokers(id) ON DELETE SET NULL, -- "Mío" claim
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true, -- Email verification (broker whitelist)
ADD COLUMN IF NOT EXISTS thread_id TEXT, -- Email thread for grouping
ADD COLUMN IF NOT EXISTS message_id TEXT; -- Email message ID for idempotency

-- Add comments
COMMENT ON COLUMN public.cases.client_name IS 'Client name when client_id is null (from emails)';
COMMENT ON COLUMN public.cases.sla_date IS 'SLA deadline date';
COMMENT ON COLUMN public.cases.sla_days IS 'SLA days (7-15 Generales, 8-20 Personas)';
COMMENT ON COLUMN public.cases.postponed_until IS 'Target date when APLAZADO';
COMMENT ON COLUMN public.cases.management_type IS 'COTIZACION, EMISION, REHABILITACION, MODIFICACION, CANCELACION, CAMBIO, RECLAMO, EMISION_EXPRESS';
COMMENT ON COLUMN public.cases.is_deleted IS 'Moved to trash (auto-purge after 30 days)';
COMMENT ON COLUMN public.cases.discount_to_broker IS 'Master marked to discount from broker commission';
COMMENT ON COLUMN public.cases.claimed_by_broker_id IS 'Broker who claimed "mío" on unidentified case';
COMMENT ON COLUMN public.cases.is_verified IS 'Email from verified broker (whitelist)';
COMMENT ON COLUMN public.cases.thread_id IS 'Email thread ID for grouping';
COMMENT ON COLUMN public.cases.message_id IS 'Email message ID for idempotency';

-- 2. Create case_comments table
CREATE TABLE IF NOT EXISTS public.case_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('aseguradora', 'oficina')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_comment_channel CHECK (channel IN ('aseguradora', 'oficina'))
);

CREATE INDEX IF NOT EXISTS idx_case_comments_case ON public.case_comments(case_id);
CREATE INDEX IF NOT EXISTS idx_case_comments_created ON public.case_comments(created_at DESC);

COMMENT ON TABLE public.case_comments IS 'Comments on cases (aseguradora visible to all, oficina internal)';
COMMENT ON COLUMN public.case_comments.channel IS 'aseguradora: visible to broker, oficina: internal only';

-- 3. Create case_history table (timeline/audit)
CREATE TABLE IF NOT EXISTS public.case_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- EMAIL_INGRESO, EMAIL_UPDATE, CLASSIFY_CHANGE, STATE_CHANGE, FILE_UPLOADED, etc.
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB, -- Additional data (old_value, new_value, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_history_case ON public.case_history(case_id);
CREATE INDEX IF NOT EXISTS idx_case_history_created ON public.case_history(created_at DESC);

COMMENT ON TABLE public.case_history IS 'Timeline/audit log for cases';
COMMENT ON COLUMN public.case_history.action IS 'EMAIL_INGRESO, STATE_CHANGE, FILE_UPLOADED, CLASSIFY_CHANGE, etc.';

-- 4. Update case_status_enum to include new statuses
-- DROP TYPE IF EXISTS public.case_status_enum_new CASCADE;
-- CREATE TYPE public.case_status_enum_new AS ENUM (
--   'PENDIENTE_REVISION',
--   'EN_PROCESO',
--   'FALTA_DOC',
--   'APLAZADO',
--   'RECHAZADO',
--   'APROBADO_PEND_PAGO',
--   'EMITIDO',
--   'CERRADO',
--   'REVISAR_ORIGEN'
-- );

-- Note: Enum already has correct values, no need to alter

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cases_broker_active ON public.cases(broker_id) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_cases_section_status ON public.cases(section, status) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_cases_sla_date ON public.cases(sla_date) WHERE is_deleted = false AND status NOT IN ('CERRADO', 'EMITIDO');
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON public.cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_deleted ON public.cases(deleted_at) WHERE is_deleted = true;
CREATE INDEX IF NOT EXISTS idx_cases_ticket_ref ON public.cases(ticket_ref) WHERE ticket_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_thread_id ON public.cases(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_message_id ON public.cases(message_id) WHERE message_id IS NOT NULL;

-- 6. Function to auto-purge deleted cases after 30 days
CREATE OR REPLACE FUNCTION public.purge_deleted_cases()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_purged_count INTEGER;
BEGIN
  DELETE FROM public.cases
  WHERE is_deleted = true
  AND deleted_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_purged_count = ROW_COUNT;
  
  RAISE NOTICE 'Purged % cases older than 30 days', v_purged_count;
  RETURN v_purged_count;
END;
$$;

COMMENT ON FUNCTION public.purge_deleted_cases() IS 
'Auto-purges cases in trash older than 30 days. Run daily via cron.';

-- 7. Function to auto-move expired cases to trash (7 days no update)
CREATE OR REPLACE FUNCTION public.auto_trash_expired_cases()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trashed_count INTEGER;
BEGIN
  UPDATE public.cases
  SET 
    is_deleted = true,
    deleted_at = NOW()
  WHERE is_deleted = false
  AND status NOT IN ('CERRADO', 'EMITIDO')
  AND sla_date < NOW() - INTERVAL '7 days'
  AND updated_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS v_trashed_count = ROW_COUNT;
  
  RAISE NOTICE 'Auto-trashed % expired cases', v_trashed_count;
  RETURN v_trashed_count;
END;
$$;

COMMENT ON FUNCTION public.auto_trash_expired_cases() IS 
'Auto-moves cases to trash if SLA expired >7 days AND no update in 7 days. Run daily via cron.';

-- 8. Function to calculate SLA days remaining
CREATE OR REPLACE FUNCTION public.get_sla_days_remaining(p_case_id UUID)
RETURNS INTEGER LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_sla_date DATE;
  v_days_remaining INTEGER;
BEGIN
  SELECT sla_date INTO v_sla_date
  FROM public.cases
  WHERE id = p_case_id;
  
  IF v_sla_date IS NULL THEN
    RETURN NULL;
  END IF;
  
  v_days_remaining := v_sla_date - CURRENT_DATE;
  RETURN v_days_remaining;
END;
$$;

COMMENT ON FUNCTION public.get_sla_days_remaining(UUID) IS 
'Returns days remaining until SLA deadline (negative if expired)';

-- 9. RLS Policies
ALTER TABLE public.case_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_history ENABLE ROW LEVEL SECURITY;

-- case_comments: Master sees all, Broker sees only their cases
DROP POLICY IF EXISTS "case_comments_master_all" ON public.case_comments;
CREATE POLICY "case_comments_master_all" ON public.case_comments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

DROP POLICY IF EXISTS "case_comments_broker_own" ON public.case_comments;
CREATE POLICY "case_comments_broker_own" ON public.case_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      INNER JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = case_comments.case_id
      AND (c.broker_id = auth.uid() OR p.role = 'master')
    )
  );

-- Broker can INSERT comments on their cases
DROP POLICY IF EXISTS "case_comments_broker_insert" ON public.case_comments;
CREATE POLICY "case_comments_broker_insert" ON public.case_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id
      AND c.broker_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- case_history: Master sees all, Broker sees only their cases
DROP POLICY IF EXISTS "case_history_master_all" ON public.case_history;
CREATE POLICY "case_history_master_all" ON public.case_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

DROP POLICY IF EXISTS "case_history_broker_own" ON public.case_history;
CREATE POLICY "case_history_broker_own" ON public.case_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_history.case_id
      AND c.broker_id = auth.uid()
    )
  );

-- 10. Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_cases_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_cases_updated_at ON public.cases;
CREATE TRIGGER trigger_update_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cases_updated_at();

-- 11. Trigger to log history on status change
CREATE OR REPLACE FUNCTION public.log_case_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.case_history (case_id, action, created_by, metadata)
    VALUES (
      NEW.id,
      'STATE_CHANGE',
      auth.uid(),
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_case_status_change ON public.cases;
CREATE TRIGGER trigger_log_case_status_change
  AFTER UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.log_case_status_change();

-- =====================================================
-- CRON JOB SETUP (if pg_cron is available)
-- =====================================================
-- Uncomment and run manually if pg_cron extension is enabled:
-- 
-- SELECT cron.schedule(
--   'purge_deleted_cases',
--   '0 3 * * *', -- Every day at 3 AM
--   $$SELECT public.purge_deleted_cases();$$
-- );
--
-- SELECT cron.schedule(
--   'auto_trash_expired_cases',
--   '0 4 * * *', -- Every day at 4 AM
--   $$SELECT public.auto_trash_expired_cases();$$
-- );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check new columns exist:
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'cases' AND column_name IN ('sla_date', 'sla_days', 'management_type');

-- Check new tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('case_comments', 'case_history');

-- Test functions:
-- SELECT public.get_sla_days_remaining('<case_id>');
-- SELECT public.purge_deleted_cases();
-- SELECT public.auto_trash_expired_cases();
