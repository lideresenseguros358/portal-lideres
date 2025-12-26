-- =====================================================
-- LIMPIAR DATOS PARCIALES Y RECUPERAR QUINCENA
-- =====================================================
-- ID: 93548007-7c2b-42fa-b7c9-31630e997705
-- =====================================================

-- PASO 1: Eliminar datos parciales del intento fallido
-- (fortnight_details tiene duplicados del primer intento)
DELETE FROM fortnight_details
WHERE fortnight_id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- PASO 2: Eliminar retained_commissions si existen
DELETE FROM retained_commissions
WHERE fortnight_id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- PASO 3: Revertir vínculos banco temporales a estado original
-- (para que se confirmen correctamente en el próximo intento)
UPDATE bank_transfer_imports
SET 
  is_temporary = true,
  fortnight_paid_id = NULL,
  notes = REPLACE(notes, ' | Pagado en quincena: 93548007-7c2b-42fa-b7c9-31630e997705', '')
WHERE fortnight_paid_id = '93548007-7c2b-42fa-b7c9-31630e997705';

UPDATE bank_group_imports
SET 
  is_temporary = true,
  fortnight_paid_id = NULL,
  notes = REPLACE(notes, ' | Pagado en quincena: 93548007-7c2b-42fa-b7c9-31630e997705', '')
WHERE fortnight_paid_id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- PASO 4: Revertir transferencias a estado PENDIENTE
-- (obtener IDs de transfers vinculados a esta quincena)
UPDATE bank_transfers_comm
SET status = 'PENDIENTE'
WHERE id IN (
  SELECT DISTINCT bti.transfer_id
  FROM bank_transfer_imports bti
  JOIN comm_imports ci ON bti.import_id = ci.id
  WHERE ci.period_label = '93548007-7c2b-42fa-b7c9-31630e997705'
);

-- PASO 5: Revertir grupos banco a estado EN_PROCESO (no PENDIENTE - ese valor no existe para grupos)
UPDATE bank_groups
SET status = 'EN_PROCESO'
WHERE id IN (
  SELECT DISTINCT bgi.group_id
  FROM bank_group_imports bgi
  JOIN comm_imports ci ON bgi.import_id = ci.id
  WHERE ci.period_label = '93548007-7c2b-42fa-b7c9-31630e997705'
);

-- PASO 6: Eliminar registros de bank_transfers de descuentos de adelantos
-- (estos se crean en el proceso y tienen un formato específico)
DELETE FROM bank_transfers
WHERE reference_number LIKE 'DESCUENTO-COMISIONES-93548007-7c2b-42fa-b7c9-31630e997705-%';

-- PASO 7: Eliminar pending_payments de descuentos de adelantos
DELETE FROM pending_payments
WHERE notes::text LIKE '%"fortnight_id":"93548007-7c2b-42fa-b7c9-31630e997705"%';

-- PASO 8: Revertir adjustment_reports a estado APPROVED
UPDATE adjustment_reports
SET 
  status = 'approved',
  paid_date = NULL
WHERE fortnight_id = '93548007-7c2b-42fa-b7c9-31630e997705'
AND status = 'paid';

-- PASO 9: Revertir status de quincena a DRAFT
UPDATE fortnights 
SET status = 'DRAFT'
WHERE id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

-- Verificar que la quincena está en DRAFT
SELECT 'FORTNIGHT STATUS:' as check_type, status
FROM fortnights 
WHERE id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- Verificar que NO hay datos en fortnight_details
SELECT 'FORTNIGHT_DETAILS:' as check_type, COUNT(*) as count
FROM fortnight_details
WHERE fortnight_id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- Verificar estado de vínculos banco
SELECT 'BANK_LINKS:' as check_type, 
       COUNT(*) as total,
       SUM(CASE WHEN is_temporary = true THEN 1 ELSE 0 END) as temporary,
       SUM(CASE WHEN is_temporary = false THEN 1 ELSE 0 END) as confirmed
FROM bank_transfer_imports bti
JOIN comm_imports ci ON bti.import_id = ci.id
WHERE ci.period_label = '93548007-7c2b-42fa-b7c9-31630e997705';

-- =====================================================
-- DESPUÉS DE EJECUTAR ESTE SCRIPT:
-- =====================================================
-- 1. Refresca la página de Nueva Quincena (F5)
-- 2. La quincena aparecerá como DRAFT
-- 3. Click en "Pagar"
-- 4. El proceso guardará TODO correctamente:
--    ✅ Historial en fortnight_details
--    ✅ Transferencias marcadas como PAGADAS
--    ✅ Vínculos banco confirmados
--    ✅ Adelantos procesados
--    ✅ Status cambiado a PAID AL FINAL
-- =====================================================
