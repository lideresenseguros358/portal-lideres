-- ============================================================
-- MIGRATION: LISSA DYNAMIC MEMORY
-- Run in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS lissa_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text NOT NULL CHECK (type IN ('aprender', 'error', 'regla')),
  content     text NOT NULL,
  created_by  text,          -- phone number or identifier of who created it
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lissa_memory_active ON lissa_memory(is_active, type);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_lissa_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lissa_memory_updated_at ON lissa_memory;
CREATE TRIGGER trg_lissa_memory_updated_at
  BEFORE UPDATE ON lissa_memory
  FOR EACH ROW EXECUTE FUNCTION update_lissa_memory_updated_at();

-- RLS
ALTER TABLE lissa_memory ENABLE ROW LEVEL SECURITY;

-- Masters can read/write
CREATE POLICY "masters_lissa_memory" ON lissa_memory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master')
  );

-- Service role bypass (API routes)
CREATE POLICY "service_role_lissa_memory" ON lissa_memory
  FOR ALL USING (auth.role() = 'service_role');
