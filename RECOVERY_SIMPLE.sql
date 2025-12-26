-- =====================================================
-- SCRIPT SIMPLE DE RECUPERACIÓN
-- =====================================================
-- Revertir quincena de PAID a DRAFT
-- =====================================================

UPDATE fortnights 
SET status = 'DRAFT'
WHERE id = '93548007-7c2b-42fa-b7c9-31630e997705';

-- Verificar que funcionó
SELECT id, status, period_start, period_end
FROM fortnights 
WHERE id = '93548007-7c2b-42fa-b7c9-31630e997705';
