-- ============================================================
-- CLEANUP: ALL Data from Operaciones & ADM COT Modules
-- WARNING: This will DELETE ALL data in these modules
-- The chat_threads module is NOT affected
-- Run in Supabase SQL Editor
-- ============================================================

-- ================== STATISTICS BEFORE CLEANUP ==================
-- Count data to be deleted
SELECT
  (SELECT COUNT(*) FROM ops_cases) as ops_cases_total,
  (SELECT COUNT(*) FROM adm_cot_conversations) as adm_cot_conversations_total,
  (SELECT COUNT(*) FROM adm_cot_quotes) as adm_cot_quotes_total,
  (SELECT COUNT(*) FROM ops_renewals) as ops_renewals_total,
  (SELECT COUNT(*) FROM ops_petitions) as ops_petitions_total,
  (SELECT COUNT(*) FROM ops_urgencies) as ops_urgencies_total,
  (SELECT COUNT(*) FROM ops_email_threads) as ops_email_threads_total;

-- ============================================================
-- 1. CLEANUP: ADM COT MODULE - DELETE ALL DATA
-- ============================================================

-- 1.1 Delete all conversations and related messages/tasks
DELETE FROM adm_cot_messages;
DELETE FROM adm_cot_tasks;
DELETE FROM adm_cot_conversations;

-- 1.2 Delete all quotes and related records
DELETE FROM adm_cot_payments;
DELETE FROM adm_cot_recurrences;
DELETE FROM adm_cot_expedientes;
DELETE FROM adm_cot_quotes;

-- 1.3 Delete all payment groups and bank history
DELETE FROM adm_cot_bank_history;
DELETE FROM adm_cot_payment_groups;

-- ============================================================
-- 2. CLEANUP: OPERACIONES MODULE - DELETE ALL DATA
-- ============================================================

-- 2.1 Delete all case history and activity logs
DELETE FROM ops_case_history;
DELETE FROM ops_activity_log WHERE entity_type = 'case';

-- 2.2 Delete all cases
DELETE FROM ops_cases;

-- 2.3 Delete all renewals (petitions for renewal)
DELETE FROM ops_renewals;

-- 2.4 Delete all petitions (COTIZADOR entries)
DELETE FROM ops_petitions;

-- 2.5 Delete all urgencies
DELETE FROM ops_urgencies;

-- 2.6 Delete all email threads and messages
DELETE FROM ops_email_messages;
DELETE FROM ops_email_threads;

-- ============================================================
-- NOTE: The following modules are NOT touched by this cleanup:
-- - chat_threads (ADM Chat Module - keep intact)
-- - cases (Trámites external module - keep intact)
-- - inbound_emails, email_logs, email_threads (external)
-- - portal_notifications (keep intact)
-- ============================================================

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

-- Verify cleanup results (should be 0 for Operaciones & ADM COT)
SELECT
  (SELECT COUNT(*) FROM ops_cases) as remaining_ops_cases,
  (SELECT COUNT(*) FROM ops_renewals) as remaining_ops_renewals,
  (SELECT COUNT(*) FROM ops_petitions) as remaining_ops_petitions,
  (SELECT COUNT(*) FROM ops_urgencies) as remaining_ops_urgencies,
  (SELECT COUNT(*) FROM ops_email_threads) as remaining_ops_email_threads,
  (SELECT COUNT(*) FROM adm_cot_conversations) as remaining_adm_cot_conversations,
  (SELECT COUNT(*) FROM adm_cot_quotes) as remaining_adm_cot_quotes,
  (SELECT COUNT(*) FROM adm_cot_expedientes) as remaining_adm_cot_expedientes,
  (SELECT COUNT(*) FROM adm_cot_payments) as remaining_adm_cot_payments;

-- Verify these modules are UNTOUCHED
SELECT
  'chat_threads (UNTOUCHED)' as table_name,
  COUNT(*) as count
FROM chat_threads
UNION ALL
SELECT
  'cases (UNTOUCHED)',
  COUNT(*)
FROM cases;
