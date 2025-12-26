-- =====================================================
-- VERIFICAR Y LIMPIAR FORTNIGHT_DETAILS
-- =====================================================

-- 1. VERIFICAR cuántos registros hay
SELECT COUNT(*) as total_registros
FROM fortnight_details
WHERE fortnight_id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- 2. SI HAY REGISTROS, EJECUTAR ESTE DELETE:
DELETE FROM fortnight_details
WHERE fortnight_id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- 3. VERIFICAR que quedó en 0
SELECT COUNT(*) as total_registros_despues
FROM fortnight_details
WHERE fortnight_id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- 4. VERIFICAR status de la quincena
SELECT id, status
FROM fortnights
WHERE id = '93548007-7c2b-42fa-b7c9-31630e997705';
