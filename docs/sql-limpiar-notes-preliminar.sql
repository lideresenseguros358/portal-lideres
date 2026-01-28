-- Limpiar campo notes en tabla temp_client_import
-- Ejecutar en Supabase SQL Editor

UPDATE temp_client_import
SET notes = NULL
WHERE notes IS NOT NULL;

-- Verificar que se limpiaron
SELECT id, client_name, notes
FROM temp_client_import
WHERE notes IS NOT NULL;
