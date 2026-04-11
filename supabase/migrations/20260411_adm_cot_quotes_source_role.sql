-- Add source_role to adm_cot_quotes to distinguish public vs broker/master sessions.
-- Default 'publico' so ALL existing rows are treated as public-user quotes.
-- Broker/master inserts are skipped at the application layer (track route),
-- so this column only ever stores 'publico' in practice.

ALTER TABLE adm_cot_quotes
  ADD COLUMN IF NOT EXISTS source_role TEXT NOT NULL DEFAULT 'publico';

-- Index for fast filtering in the cotizaciones log and dashboard metrics queries
CREATE INDEX IF NOT EXISTS adm_cot_quotes_source_role_idx
  ON adm_cot_quotes (source_role);
