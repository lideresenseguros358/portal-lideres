-- Agregar campo birth_date a la tabla clients
-- Fecha: 3 de diciembre, 2025

-- Agregar columna birth_date (fecha de nacimiento)
ALTER TABLE clients
ADD COLUMN birth_date DATE;

-- Comentario para documentar el campo
COMMENT ON COLUMN clients.birth_date IS 'Fecha de nacimiento del cliente';

-- Ver estructura actualizada
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'clients'
ORDER BY ordinal_position;

-- Ver algunos registros de ejemplo
SELECT id, name, national_id, birth_date, email, phone
FROM clients
LIMIT 5;
