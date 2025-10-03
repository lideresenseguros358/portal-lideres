-- =====================================================
-- MIGRATION: Add is_life_insurance flag to comm_imports
-- Date: 2025-10-03
-- Purpose: Track if an ASSA import is "Vida" type for separate totals
-- =====================================================

-- Add flag to comm_imports
ALTER TABLE public.comm_imports
ADD COLUMN IF NOT EXISTS is_life_insurance BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.comm_imports.is_life_insurance IS 
'ASSA only: True if this import is for Vida insurance (separate totals in reports)';

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_comm_imports_is_life 
ON public.comm_imports(is_life_insurance);

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check column exists:
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'comm_imports' AND column_name = 'is_life_insurance';
