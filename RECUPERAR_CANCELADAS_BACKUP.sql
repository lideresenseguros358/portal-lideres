-- ============================================================================
-- RECUPERACIÓN CANCELADAS - BACKUP DE SUPABASE
-- ============================================================================

-- PASO 1: Ir a Supabase Dashboard
-- URL: https://supabase.com/dashboard/project/[TU_PROJECT_ID]/database/backups

-- PASO 2: Ver backups disponibles
-- Buscar el backup MÁS RECIENTE antes de que ejecutaras el script
-- (Hoy 28 de enero, antes de las 12:00 PM)

-- PASO 3: Restaurar SOLO la tabla brokers
-- Opción: Restaurar backup completo (más seguro)
-- O usar Point-in-Time Recovery si tienes plan Pro

-- ============================================================================
-- VERIFICAR DATOS ACTUALES
-- ============================================================================

-- Ver si todavía hay ALGÚN dato de canceladas en brokers:
SELECT 
  id,
  name,
  canceladas_ytd,
  created_at,
  updated_at
FROM brokers
WHERE canceladas_ytd IS NOT NULL AND canceladas_ytd > 0
ORDER BY name;

-- Ver si hay datos en production.canceladas (fallback):
SELECT 
  b.name,
  p.year,
  p.month,
  p.canceladas,
  p.updated_at
FROM production p
JOIN brokers b ON p.broker_id = b.id
WHERE p.canceladas IS NOT NULL AND p.canceladas > 0
  AND p.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
ORDER BY b.name, p.month;

-- ============================================================================
-- SI NO HAY BACKUP RECIENTE
-- ============================================================================

-- Última opción: Contactar soporte de Supabase
-- Email: support@supabase.com
-- Explicar que necesitas recuperar datos de la columna brokers.canceladas_ytd
-- Timestamp aproximado: 2026-01-28 antes de 12:00 PM (UTC-5)

-- ============================================================================
-- PREVENCIÓN FUTURA
-- ============================================================================

-- 1. Hacer backup manual ANTES de ejecutar scripts SQL destructivos
-- 2. Usar transacciones:
--    BEGIN;
--    [tus cambios]
--    -- Verificar que todo está bien
--    COMMIT; -- o ROLLBACK si algo está mal
