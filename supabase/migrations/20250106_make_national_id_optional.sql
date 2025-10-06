-- Hacer que national_id sea opcional (nullable) en las tablas clients y temp_client_imports

-- Tabla clients: Cambiar national_id a nullable
ALTER TABLE clients ALTER COLUMN national_id DROP NOT NULL;

-- Tabla temp_client_imports: Cambiar national_id a nullable
ALTER TABLE temp_client_imports ALTER COLUMN national_id DROP NOT NULL;

-- Agregar comentarios para documentar
COMMENT ON COLUMN clients.national_id IS 'Cédula, pasaporte o RUC del cliente - Campo opcional';
COMMENT ON COLUMN temp_client_imports.national_id IS 'Cédula, pasaporte o RUC del cliente - Campo opcional';

-- Actualizar índice único en clients (si existe) para permitir múltiples NULL
-- Primero eliminar el índice único si existe
DROP INDEX IF EXISTS clients_national_id_key;

-- Crear un índice único parcial que solo aplica cuando national_id NO es NULL
CREATE UNIQUE INDEX clients_national_id_unique_idx 
ON clients (national_id) 
WHERE national_id IS NOT NULL;

-- Lo mismo para temp_client_imports
DROP INDEX IF EXISTS temp_client_imports_national_id_key;

CREATE UNIQUE INDEX temp_client_imports_national_id_unique_idx 
ON temp_client_imports (national_id) 
WHERE national_id IS NOT NULL;
