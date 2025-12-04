-- ============================================================================
-- CORRECCIÓN CRÍTICA: RLS para fortnight_details con código ASSA
-- PROBLEMA: Los brokers NO veían sus comisiones por código ASSA
-- SOLUCIÓN: Actualizar política RLS para incluir assa_code
-- ============================================================================

-- 1. Eliminar política antigua que solo filtraba por broker_id
DROP POLICY IF EXISTS "Broker solo ve sus propios detalles" ON fortnight_details;

-- 2. Crear nueva política que incluya broker_id Y assa_code
CREATE POLICY "Broker ve sus detalles por broker_id o assa_code"
ON fortnight_details
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM brokers
    WHERE brokers.p_id = auth.uid()
    AND (
      -- Caso 1: Comisiones directas por broker_id
      brokers.id = fortnight_details.broker_id
      OR
      -- Caso 2: Comisiones por código ASSA (para agentes)
      (
        fortnight_details.is_assa_code = TRUE
        AND brokers.assa_code IS NOT NULL
        AND brokers.assa_code = fortnight_details.assa_code
      )
    )
  )
);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- 1. Como broker con código ASSA, verificar que puedes ver tus registros:
-- SELECT * FROM fortnight_details WHERE is_assa_code = TRUE;

-- 2. Como broker sin código ASSA, verificar que ves tus registros normales:
-- SELECT * FROM fortnight_details WHERE broker_id = 'tu_broker_id';

-- 3. Verificar que Master sigue viendo todo:
-- SELECT COUNT(*) FROM fortnight_details;

-- ============================================================================
-- EJECUCIÓN
-- ============================================================================
-- 1. Copiar este SQL completo
-- 2. Ejecutar en Supabase SQL Editor
-- 3. Verificar que brokers ven sus códigos ASSA en el historial de quincenas
-- 4. Verificar que totales en "Acumulado" ahora incluyen códigos ASSA
-- ============================================================================

COMMENT ON POLICY "Broker ve sus detalles por broker_id o assa_code" ON fortnight_details IS 
'Permite a brokers ver sus comisiones tanto por broker_id directo como por código ASSA. 
Crítico para agentes que tienen comisiones registradas por assa_code en lugar de broker_id.';
