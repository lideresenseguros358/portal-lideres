-- FIX CRÍTICO: ELIMINAR constraint UNIQUE de draft_unidentified_items
-- PROBLEMA: Constraint UNIQUE bloquea duplicados legítimos del reporte Excel
-- EJEMPLO: Si un cliente aparece 3 veces en el Excel con mismo monto, DEBEN guardarse las 3
-- SOLUCIÓN: ELIMINAR constraint UNIQUE completamente - deduplicación SOLO en código por raw_row

-- 1. Eliminar constraint UNIQUE (causa del problema)
ALTER TABLE draft_unidentified_items 
DROP CONSTRAINT IF EXISTS unique_draft_item;

-- 2. NO crear ningún constraint nuevo - permitir duplicados del reporte

-- Verificación (debe retornar 0 filas)
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'draft_unidentified_items'
  AND constraint_type = 'UNIQUE';

COMMENT ON TABLE draft_unidentified_items IS 
'Zona de trabajo temporal para clientes sin identificar.
IMPORTANTE: NO tiene constraint UNIQUE - permite duplicados legítimos del reporte Excel.
Deduplicación se maneja en código usando raw_row para detectar parseos duplicados del sistema.';
