-- Migration: Add 'persistencia' column to production table
-- Date: 2025-11-13
-- Description: Adds a numeric column 'persistencia' (percentage) to track monthly persistency rate for each broker's production

-- Add persistencia column to production table (percentage: 0-100)
ALTER TABLE production
ADD COLUMN IF NOT EXISTS persistencia NUMERIC(5,2) DEFAULT NULL;

-- Add comment to the column
COMMENT ON COLUMN production.persistencia IS 'Persistencia mensual en porcentaje (0-100). Indica el porcentaje de retención de clientes/pólizas para el mes y corredor. Campo manual ingresado por Master.';

-- Add check constraint to ensure persistencia is between 0 and 100
ALTER TABLE production
ADD CONSTRAINT check_persistencia_range 
CHECK (persistencia IS NULL OR (persistencia >= 0 AND persistencia <= 100));

-- Create index for persistencia queries (optional, for analytics performance)
CREATE INDEX IF NOT EXISTS idx_production_persistencia ON production(persistencia) WHERE persistencia IS NOT NULL;

-- Grant permissions (ensure existing RLS policies cover this new column)
-- The existing RLS policies for production table should automatically apply to this column

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added persistencia column to production table with range validation (0-100)';
END $$;
