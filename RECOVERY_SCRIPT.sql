-- =====================================================
-- SCRIPT DE RECUPERACIÓN DE QUINCENA
-- =====================================================
-- ID de la quincena dañada: 93548007-7c2b-42fa-b7c9-31630e997705
-- 
-- PROBLEMA: El status cambió a PAID antes de guardar los datos históricos
-- SOLUCIÓN: Revertir a DRAFT y cerrar de nuevo con código corregido
-- =====================================================

-- PASO 1: Verificar estado actual de la quincena
SELECT 
  id,
  status,
  period_start,
  period_end,
  created_at
FROM fortnights 
WHERE id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- PASO 2: Verificar si hay datos en fortnight_details (NO deberían existir)
SELECT COUNT(*) as detail_count
FROM fortnight_details
WHERE fortnight_id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- PASO 3: Verificar imports de esta quincena
SELECT 
  id,
  insurer_id,
  created_at
FROM comm_imports
WHERE period_label = '93548007-7c2b-42fa-b7c9-31630e997705';

-- PASO 4: Verificar totales calculados (deben existir)
SELECT 
  broker_id,
  gross_amount,
  net_amount,
  is_retained
FROM fortnight_broker_totals
WHERE fortnight_id = '93548007-7c2b-42fa-b7c9-31630e997705'
ORDER BY gross_amount DESC;

-- =====================================================
-- EJECUTAR SOLO SI LOS PASOS 1-4 CONFIRMAN QUE:
-- - Status es PAID
-- - NO hay datos en fortnight_details
-- - SÍ hay imports y totales calculados
-- =====================================================

-- PASO 5: REVERTIR STATUS A DRAFT
UPDATE fortnights 
SET status = 'DRAFT'
WHERE id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- PASO 6: Verificar que el cambio se aplicó
SELECT 
  id,
  status,
  period_start,
  period_end
FROM fortnights 
WHERE id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
-- 1. Los draft_unidentified_items fueron eliminados en el proceso fallido
--    NO podemos recuperarlos fácilmente
-- 
-- 2. Los comm_items de la quincena AÚN EXISTEN a través de comm_imports
--    Estos se usarán para regenerar el historial
--
-- 3. Los fortnight_broker_totals ya están calculados correctamente
--
-- 4. Después de ejecutar este script:
--    - Refresca la página de Nueva Quincena
--    - La quincena aparecerá de nuevo como DRAFT
--    - Haz click en "Pagar" nuevamente
--    - El código corregido guardará TODO antes de cambiar a PAID
-- =====================================================

-- ROLLBACK en caso de error (si estás en una transacción)
-- ROLLBACK;

-- COMMIT si todo salió bien
-- COMMIT;
