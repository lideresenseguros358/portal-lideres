-- ============================================================
-- ADM COT — Add abandonment_email_sent_at to adm_cot_quotes
-- Tracks when the abandonment recovery email was sent so the
-- cron job doesn't re-send to the same quote.
-- Created: 2026-02-25
-- ============================================================

ALTER TABLE adm_cot_quotes
  ADD COLUMN IF NOT EXISTS abandonment_email_sent_at TIMESTAMPTZ;

-- Index for the cron query: abandoned + no email sent + recent
CREATE INDEX IF NOT EXISTS idx_adm_cot_quotes_abandonment_email
  ON adm_cot_quotes(status, abandonment_email_sent_at)
  WHERE status = 'ABANDONADA' AND abandonment_email_sent_at IS NULL;
