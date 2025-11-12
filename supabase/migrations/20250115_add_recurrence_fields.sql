-- Agregar campos para adelantos recurrentes mejorados
-- Fecha: 2025-01-15
-- Descripción: Permite especificar quincena, fecha de vencimiento y marca en advances

-- 1. Agregar campos a advance_recurrences
ALTER TABLE advance_recurrences
ADD COLUMN IF NOT EXISTS fortnight_type TEXT CHECK (fortnight_type IN ('Q1', 'Q2')) DEFAULT 'Q1',
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS recurrence_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_generated_at TIMESTAMP WITH TIME ZONE;

-- 2. Agregar comentarios
COMMENT ON COLUMN advance_recurrences.fortnight_type IS 'Q1 = Primera quincena (1-15), Q2 = Segunda quincena (16-fin mes)';
COMMENT ON COLUMN advance_recurrences.end_date IS 'Fecha de vencimiento de la recurrencia. NULL = infinita';
COMMENT ON COLUMN advance_recurrences.recurrence_count IS 'Número de veces que se ha generado este adelanto automáticamente';
COMMENT ON COLUMN advance_recurrences.last_generated_at IS 'Última vez que se generó un adelanto desde esta recurrencia';

-- 3. Agregar campo en advances para marcar si proviene de recurrencia
ALTER TABLE advances
ADD COLUMN IF NOT EXISTS recurrence_id UUID REFERENCES advance_recurrences(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- 4. Agregar índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_advances_recurrence_id ON advances(recurrence_id);
CREATE INDEX IF NOT EXISTS idx_advances_is_recurring ON advances(is_recurring);
CREATE INDEX IF NOT EXISTS idx_advance_recurrences_is_active ON advance_recurrences(is_active);
CREATE INDEX IF NOT EXISTS idx_advance_recurrences_end_date ON advance_recurrences(end_date);

-- 5. Actualizar advances existentes sin recurrence_id
UPDATE advances
SET is_recurring = FALSE
WHERE is_recurring IS NULL;

-- 6. Comentarios en nuevas columnas de advances
COMMENT ON COLUMN advances.recurrence_id IS 'ID de la recurrencia que generó este adelanto (si aplica)';
COMMENT ON COLUMN advances.is_recurring IS 'Indica si este adelanto fue generado automáticamente desde una recurrencia';
