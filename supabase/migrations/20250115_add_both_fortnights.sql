-- Agregar opción de AMBAS quincenas para adelantos recurrentes
-- Fecha: 2025-01-15
-- Descripción: Permite que un adelanto recurrente se aplique tanto en Q1 como en Q2

-- 1. Eliminar el constraint anterior
ALTER TABLE advance_recurrences
DROP CONSTRAINT IF EXISTS advance_recurrences_fortnight_type_check;

-- 2. Agregar nuevo constraint con la opción BOTH
ALTER TABLE advance_recurrences
ADD CONSTRAINT advance_recurrences_fortnight_type_check 
CHECK (fortnight_type IN ('Q1', 'Q2', 'BOTH'));

-- 3. Actualizar comentario
COMMENT ON COLUMN advance_recurrences.fortnight_type IS 'Q1 = Primera quincena (1-15), Q2 = Segunda quincena (16-fin mes), BOTH = Ambas quincenas';
