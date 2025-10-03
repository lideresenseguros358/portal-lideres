-- ========================================
-- ASSA: SOPORTE PARA 3 COLUMNAS DE COMISIÓN
-- ========================================
-- ASSA tiene 3 columnas de comisión que deben sumarse:
-- 1. Comisión general (columna principal)
-- 2. Vida 1er año
-- 3. Vida renovación
-- ========================================

-- Agregar campos para columnas adicionales en mapping rules
ALTER TABLE public.insurer_mapping_rules
ADD COLUMN IF NOT EXISTS commission_column_2_aliases JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS commission_column_3_aliases JSONB DEFAULT NULL;

COMMENT ON COLUMN public.insurer_mapping_rules.commission_column_2_aliases IS 
'Aliases para segunda columna de comisión (ASSA: Vida 1er año)';

COMMENT ON COLUMN public.insurer_mapping_rules.commission_column_3_aliases IS 
'Aliases para tercera columna de comisión (ASSA: Vida renovación)';

-- Agregar flag en insurers para identificar si usa múltiples columnas
ALTER TABLE public.insurers
ADD COLUMN IF NOT EXISTS use_multi_commission_columns BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.insurers.use_multi_commission_columns IS 
'Si true, el parser sumará las 3 columnas de comisión (específico para ASSA)';

-- Actualizar ASSA para usar múltiples columnas
UPDATE public.insurers
SET use_multi_commission_columns = true
WHERE LOWER(name) LIKE '%assa%';

-- ========================================
-- NOTA PARA CONFIGURACIÓN:
-- ========================================
-- Para ASSA, configurar en insurer_mapping_rules:
-- 
-- target_field = 'commission' 
-- aliases = ["Comisiones Generales", "Honorarios"]
--
-- commission_column_2_aliases = ["Vida 1er Año", "1er Año Vida"]
-- commission_column_3_aliases = ["Vida Renovación", "Renov Vida"]
-- ========================================
