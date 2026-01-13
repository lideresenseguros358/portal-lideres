-- ============================================================================
-- FIX: Eliminar constraint que bloquea canceladas anuales
-- ============================================================================
--
-- PROBLEMA:
-- El constraint "canceladas_le_bruto" impide que canceladas sea mayor que bruto
-- en cada mes individual. Esto bloquea guardar el valor anual de canceladas
-- en enero cuando enero tiene bruto = 0.
--
-- ERROR:
-- new row for relation "production" violates check constraint "canceladas_le_bruto"
--
-- SOLUCIÓN:
-- Eliminar el constraint para permitir que canceladas_ytd se guarde en enero
-- sin importar el valor de bruto de ese mes.
--
-- ============================================================================

-- Eliminar el constraint problemático
ALTER TABLE production DROP CONSTRAINT IF EXISTS canceladas_le_bruto;

-- Verificar que se eliminó
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'production' 
AND constraint_name = 'canceladas_le_bruto';

-- Debería retornar 0 filas si se eliminó correctamente

-- ============================================================================
-- NOTAS:
-- ============================================================================
--
-- 1. Este constraint estaba validando que canceladas <= bruto en cada mes
-- 2. Con el nuevo modelo de canceladas anuales, esto no tiene sentido
-- 3. El valor anual se guarda en enero y puede ser mayor que el bruto de enero
-- 4. El cálculo correcto es: Neto YTD = Bruto YTD - Canceladas YTD
--
-- ============================================================================
