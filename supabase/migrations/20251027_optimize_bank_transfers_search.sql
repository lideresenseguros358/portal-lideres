-- Optimización de búsqueda de referencias bancarias
-- Fecha: 2025-10-27
-- Objetivo: Hacer expedita la validación de referencias en el wizard de pagos

-- ====================================================================
-- 1. CREAR ÍNDICE EN reference_number
-- ====================================================================

-- Índice principal para búsquedas rápidas por número de referencia
CREATE INDEX IF NOT EXISTS idx_bank_transfers_reference_number 
ON public.bank_transfers(reference_number);

-- Comentario explicativo
COMMENT ON INDEX idx_bank_transfers_reference_number IS 
'Índice para optimizar búsquedas de referencias bancarias en wizard de pagos. Reduce tiempo de validación de segundos a milisegundos.';

-- ====================================================================
-- 2. ÍNDICE COMPUESTO PARA REFERENCIAS ACTIVAS
-- ====================================================================

-- Índice para buscar referencias con saldo disponible
CREATE INDEX IF NOT EXISTS idx_bank_transfers_reference_status 
ON public.bank_transfers(reference_number, status, remaining_amount) 
WHERE status != 'exhausted';

COMMENT ON INDEX idx_bank_transfers_reference_status IS 
'Índice compuesto para buscar referencias disponibles (no agotadas) más rápidamente. Usado en validación de pagos pendientes.';

-- ====================================================================
-- 3. ÍNDICE PARA FECHA (queries de reportes)
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_bank_transfers_date 
ON public.bank_transfers(date DESC);

COMMENT ON INDEX idx_bank_transfers_date IS 
'Índice para ordenar y filtrar transferencias por fecha en reportes e historial.';

-- ====================================================================
-- 4. ANÁLISIS DE RENDIMIENTO
-- ====================================================================

-- Actualizar estadísticas de la tabla para mejor planificación de queries
ANALYZE public.bank_transfers;

-- ====================================================================
-- FIN DE MIGRACIÓN
-- ====================================================================

-- Para verificar índices creados:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bank_transfers';

-- Para verificar rendimiento:
-- EXPLAIN ANALYZE SELECT * FROM bank_transfers WHERE reference_number = 'ABC123';
