-- Migration: Add 'notas' column to policies table
-- Date: 2025-10-29
-- Description: Adds a text column 'notas' to allow brokers to add custom notes about each policy

-- Add notas column to policies table
ALTER TABLE policies
ADD COLUMN IF NOT EXISTS notas TEXT;

-- Add comment to the column
COMMENT ON COLUMN policies.notas IS 'Notas adicionales del corredor sobre la póliza. Información personalizada que el corredor desea recordar sobre esta póliza del cliente.';

-- Create index for text search on notas (optional, for better search performance)
CREATE INDEX IF NOT EXISTS idx_policies_notas_search ON policies USING gin(to_tsvector('spanish', COALESCE(notas, '')));

-- Grant permissions (ensure RLS policies allow brokers to update their own policies)
-- The existing RLS policies should already cover this, but we verify the column is accessible

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added notas column to policies table';
END $$;
