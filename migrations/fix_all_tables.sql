-- =====================================================
-- MIGRATION: Fix all tables for Commissions and Checks
-- Date: 2025-10-02
-- =====================================================

-- =====================================================
-- 1. COMMISSIONS: Add total_amount to comm_imports
-- =====================================================
-- This stores the user-entered total from the import form
ALTER TABLE comm_imports 
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN comm_imports.total_amount IS 'User-entered total amount from import form (not calculated from items)';

-- =====================================================
-- 2. COMMISSIONS: Add invert_negatives to insurers
-- =====================================================
-- This stores whether to invert negative amounts for this insurer
ALTER TABLE insurers 
ADD COLUMN IF NOT EXISTS invert_negatives BOOLEAN DEFAULT false;

COMMENT ON COLUMN insurers.invert_negatives IS 'Whether to multiply commission amounts by -1 when importing';

-- =====================================================
-- 3. CHECKS: Create bank_history table
-- =====================================================
-- This table stores imported bank transaction history
CREATE TABLE IF NOT EXISTS bank_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  transaction_date DATE NOT NULL,
  description TEXT,
  reference VARCHAR(100),
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  raw_data JSONB,
  matched_check_item_id UUID REFERENCES check_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_history_transaction_date ON bank_history(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_history_reference ON bank_history(reference);
CREATE INDEX IF NOT EXISTS idx_bank_history_matched_check ON bank_history(matched_check_item_id);

COMMENT ON TABLE bank_history IS 'Imported bank transaction history for check reconciliation';
COMMENT ON COLUMN bank_history.matched_check_item_id IS 'Links to check_items table when transaction is matched';

-- =====================================================
-- 4. CHECKS: Add bank reconciliation columns to check_items
-- =====================================================
ALTER TABLE check_items 
ADD COLUMN IF NOT EXISTS bank_matched_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bank_history_id UUID REFERENCES bank_history(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_check_items_bank_history ON check_items(bank_history_id);

COMMENT ON COLUMN check_items.bank_matched_at IS 'When this check was matched with bank history';
COMMENT ON COLUMN check_items.bank_history_id IS 'Link to bank_history record if matched';

-- =====================================================
-- 5. COMMISSIONS: Ensure proper cascading deletes
-- =====================================================
-- When an import is deleted, all its items should be deleted too
ALTER TABLE comm_items 
DROP CONSTRAINT IF EXISTS comm_items_import_id_fkey,
ADD CONSTRAINT comm_items_import_id_fkey 
  FOREIGN KEY (import_id) 
  REFERENCES comm_imports(id) 
  ON DELETE CASCADE;

-- =====================================================
-- 6. Update RLS policies if needed
-- =====================================================
-- Enable RLS on bank_history
ALTER TABLE bank_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Masters can view bank history" ON bank_history;
DROP POLICY IF EXISTS "Masters can insert bank history" ON bank_history;
DROP POLICY IF EXISTS "Masters can update bank history" ON bank_history;
DROP POLICY IF EXISTS "Masters can delete bank history" ON bank_history;

-- Policy: Only Masters can view bank history
CREATE POLICY "Masters can view bank history"
  ON bank_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'master'
    )
  );

-- Policy: Only Masters can insert bank history
CREATE POLICY "Masters can insert bank history"
  ON bank_history FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'master'
    )
  );

-- Policy: Only Masters can update bank history
CREATE POLICY "Masters can update bank history"
  ON bank_history FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'master'
    )
  );

-- Policy: Only Masters can delete bank history
CREATE POLICY "Masters can delete bank history"
  ON bank_history FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'master'
    )
  );

-- =====================================================
-- 7. Create helper function to update timestamps
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to bank_history
DROP TRIGGER IF EXISTS update_bank_history_updated_at ON bank_history;
CREATE TRIGGER update_bank_history_updated_at
  BEFORE UPDATE ON bank_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. COMMISSIONS: Add metadata table for flexible storage
-- =====================================================
CREATE TABLE IF NOT EXISTS comm_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES comm_imports(id) ON DELETE CASCADE,
  fortnight_id UUID REFERENCES fortnights(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comm_metadata_import ON comm_metadata(import_id);
CREATE INDEX IF NOT EXISTS idx_comm_metadata_fortnight ON comm_metadata(import_id);
CREATE INDEX IF NOT EXISTS idx_comm_metadata_key ON comm_metadata(key);

COMMENT ON TABLE comm_metadata IS 'Flexible key-value storage for commission-related metadata';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify the changes:

-- Check comm_imports has total_amount
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'comm_imports' AND column_name = 'total_amount';

-- Check insurers has invert_negatives
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'insurers' AND column_name = 'invert_negatives';

-- Check bank_history table exists
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name = 'bank_history';

-- Check check_items has bank reconciliation columns
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'check_items' AND column_name IN ('bank_matched_at', 'bank_history_id');
