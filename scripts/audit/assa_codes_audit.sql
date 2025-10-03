-- Audit script for insurer_assa_codes and related data consistency
-- Usage: run inside Supabase SQL editor or psql. Reports multiple diagnostics.

\echo '=== AUDIT: insurer_assa_codes ==='

-- Summary per insurer
SELECT
  i.id AS insurer_id,
  i.name AS insurer_name,
  COUNT(c.id) AS codes_total,
  SUM(CASE WHEN c.active THEN 1 ELSE 0 END) AS active_codes,
  SUM(CASE WHEN c.active IS FALSE THEN 1 ELSE 0 END) AS inactive_codes
FROM public.insurers i
LEFT JOIN public.insurer_assa_codes c
  ON c.insurer_id = i.id
GROUP BY i.id, i.name
ORDER BY i.name;

\echo '\n=== AUDIT: code vs code_norm mismatch (should never happen) ==='
SELECT id, insurer_id, code, code_norm
FROM public.insurer_assa_codes
WHERE code IS DISTINCT FROM code_norm;

\echo '\n=== AUDIT: duplicate code_norm per insurer ==='
SELECT insurer_id, code_norm, COUNT(*) AS occurrences
FROM public.insurer_assa_codes
GROUP BY insurer_id, code_norm
HAVING COUNT(*) > 1
ORDER BY occurrences DESC;

\echo '\n=== AUDIT: invalid code format (expected PJ750-<n>) ==='
SELECT id, insurer_id, code, code_norm
FROM public.insurer_assa_codes
WHERE code_norm !~ '^PJ750-[1-9][0-9]*$';

\echo '\n=== AUDIT: zero-leading numbers in code ==='
SELECT id, insurer_id, code, code_norm
FROM public.insurer_assa_codes
WHERE code_norm ~ '^PJ750-0+';

\echo '\n=== AUDIT: orphan foreign keys (insurer_id / broker_id) ==='
SELECT c.id, c.insurer_id, c.broker_id
FROM public.insurer_assa_codes c
LEFT JOIN public.insurers i ON i.id = c.insurer_id
LEFT JOIN public.brokers b ON b.id = c.broker_id
WHERE i.id IS NULL OR (c.broker_id IS NOT NULL AND b.id IS NULL);

\echo '\n=== AUDIT: null critical columns ==='
SELECT id, insurer_id, code, broker_id, active
FROM public.insurer_assa_codes
WHERE insurer_id IS NULL OR code IS NULL OR active IS NULL;

\echo '\n=== AUDIT: problematic ASSA codes (PJ750-54, PJ750-4, PJ750-28) ==='
SELECT *
FROM public.insurer_assa_codes
WHERE code_norm IN ('PJ750-54', 'PJ750-4', 'PJ750-28');

\echo '\n=== AUDIT COMPLETE ==='
