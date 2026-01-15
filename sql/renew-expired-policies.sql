-- SQL para renovar pólizas con fecha de renovación vencida
-- Fecha de referencia: 2026-01-15
-- Este script actualiza las fechas de vigencia y renovación sumando 1 año

-- Ver pólizas que serán actualizadas (preview)
SELECT 
  p.id,
  p.policy_number,
  c.name as client_name,
  p.start_date as vigencia_actual,
  p.renewal_date as renovacion_actual,
  p.start_date + INTERVAL '1 year' as nueva_vigencia,
  p.renewal_date + INTERVAL '1 year' as nueva_renovacion
FROM policies p
INNER JOIN clients c ON p.client_id = c.id
WHERE p.renewal_date < '2026-01-15'
  AND p.status = 'ACTIVA'
ORDER BY p.renewal_date;

-- Actualizar pólizas vencidas (ejecutar después de revisar el preview)
UPDATE policies
SET 
  start_date = start_date + INTERVAL '1 year',
  renewal_date = renewal_date + INTERVAL '1 year'
WHERE renewal_date < '2026-01-15'
  AND status = 'ACTIVA';

-- Verificar las actualizaciones
SELECT 
  p.id,
  p.policy_number,
  c.name as client_name,
  p.start_date as vigencia_actualizada,
  p.renewal_date as renovacion_actualizada
FROM policies p
INNER JOIN clients c ON p.client_id = c.id
WHERE p.start_date >= '2025-01-01'
  AND p.renewal_date >= '2026-01-15'
ORDER BY p.renewal_date;
