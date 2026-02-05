-- FIX CRÍTICO: Constraint UNIQUE en draft_unidentified_items está perdiendo transacciones
-- PROBLEMA: Si un cliente tiene múltiples transacciones con montos diferentes, solo se guarda UNA
-- SOLUCIÓN: Agregar commission_raw al constraint para diferenciar transacciones múltiples

-- 1. Eliminar constraint viejo
ALTER TABLE draft_unidentified_items 
DROP CONSTRAINT IF EXISTS unique_draft_item;

-- 2. Crear constraint correcto que incluye commission_raw
ALTER TABLE draft_unidentified_items
ADD CONSTRAINT unique_draft_item 
UNIQUE(fortnight_id, import_id, policy_number, insured_name, commission_raw);

-- Verificación
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'draft_unidentified_items'
  AND constraint_type = 'UNIQUE';

COMMENT ON CONSTRAINT unique_draft_item ON draft_unidentified_items IS 
'Permite múltiples transacciones del mismo cliente con montos diferentes. 
Solo duplicados EXACTOS (mismo monto) se consideran duplicados reales.';
