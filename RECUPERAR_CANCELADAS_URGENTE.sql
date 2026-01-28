-- ============================================================================
-- RECUPERACIÓN DE EMERGENCIA - CANCELADAS BORRADAS
-- ============================================================================
-- OPCIONES DE RECUPERACIÓN:
-- ============================================================================

-- OPCIÓN 1: Si la transacción AÚN NO se hizo COMMIT
-- Ejecutar inmediatamente:
ROLLBACK;


-- OPCIÓN 2: Restaurar desde backup de Supabase
-- Ir a: Dashboard de Supabase > Database > Backups
-- Restaurar al punto antes de ejecutar LIMPIAR_CANCELADAS_MENSUALES.sql


-- OPCIÓN 3: Point-in-time Recovery (solo plan Pro de Supabase)
-- Restaurar a timestamp específico antes del desastre


-- ============================================================================
-- VERIFICAR DAÑO ACTUAL
-- ============================================================================
-- Ver cuántos registros tienen canceladas = 0 ahora:
SELECT 
  year,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN canceladas = 0 THEN 1 END) as registros_con_cero,
  COUNT(CASE WHEN canceladas > 0 THEN 1 END) as registros_con_valor
FROM production
GROUP BY year
ORDER BY year DESC;

-- Ver si ALGÚN broker todavía tiene datos:
SELECT 
  b.name,
  p.year,
  SUM(p.canceladas) as total_canceladas,
  COUNT(*) as meses_con_datos
FROM production p
JOIN brokers b ON p.broker_id = b.id
GROUP BY b.name, p.year
HAVING SUM(p.canceladas) > 0
ORDER BY total_canceladas DESC;


-- ============================================================================
-- SI NO HAY BACKUP DISPONIBLE
-- ============================================================================
-- Última opción: Recolectar datos manualmente de los brokers
-- y volverlos a ingresar usando el sistema de edición de producción
-- en la interfaz web.
