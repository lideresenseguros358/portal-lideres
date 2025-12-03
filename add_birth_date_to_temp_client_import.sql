-- Agregar campo birth_date a la tabla temp_client_import
-- Fecha: 3 de diciembre, 2025

-- Verificar si la columna existe
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'temp_client_import'
ORDER BY ordinal_position;

-- Agregar columna birth_date si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'temp_client_import' 
        AND column_name = 'birth_date'
    ) THEN
        ALTER TABLE temp_client_import
        ADD COLUMN birth_date DATE;
        
        COMMENT ON COLUMN temp_client_import.birth_date IS 'Fecha de nacimiento del cliente';
    END IF;
END $$;

-- Verificar estructura actualizada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'temp_client_import'
ORDER BY ordinal_position;
