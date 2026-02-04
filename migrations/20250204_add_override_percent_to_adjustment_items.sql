-- Agregar campo override_percent a adjustment_report_items
-- Este campo almacena el porcentaje override que el master configuró para cada item
ALTER TABLE adjustment_report_items
ADD COLUMN IF NOT EXISTS override_percent DECIMAL(5, 4) DEFAULT NULL;

COMMENT ON COLUMN adjustment_report_items.override_percent IS 'Porcentaje override específico configurado por master (0.0 a 1.0). Si es NULL, se usó el percent_default del broker';

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_adjustment_report_items_override ON adjustment_report_items(override_percent) WHERE override_percent IS NOT NULL;
