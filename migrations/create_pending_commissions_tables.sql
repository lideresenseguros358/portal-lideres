-- =====================================================
-- MIGRATION: Create Pending Commissions Tables
-- Date: 2025-10-03
-- Purpose: Tables for unidentified commission items
-- =====================================================

-- =====================================================
-- 1. PENDING_ITEMS: Store unidentified commission items
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pending_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Item data
  insured_name TEXT,
  policy_number TEXT NOT NULL,
  insurer_id UUID REFERENCES public.insurers(id) ON DELETE CASCADE,
  commission_raw NUMERIC(12,2) NOT NULL, -- Raw commission (NOT calculated with %)
  
  -- Origin
  fortnight_id UUID REFERENCES public.fortnights(id) ON DELETE CASCADE,
  import_id UUID REFERENCES public.comm_imports(id) ON DELETE CASCADE,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open', -- open, approved_pay_now, approved_next, auto_office, paid
  assigned_broker_id UUID REFERENCES public.brokers(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Notes and decisions
  assignment_notes TEXT,
  action_type TEXT, -- 'pay_now' or 'next_fortnight'
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_pending_status CHECK (status IN ('open', 'claimed', 'approved_pay_now', 'approved_next', 'auto_office', 'rejected', 'paid'))
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_pending_items_policy_number ON public.pending_items(policy_number);
CREATE INDEX IF NOT EXISTS idx_pending_items_fortnight ON public.pending_items(fortnight_id);
CREATE INDEX IF NOT EXISTS idx_pending_items_insurer ON public.pending_items(insurer_id);
CREATE INDEX IF NOT EXISTS idx_pending_items_status ON public.pending_items(status);
CREATE INDEX IF NOT EXISTS idx_pending_items_assigned_broker ON public.pending_items(assigned_broker_id);
CREATE INDEX IF NOT EXISTS idx_pending_items_created_at ON public.pending_items(created_at);

COMMENT ON TABLE public.pending_items IS 'Unidentified commission items from imports - awaiting broker assignment';
COMMENT ON COLUMN public.pending_items.commission_raw IS 'Raw commission amount before applying broker percentage';
COMMENT ON COLUMN public.pending_items.status IS 'open: not assigned, claimed: broker marked as theirs, approved_*: master approved, auto_office: 3 months rule, paid: completed';
COMMENT ON COLUMN public.pending_items.action_type IS 'When approved: pay_now creates adjustment, next_fortnight adds to next period';

-- =====================================================
-- 2. PENDING_POLICY: Group pending items by client/policy
-- =====================================================
CREATE TABLE IF NOT EXISTS public.pending_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_item_id UUID NOT NULL REFERENCES public.pending_items(id) ON DELETE CASCADE,
  policy_number TEXT NOT NULL,
  client_name TEXT, -- Inferred from insured_name if available
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(pending_item_id, policy_number)
);

CREATE INDEX IF NOT EXISTS idx_pending_policy_item ON public.pending_policy(pending_item_id);
CREATE INDEX IF NOT EXISTS idx_pending_policy_number ON public.pending_policy(policy_number);

COMMENT ON TABLE public.pending_policy IS 'Groups pending_items by policy number for aggregated views';

-- =====================================================
-- 3. AUTO-ASSIGNMENT TO OFFICE (3 months rule)
-- =====================================================
CREATE OR REPLACE FUNCTION public.assign_pending_to_office_after_3m()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_office_broker_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Find the OFFICE broker by email
  SELECT b.id INTO v_office_broker_id
  FROM public.brokers b
  INNER JOIN public.profiles p ON p.id = b.id
  WHERE LOWER(p.email) = 'contacto@lideresenseguros.com'
  AND b.active = true
  LIMIT 1;
  
  IF v_office_broker_id IS NULL THEN
    RAISE NOTICE 'Office broker not found (contacto@lideresenseguros.com)';
    RETURN 0;
  END IF;
  
  -- Update pending items older than 3 months
  UPDATE public.pending_items
  SET 
    assigned_broker_id = v_office_broker_id,
    status = 'auto_office',
    assigned_at = NOW(),
    assignment_notes = 'Auto-assigned to OFFICE after 3 months (90 days)'
  WHERE assigned_broker_id IS NULL
    AND status = 'open'
    AND created_at <= NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Auto-assigned % pending items to OFFICE', v_updated_count;
  RETURN v_updated_count;
END;
$$;

COMMENT ON FUNCTION public.assign_pending_to_office_after_3m() IS 
'Auto-assigns unidentified pending items to OFFICE broker after 90 days. Should run daily via cron.';

-- =====================================================
-- 4. TRIGGER: Auto-populate pending_policy
-- =====================================================
CREATE OR REPLACE FUNCTION public.auto_create_pending_policy()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Create pending_policy entry for this item
  INSERT INTO public.pending_policy (pending_item_id, policy_number, client_name)
  VALUES (NEW.id, NEW.policy_number, NEW.insured_name)
  ON CONFLICT (pending_item_id, policy_number) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_create_pending_policy ON public.pending_items;
CREATE TRIGGER trigger_auto_create_pending_policy
  AFTER INSERT ON public.pending_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_pending_policy();

COMMENT ON FUNCTION public.auto_create_pending_policy() IS 
'Auto-creates pending_policy entries when pending_items are inserted';

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================
ALTER TABLE public.pending_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_policy ENABLE ROW LEVEL SECURITY;

-- pending_items: Master sees all, Broker sees only assigned to them
DROP POLICY IF EXISTS "pending_items_master_all" ON public.pending_items;
CREATE POLICY "pending_items_master_all" ON public.pending_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

DROP POLICY IF EXISTS "pending_items_broker_assigned" ON public.pending_items;
CREATE POLICY "pending_items_broker_assigned" ON public.pending_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      INNER JOIN public.brokers b ON b.id = p.id
      WHERE p.id = auth.uid() 
      AND b.id = pending_items.assigned_broker_id
    )
  );

-- Broker can UPDATE to claim items as "mine"
DROP POLICY IF EXISTS "pending_items_broker_claim" ON public.pending_items;
CREATE POLICY "pending_items_broker_claim" ON public.pending_items
  FOR UPDATE USING (
    status = 'open' -- Can only claim open items
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'broker'
    )
  )
  WITH CHECK (
    status = 'claimed' -- Can only change to claimed
    AND assigned_broker_id = auth.uid()
  );

-- pending_policy: Same visibility as pending_items
DROP POLICY IF EXISTS "pending_policy_master_all" ON public.pending_policy;
CREATE POLICY "pending_policy_master_all" ON public.pending_policy
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

DROP POLICY IF EXISTS "pending_policy_broker_assigned" ON public.pending_policy;
CREATE POLICY "pending_policy_broker_assigned" ON public.pending_policy
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pending_items pi
      INNER JOIN public.brokers b ON b.id = pi.assigned_broker_id
      WHERE pi.id = pending_policy.pending_item_id
      AND b.id = auth.uid()
    )
  );

-- =====================================================
-- 6. HELPER FUNCTION: Get pending items grouped by policy
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_pending_items_grouped()
RETURNS TABLE (
  policy_number TEXT,
  client_name TEXT,
  total_items BIGINT,
  total_commission NUMERIC,
  oldest_date TIMESTAMPTZ,
  status TEXT,
  items JSONB
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pp.policy_number,
    pp.client_name,
    COUNT(pi.id) AS total_items,
    SUM(pi.commission_raw) AS total_commission,
    MIN(pi.created_at) AS oldest_date,
    pi.status,
    jsonb_agg(
      jsonb_build_object(
        'id', pi.id,
        'insured_name', pi.insured_name,
        'commission_raw', pi.commission_raw,
        'fortnight_id', pi.fortnight_id,
        'created_at', pi.created_at
      )
    ) AS items
  FROM public.pending_policy pp
  INNER JOIN public.pending_items pi ON pi.id = pp.pending_item_id
  GROUP BY pp.policy_number, pp.client_name, pi.status
  ORDER BY oldest_date ASC;
END;
$$;

COMMENT ON FUNCTION public.get_pending_items_grouped() IS 
'Returns pending items grouped by policy number with aggregated data';

-- =====================================================
-- CRON JOB SETUP (if pg_cron is available)
-- =====================================================
-- Uncomment and run manually if pg_cron extension is enabled:
-- 
-- SELECT cron.schedule(
--   'auto_assign_office_pendings',
--   '0 2 * * *', -- Every day at 2 AM
--   $$SELECT public.assign_pending_to_office_after_3m();$$
-- );

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check tables exist:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('pending_items', 'pending_policy');

-- Test auto-assignment function:
-- SELECT public.assign_pending_to_office_after_3m();

-- View pending items grouped:
-- SELECT * FROM public.get_pending_items_grouped();
