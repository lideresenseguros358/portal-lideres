-- ============================================================
-- CLEANUP: Test Data from Operaciones & ADM COT Modules
-- Run in Supabase SQL Editor
-- ============================================================

-- ================== STATISTICS BEFORE CLEANUP ==================
-- Count test data
SELECT
  (SELECT COUNT(*) FROM ops_cases WHERE created_at > NOW() - INTERVAL '7 days') as ops_cases_recent,
  (SELECT COUNT(*) FROM adm_cot_conversations WHERE created_at > NOW() - INTERVAL '7 days') as adm_cot_conversations_recent,
  (SELECT COUNT(*) FROM adm_cot_quotes WHERE quoted_at > NOW() - INTERVAL '7 days') as adm_cot_quotes_recent,
  (SELECT COUNT(*) FROM chat_threads WHERE created_at > NOW() - INTERVAL '7 days') as chat_threads_recent;

-- ============================================================
-- 1. CLEANUP: ADM COT MODULE
-- ============================================================

-- 1.1 Delete test conversations and related data
-- (Chat conversations created in last 7 days are assumed to be test data)
DELETE FROM adm_cot_messages
WHERE conversation_id IN (
  SELECT id FROM adm_cot_conversations
  WHERE created_at > NOW() - INTERVAL '7 days'
    OR metadata->>'is_test' = 'true'
    OR client_name ILIKE '%TEST%'
);

DELETE FROM adm_cot_tasks
WHERE conversation_id IN (
  SELECT id FROM adm_cot_conversations
  WHERE created_at > NOW() - INTERVAL '7 days'
    OR metadata->>'is_test' = 'true'
    OR client_name ILIKE '%TEST%'
);

DELETE FROM adm_cot_conversations
WHERE created_at > NOW() - INTERVAL '7 days'
  OR metadata->>'is_test' = 'true'
  OR client_name ILIKE '%TEST%';

-- 1.2 Delete test quotes and related records
DELETE FROM adm_cot_payments
WHERE quote_id IN (
  SELECT id FROM adm_cot_quotes
  WHERE quoted_at > NOW() - INTERVAL '7 days'
    OR status = 'ABANDONADA'
    OR client_name ILIKE '%TEST%'
    OR cedula ILIKE '%999%'
);

DELETE FROM adm_cot_recurrences
WHERE quote_id IN (
  SELECT id FROM adm_cot_quotes
  WHERE quoted_at > NOW() - INTERVAL '7 days'
    OR status = 'ABANDONADA'
    OR client_name ILIKE '%TEST%'
    OR cedula ILIKE '%999%'
);

DELETE FROM adm_cot_expedientes
WHERE quote_id IN (
  SELECT id FROM adm_cot_quotes
  WHERE quoted_at > NOW() - INTERVAL '7 days'
    OR status = 'ABANDONADA'
    OR client_name ILIKE '%TEST%'
    OR cedula ILIKE '%999%'
);

DELETE FROM adm_cot_quotes
WHERE quoted_at > NOW() - INTERVAL '7 days'
  OR status = 'ABANDONADA'
  OR client_name ILIKE '%TEST%'
  OR cedula ILIKE '%999%';

-- 1.3 Delete orphaned payment groups (groups with no payments)
DELETE FROM adm_cot_payment_groups
WHERE id NOT IN (
  SELECT DISTINCT group_id FROM adm_cot_payments WHERE group_id IS NOT NULL
);

-- 1.4 Delete orphaned bank history (history with no groups)
DELETE FROM adm_cot_bank_history
WHERE group_id NOT IN (
  SELECT DISTINCT id FROM adm_cot_payment_groups
);

-- ============================================================
-- 2. CLEANUP: OPERACIONES MODULE
-- ============================================================

-- 2.1 Delete test cases and related data
-- Delete case history
DELETE FROM ops_case_history
WHERE case_id IN (
  SELECT id FROM ops_cases
  WHERE created_at > NOW() - INTERVAL '7 days'
    OR ticket ILIKE 'TEST-%'
    OR metadata->>'is_test' = 'true'
);

-- Delete activity logs for test cases
DELETE FROM ops_activity_log
WHERE entity_id IN (
  SELECT id FROM ops_cases
  WHERE created_at > NOW() - INTERVAL '7 days'
    OR ticket ILIKE 'TEST-%'
    OR metadata->>'is_test' = 'true'
)
AND entity_type = 'case';

-- Delete test cases
DELETE FROM ops_cases
WHERE created_at > NOW() - INTERVAL '7 days'
  OR ticket ILIKE 'TEST-%'
  OR metadata->>'is_test' = 'true';

-- 2.2 Delete test renewals (petitions for renewal)
DELETE FROM ops_renewals
WHERE created_at > NOW() - INTERVAL '7 days'
  OR ticket_number ILIKE 'TEST-%'
  OR status = 'pendiente'; -- Unprocessed test renewals

-- 2.3 Delete test petitions (COTIZADOR entries)
DELETE FROM ops_petitions
WHERE created_at > NOW() - INTERVAL '7 days'
  OR ticket_number ILIKE 'TEST-%'
  OR client_email ILIKE '%test%';

-- 2.4 Delete test urgencies
DELETE FROM ops_urgencies
WHERE created_at > NOW() - INTERVAL '7 days'
  OR client_name ILIKE '%TEST%'
  OR chat_thread_id IN (
    SELECT id FROM chat_threads
    WHERE created_at > NOW() - INTERVAL '7 days'
      OR metadata->>'is_test' = 'true'
  );

-- 2.5 Delete test email threads and messages
DELETE FROM ops_email_messages
WHERE thread_id IN (
  SELECT id FROM ops_email_threads
  WHERE created_at > NOW() - INTERVAL '7 days'
    OR ticket_id ILIKE 'TEST-%'
    OR subject ILIKE '%TEST%'
);

DELETE FROM ops_email_threads
WHERE created_at > NOW() - INTERVAL '7 days'
  OR ticket_id ILIKE 'TEST-%'
  OR subject ILIKE '%TEST%';

-- ============================================================
-- 3. CLEANUP: LEGACY CHAT MODULE
-- ============================================================

-- 3.1 Delete test chat threads and related data
DELETE FROM chat_events
WHERE thread_id IN (
  SELECT id FROM chat_threads
  WHERE created_at > NOW() - INTERVAL '7 days'
    OR metadata->>'is_test' = 'true'
    OR client_name ILIKE '%TEST%'
    OR phone_e164 ILIKE '%999999%'
);

DELETE FROM chat_messages
WHERE thread_id IN (
  SELECT id FROM chat_threads
  WHERE created_at > NOW() - INTERVAL '7 days'
    OR metadata->>'is_test' = 'true'
    OR client_name ILIKE '%TEST%'
    OR phone_e164 ILIKE '%999999%'
);

DELETE FROM portal_notifications
WHERE link ILIKE '%TEST%'
  OR body ILIKE '%TEST%';

DELETE FROM chat_threads
WHERE created_at > NOW() - INTERVAL '7 days'
  OR metadata->>'is_test' = 'true'
  OR client_name ILIKE '%TEST%'
  OR phone_e164 ILIKE '%999999%';

-- ============================================================
-- 4. CLEANUP: CORE MODULE (Generic test data)
-- ============================================================

-- 4.1 Delete test cases (legacy table)
DELETE FROM cases
WHERE is_test = true
  OR ticket ILIKE 'TEST-%'
  OR notes ILIKE '%TEST-%'
  OR created_at > NOW() - INTERVAL '7 days';

-- 4.2 Delete test emails
DELETE FROM inbound_emails
WHERE is_test = true
  OR subject ILIKE '%TEST%'
  OR from_address ILIKE '%test%'
  OR created_at > NOW() - INTERVAL '7 days';

DELETE FROM email_logs
WHERE is_test = true
  OR subject ILIKE '%TEST%'
  OR created_at > NOW() - INTERVAL '7 days';

-- 4.3 Delete orphaned case files and comments
DELETE FROM case_files
WHERE case_id NOT IN (
  SELECT DISTINCT id FROM cases
);

DELETE FROM case_comments
WHERE case_id NOT IN (
  SELECT DISTINCT id FROM cases
);

-- ============================================================
-- 5. CLEANUP: AUDIT & ACTIVITY LOGS (Optional - keep last 30 days)
-- ============================================================

-- Only delete very old audit logs (older than 30 days)
DELETE FROM ops_audit_log
WHERE created_at < NOW() - INTERVAL '30 days'
  AND event_type IN ('CREATE', 'UPDATE', 'DELETE')
  AND entity_type IN ('case', 'email', 'task');

-- ============================================================
-- FINAL STATISTICS
-- ============================================================
-- Verify cleanup results
SELECT
  (SELECT COUNT(*) FROM ops_cases) as remaining_ops_cases,
  (SELECT COUNT(*) FROM adm_cot_conversations) as remaining_adm_cot_conversations,
  (SELECT COUNT(*) FROM adm_cot_quotes) as remaining_adm_cot_quotes,
  (SELECT COUNT(*) FROM chat_threads) as remaining_chat_threads,
  (SELECT COUNT(*) FROM cases) as remaining_legacy_cases;

-- Show any remaining test data (should be 0)
SELECT
  'ops_cases' as table_name,
  COUNT(*) as count
FROM ops_cases
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'adm_cot_conversations',
  COUNT(*)
FROM adm_cot_conversations
WHERE created_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'adm_cot_quotes',
  COUNT(*)
FROM adm_cot_quotes
WHERE quoted_at > NOW() - INTERVAL '7 days'
UNION ALL
SELECT
  'chat_threads',
  COUNT(*)
FROM chat_threads
WHERE created_at > NOW() - INTERVAL '7 days';
