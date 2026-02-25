-- ============================================================
-- ADM COT — Payments V2: Multi-reference grouping + bank transfers
-- Created: 2026-02-24 (Prompt 4)
-- ============================================================

-- ┌─────────────────────────────────────────────┐
-- │ A) adm_cot_bank_transfers (import of bank   │
-- │    transfers — source of references)        │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_bank_transfers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name        TEXT NOT NULL,
  reference_number TEXT NOT NULL,
  transfer_amount  NUMERIC(12,2) NOT NULL CHECK (transfer_amount > 0),
  remaining_amount NUMERIC(12,2) NOT NULL CHECK (remaining_amount >= 0),
  transfer_date    DATE NOT NULL,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','CLOSED')),
  metadata         JSONB,
  imported_by      UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_cot_bt_ref ON adm_cot_bank_transfers(reference_number);
CREATE INDEX IF NOT EXISTS idx_adm_cot_bt_date ON adm_cot_bank_transfers(transfer_date);
CREATE INDEX IF NOT EXISTS idx_adm_cot_bt_status ON adm_cot_bank_transfers(status);

-- ┌─────────────────────────────────────────────┐
-- │ B) Alter adm_cot_payment_groups for V2      │
-- │    Add status DRAFT/CONFIRMED/POSTED        │
-- └─────────────────────────────────────────────┘
-- Drop old check constraint and add new one
ALTER TABLE adm_cot_payment_groups DROP CONSTRAINT IF EXISTS adm_cot_payment_groups_status_check;
ALTER TABLE adm_cot_payment_groups ADD CONSTRAINT adm_cot_payment_groups_status_check
  CHECK (status IN ('DRAFT','CONFIRMED','POSTED','PENDIENTE','PARCIAL','PAGADO'));

-- Rename total_amount → total_selected_amount (backward compat: keep both)
-- Add new column if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adm_cot_payment_groups' AND column_name = 'total_selected_amount') THEN
    ALTER TABLE adm_cot_payment_groups ADD COLUMN total_selected_amount NUMERIC(12,2) DEFAULT 0;
  END IF;
END $$;

-- ┌─────────────────────────────────────────────┐
-- │ C) adm_cot_payment_group_items              │
-- │    Items (pending payments) in a group      │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_payment_group_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           UUID NOT NULL REFERENCES adm_cot_payment_groups(id) ON DELETE CASCADE,
  pending_payment_id UUID NOT NULL REFERENCES adm_cot_payments(id) ON DELETE CASCADE,
  insurer            TEXT NOT NULL,
  amount_applied     NUMERIC(12,2) NOT NULL CHECK (amount_applied > 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_cot_pgi_group ON adm_cot_payment_group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_adm_cot_pgi_payment ON adm_cot_payment_group_items(pending_payment_id);

-- ┌─────────────────────────────────────────────┐
-- │ D) adm_cot_payment_group_references         │
-- │    Bank transfers used per group            │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_payment_group_references (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          UUID NOT NULL REFERENCES adm_cot_payment_groups(id) ON DELETE CASCADE,
  bank_transfer_id  UUID NOT NULL REFERENCES adm_cot_bank_transfers(id) ON DELETE CASCADE,
  amount_used       NUMERIC(12,2) NOT NULL CHECK (amount_used > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_cot_pgr_group ON adm_cot_payment_group_references(group_id);
CREATE INDEX IF NOT EXISTS idx_adm_cot_pgr_transfer ON adm_cot_payment_group_references(bank_transfer_id);

-- ┌─────────────────────────────────────────────┐
-- │ E) adm_cot_audit_log (payment audit trail)  │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  user_id     UUID,
  ip_address  TEXT,
  region      TEXT,
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm_cot_audit_event ON adm_cot_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_adm_cot_audit_entity ON adm_cot_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_adm_cot_audit_date ON adm_cot_audit_log(created_at);

-- ┌─────────────────────────────────────────────┐
-- │ F) Additional indexes on existing tables    │
-- └─────────────────────────────────────────────┘
CREATE INDEX IF NOT EXISTS idx_adm_cot_payments_date ON adm_cot_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_adm_cot_payments_refund ON adm_cot_payments(is_refund) WHERE is_refund = true;
CREATE INDEX IF NOT EXISTS idx_adm_cot_recurrences_active_next ON adm_cot_recurrences(next_due_date) WHERE status = 'ACTIVA';
CREATE INDEX IF NOT EXISTS idx_adm_cot_recurrences_poliza ON adm_cot_recurrences(nro_poliza);

-- Unique constraint for idempotent payment creation
CREATE UNIQUE INDEX IF NOT EXISTS idx_adm_cot_payments_idempotent
  ON adm_cot_payments(nro_poliza, insurer, payment_date, installment_num)
  WHERE nro_poliza IS NOT NULL AND payment_date IS NOT NULL AND installment_num IS NOT NULL;

-- ┌─────────────────────────────────────────────┐
-- │ G) RLS for new tables                       │
-- └─────────────────────────────────────────────┘
ALTER TABLE adm_cot_bank_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_payment_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_payment_group_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_audit_log ENABLE ROW LEVEL SECURITY;

-- Master-only policies
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'adm_cot_bank_transfers',
      'adm_cot_payment_group_items',
      'adm_cot_payment_group_references',
      'adm_cot_audit_log'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY master_all ON %I FOR ALL USING (is_master()) WITH CHECK (is_master())',
      tbl
    );
  END LOOP;
END $$;

-- Updated_at triggers for new tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY['adm_cot_bank_transfers'])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION adm_cot_set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ┌─────────────────────────────────────────────┐
-- │ H) RPC: Atomic group+post transaction       │
-- └─────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION adm_cot_confirm_group(
  p_group_id UUID,
  p_items JSONB,       -- [{pending_payment_id, insurer, amount_applied}]
  p_references JSONB,  -- [{bank_transfer_id, amount_used}]
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  ref JSONB;
  v_total_items NUMERIC := 0;
  v_total_refs NUMERIC := 0;
  v_remaining NUMERIC;
  v_payment_amount NUMERIC;
  v_insurers TEXT[] := '{}';
BEGIN
  -- Validate items
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Check payment exists and is PENDING
    SELECT amount INTO v_payment_amount
    FROM adm_cot_payments
    WHERE id = (item->>'pending_payment_id')::UUID
      AND status = 'PENDIENTE';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Payment ' || (item->>'pending_payment_id') || ' not found or not PENDING');
    END IF;
    -- amount_applied <= payment amount
    IF (item->>'amount_applied')::NUMERIC > v_payment_amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'amount_applied exceeds payment amount for ' || (item->>'pending_payment_id'));
    END IF;
    v_total_items := v_total_items + (item->>'amount_applied')::NUMERIC;
    v_insurers := array_append(v_insurers, item->>'insurer');
  END LOOP;

  -- Validate references
  FOR ref IN SELECT * FROM jsonb_array_elements(p_references)
  LOOP
    SELECT remaining_amount INTO v_remaining
    FROM adm_cot_bank_transfers
    WHERE id = (ref->>'bank_transfer_id')::UUID
      AND status = 'OPEN';
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Transfer ' || (ref->>'bank_transfer_id') || ' not found or CLOSED');
    END IF;
    IF (ref->>'amount_used')::NUMERIC > v_remaining THEN
      RETURN jsonb_build_object('success', false, 'error', 'amount_used exceeds remaining for transfer ' || (ref->>'bank_transfer_id'));
    END IF;
    v_total_refs := v_total_refs + (ref->>'amount_used')::NUMERIC;
  END LOOP;

  -- Total references must cover total items
  IF v_total_refs < v_total_items THEN
    RETURN jsonb_build_object('success', false, 'error', 'Total references (' || v_total_refs || ') < total items (' || v_total_items || ')');
  END IF;

  -- Update group
  UPDATE adm_cot_payment_groups SET
    status = 'CONFIRMED',
    total_selected_amount = v_total_items,
    total_amount = v_total_items,
    insurers = (SELECT ARRAY(SELECT DISTINCT unnest(v_insurers))),
    updated_at = now()
  WHERE id = p_group_id;

  -- Insert items
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO adm_cot_payment_group_items (group_id, pending_payment_id, insurer, amount_applied)
    VALUES (p_group_id, (item->>'pending_payment_id')::UUID, item->>'insurer', (item->>'amount_applied')::NUMERIC);

    -- Mark payment as GROUPED
    UPDATE adm_cot_payments SET status = 'AGRUPADO', group_id = p_group_id WHERE id = (item->>'pending_payment_id')::UUID;
  END LOOP;

  -- Insert references and deduct from transfers
  FOR ref IN SELECT * FROM jsonb_array_elements(p_references)
  LOOP
    INSERT INTO adm_cot_payment_group_references (group_id, bank_transfer_id, amount_used)
    VALUES (p_group_id, (ref->>'bank_transfer_id')::UUID, (ref->>'amount_used')::NUMERIC);

    UPDATE adm_cot_bank_transfers SET
      remaining_amount = remaining_amount - (ref->>'amount_used')::NUMERIC,
      status = CASE WHEN remaining_amount - (ref->>'amount_used')::NUMERIC <= 0 THEN 'CLOSED' ELSE status END
    WHERE id = (ref->>'bank_transfer_id')::UUID;
  END LOOP;

  -- Audit
  INSERT INTO adm_cot_audit_log (event_type, entity_type, entity_id, user_id, detail)
  VALUES ('group_confirmed', 'payment_group', p_group_id, p_user_id,
    jsonb_build_object('total_items', v_total_items, 'total_refs', v_total_refs, 'insurers', v_insurers));

  RETURN jsonb_build_object('success', true, 'group_id', p_group_id);
END;
$$;

-- ┌─────────────────────────────────────────────┐
-- │ I) RPC: Post group (CONFIRMED → POSTED)     │
-- └─────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION adm_cot_post_group(
  p_group_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM adm_cot_payment_groups WHERE id = p_group_id;
  IF v_status != 'CONFIRMED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Group must be CONFIRMED to post, current: ' || COALESCE(v_status, 'NOT FOUND'));
  END IF;

  -- Mark group as POSTED
  UPDATE adm_cot_payment_groups SET status = 'POSTED', paid_amount = total_amount WHERE id = p_group_id;

  -- Mark all payments in group as PAID
  UPDATE adm_cot_payments SET status = 'PAGADO' WHERE group_id = p_group_id AND status = 'AGRUPADO';

  -- Audit
  INSERT INTO adm_cot_audit_log (event_type, entity_type, entity_id, user_id, detail)
  VALUES ('group_posted', 'payment_group', p_group_id, p_user_id, '{}'::jsonb);

  RETURN jsonb_build_object('success', true);
END;
$$;
