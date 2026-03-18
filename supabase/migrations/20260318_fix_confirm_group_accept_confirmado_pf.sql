-- Fix adm_cot_confirm_group to accept both PENDIENTE and CONFIRMADO_PF payments
-- CONFIRMADO_PF payments are confirmed by PagueloFacil and need to be grouped
-- with bank references for payment to insurers.

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
  v_payment_status TEXT;
  v_insurers TEXT[] := '{}';
BEGIN
  -- Validate items
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Check payment exists and is PENDIENTE or CONFIRMADO_PF
    SELECT amount, status INTO v_payment_amount, v_payment_status
    FROM adm_cot_payments
    WHERE id = (item->>'pending_payment_id')::UUID
      AND status IN ('PENDIENTE', 'CONFIRMADO_PF');
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Payment ' || (item->>'pending_payment_id') || ' not found or not in groupable status (PENDIENTE/CONFIRMADO_PF)');
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
      AND status IN ('OPEN', 'PARTIAL');
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
