-- =====================================================
-- AÑADIR COLUMNAS PARA MEJORAS DE PRODUCCIÓN
-- =====================================================
-- Fecha: 2025-10-04
-- Descripción: Agregar número de pólizas por mes y meta personal por broker
-- =====================================================

-- 1. Agregar columna de número de pólizas a la tabla production
-- Esta columna guardará cuántas pólizas se vendieron en ese mes
ALTER TABLE public.production
ADD COLUMN IF NOT EXISTS num_polizas INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.production.num_polizas IS 'Número de pólizas vendidas en ese mes';

-- 2. Agregar columna de meta personal a la tabla brokers
-- Esta es la meta anual individual de cada corredor (independiente de concursos)
ALTER TABLE public.brokers
ADD COLUMN IF NOT EXISTS meta_personal NUMERIC(12, 2) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.brokers.meta_personal IS 'Meta anual personal del corredor (independiente de concursos)';

-- 3. Crear índice para mejorar performance en consultas por broker y año
CREATE INDEX IF NOT EXISTS idx_production_broker_year_month 
ON public.production(broker_id, year, month);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Puedes ejecutar esto para verificar que las columnas se agregaron correctamente:

-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'production'
--   AND column_name = 'num_polizas';

-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'brokers'
--   AND column_name = 'meta_personal';

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
-- 1. num_polizas: Se guardará por cada registro de production (broker + año + mes)
-- 2. meta_personal: Se guarda una vez por broker (meta anual)
-- 3. Ambas columnas tienen valor por defecto 0 para no romper datos existentes
-- 4. El índice mejorará las consultas de producción por broker/año/mes
-- =====================================================
