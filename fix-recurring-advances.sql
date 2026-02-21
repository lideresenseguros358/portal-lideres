-- ============================================================
-- FIX: Recurring advances with amount=0 after fortnight payment
-- Problem: actionPayFortnight set amount=0 for recurring advances
--          instead of resetting to the recurrence's original amount.
-- Solution: Reset all recurring advances with amount=0 to their
--           recurrence's original amount and set status=PENDING.
-- ============================================================

-- 1. DIAGNOSTIC: Show affected recurring advances
SELECT 
  a.id AS advance_id,
  a.amount AS current_amount,
  a.status AS current_status,
  a.reason,
  a.is_recurring,
  a.recurrence_id,
  ar.amount AS recurrence_amount,
  ar.is_active AS recurrence_active,
  ar.fortnight_type,
  b.name AS broker_name
FROM advances a
JOIN advance_recurrences ar ON a.recurrence_id = ar.id
JOIN brokers b ON a.broker_id = b.id
WHERE a.is_recurring = true
  AND a.recurrence_id IS NOT NULL
  AND a.amount = 0
ORDER BY b.name;

-- 2. FIX: Reset amount to recurrence amount and status to PENDING
-- Only for active recurrences
UPDATE advances a
SET 
  amount = ar.amount,
  status = 'PENDING'
FROM advance_recurrences ar
WHERE a.recurrence_id = ar.id
  AND a.is_recurring = true
  AND a.amount = 0
  AND ar.is_active = true;

-- 3. Also fix any recurring advances with status='PAID' that should still be active
UPDATE advances a
SET 
  amount = ar.amount,
  status = 'PENDING'
FROM advance_recurrences ar
WHERE a.recurrence_id = ar.id
  AND a.is_recurring = true
  AND a.status IN ('PAID', 'paid')
  AND ar.is_active = true;

-- 4. VERIFY: Check the fix
SELECT 
  a.id AS advance_id,
  a.amount AS new_amount,
  a.status AS new_status,
  a.reason,
  ar.amount AS recurrence_amount,
  ar.fortnight_type,
  b.name AS broker_name
FROM advances a
JOIN advance_recurrences ar ON a.recurrence_id = ar.id
JOIN brokers b ON a.broker_id = b.id
WHERE a.is_recurring = true
  AND a.recurrence_id IS NOT NULL
ORDER BY b.name;
