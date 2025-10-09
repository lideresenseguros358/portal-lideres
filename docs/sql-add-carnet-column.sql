-- =====================================================
-- AGREGAR COLUMNA CARNET A TABLA BROKERS
-- =====================================================
-- Ejecutar en SQL Editor de Supabase

-- Agregar columna carnet_expiry_date
ALTER TABLE brokers
ADD COLUMN IF NOT EXISTS carnet_expiry_date DATE NULL;

-- Agregar comentario a la columna
COMMENT ON COLUMN brokers.carnet_expiry_date IS 'Fecha de vencimiento del carnet del corredor. Se enviará recordatorio 60 días antes del vencimiento.';

-- Verificar que la columna fue agregada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'brokers' AND column_name = 'carnet_expiry_date';
