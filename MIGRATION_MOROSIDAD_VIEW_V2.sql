-- ═══════════════════════════════════════════════════════
-- MOROSIDAD VIEW V2 — Fix payment type, remaining installments,
-- and exclude zero-balance (already paid) al contado policies.
--
-- LOGIC:
-- 1. Al contado policies only appear if their payment is NOT yet
--    confirmed (status NOT IN ('PAGADO','TRANSFERIDO')).
-- 2. Recurring (cuotas) policies appear only when they have at
--    least one pending/overdue installment in adm_cot_recurrences.
-- 3. "Tipo" is derived: if a recurrence exists → "X Cuotas",
--    otherwise → "Al Contado".
-- 4. paid_installments counts how many schedule items are PAGADO.
-- 5. remaining_installments = total_installments - paid_installments.
--
-- Must DROP first because the new view adds paid_installments column
-- which changes the view signature (CREATE OR REPLACE cannot do that).
-- ═══════════════════════════════════════════════════════

DROP VIEW IF EXISTS ops_morosidad_view;

CREATE VIEW ops_morosidad_view AS

-- ────────────────────────────────────────────
-- A) Recurring payments (cuotas) — one row per pending/overdue payment
-- ────────────────────────────────────────────
SELECT
  p.id                      AS policy_id,
  p.policy_number,
  p.ramo,
  p.renewal_date,
  p.status                  AS policy_status,
  c.id                      AS client_id,
  c.name                    AS client_name,
  c.national_id             AS cedula,
  c.email                   AS client_email,
  c.phone                   AS client_phone,
  i.name                    AS insurer_name,
  pay.id                    AS payment_id,
  pay.amount                AS payment_amount,
  pay.payment_date,
  pay.status                AS payment_status,
  TRUE                      AS is_recurring,
  pay.recurrence_id,
  rec.status                AS recurrence_status,
  rec.next_due_date,
  rec.total_installments,
  rec.installment_amount,
  -- Count paid installments from the JSONB schedule array
  (SELECT count(*)::int
   FROM jsonb_array_elements(rec.schedule::jsonb) elem
   WHERE elem->>'status' = 'PAGADO'
  )                         AS paid_installments,
  -- morosidad_status: overdue if payment_date is >30 days past
  CASE
    WHEN pay.status IN ('PENDIENTE','PENDIENTE_CONFIRMACION','AGRUPADO')
         AND pay.payment_date::date < CURRENT_DATE - INTERVAL '30 days'
    THEN 'atrasado'
    WHEN pay.status IN ('PENDIENTE','PENDIENTE_CONFIRMACION','AGRUPADO')
    THEN 'al_dia'
    ELSE 'al_dia'
  END::text                 AS morosidad_status,
  -- days_overdue
  CASE
    WHEN pay.payment_date::date < CURRENT_DATE
    THEN (CURRENT_DATE - pay.payment_date::date)
    ELSE 0
  END                       AS days_overdue

FROM policies p
JOIN clients c ON c.id = p.client_id
LEFT JOIN insurers i ON i.id = p.insurer_id
JOIN adm_cot_payments pay ON pay.nro_poliza = p.policy_number
JOIN adm_cot_recurrences rec ON rec.id = pay.recurrence_id
WHERE
  -- Only our company's brokers
  p.broker_id IN (
    SELECT b.id FROM brokers b
    JOIN profiles pr ON pr.id = b.p_id
    WHERE pr.email = 'portal@lideresenseguros.com'
  )
  -- Only active recurrences
  AND rec.status = 'ACTIVA'
  -- Only pending/unconfirmed payments (not yet paid)
  AND pay.status IN ('PENDIENTE', 'PENDIENTE_CONFIRMACION', 'AGRUPADO')
  -- Exclude refunds
  AND COALESCE(pay.is_refund, false) = false

UNION ALL

-- ────────────────────────────────────────────
-- B) Al contado payments — only if NOT yet confirmed/paid
-- ────────────────────────────────────────────
SELECT
  p.id                      AS policy_id,
  p.policy_number,
  p.ramo,
  p.renewal_date,
  p.status                  AS policy_status,
  c.id                      AS client_id,
  c.name                    AS client_name,
  c.national_id             AS cedula,
  c.email                   AS client_email,
  c.phone                   AS client_phone,
  i.name                    AS insurer_name,
  pay.id                    AS payment_id,
  pay.amount                AS payment_amount,
  pay.payment_date,
  pay.status                AS payment_status,
  FALSE                     AS is_recurring,
  NULL::uuid                AS recurrence_id,
  NULL::text                AS recurrence_status,
  NULL::date                AS next_due_date,
  NULL::int                 AS total_installments,
  NULL::numeric(12,2)       AS installment_amount,
  0                         AS paid_installments,
  -- morosidad_status
  CASE
    WHEN pay.status IN ('PENDIENTE','PENDIENTE_CONFIRMACION','AGRUPADO')
         AND pay.payment_date::date < CURRENT_DATE - INTERVAL '30 days'
    THEN 'atrasado'
    WHEN pay.status IN ('PENDIENTE','PENDIENTE_CONFIRMACION','AGRUPADO')
    THEN 'al_dia'
    ELSE 'al_dia'
  END::text                 AS morosidad_status,
  CASE
    WHEN pay.payment_date::date < CURRENT_DATE
    THEN (CURRENT_DATE - pay.payment_date::date)
    ELSE 0
  END                       AS days_overdue

FROM policies p
JOIN clients c ON c.id = p.client_id
LEFT JOIN insurers i ON i.id = p.insurer_id
JOIN adm_cot_payments pay ON pay.nro_poliza = p.policy_number
WHERE
  -- Only our company's brokers
  p.broker_id IN (
    SELECT b.id FROM brokers b
    JOIN profiles pr ON pr.id = b.p_id
    WHERE pr.email = 'portal@lideresenseguros.com'
  )
  -- Al contado: no recurrence
  AND pay.recurrence_id IS NULL
  AND COALESCE(pay.is_recurring, false) = false
  -- Only pending/unconfirmed (already paid = saldo 0 = excluded)
  AND pay.status IN ('PENDIENTE', 'PENDIENTE_CONFIRMACION', 'AGRUPADO')
  -- Exclude refunds
  AND COALESCE(pay.is_refund, false) = false
;
