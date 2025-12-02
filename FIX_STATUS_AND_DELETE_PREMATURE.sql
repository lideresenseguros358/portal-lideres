-- =====================================================
-- CORRECCIÓN URGENTE: Status y Registros Prematuros
-- =====================================================

-- PASO 1: Ver status actual de pending_items para estas pólizas
SELECT 
  pi.id,
  pi.policy_number,
  pi.insured_name,
  pi.status as current_status,
  pi.assigned_broker_id,
  b.name as broker_name,
  ar.id as report_id,
  ar.status as report_status,
  ar.paid_date
FROM pending_items pi
LEFT JOIN brokers b ON b.id = pi.assigned_broker_id
LEFT JOIN adjustment_report_items ari ON ari.pending_item_id = pi.id
LEFT JOIN adjustment_reports ar ON ar.id = ari.report_id
WHERE pi.policy_number IN (
  '02-93-1120932-1',
  '0225-08096-09',
  '04-04-2002168-0',
  '04-04-2032418-0',
  '04-05-2050034-0',
  '04-08-2001818-0',
  '1-16-68399',
  '1-16-68400',
  '1-40-14792',
  '62724'
)
ORDER BY pi.policy_number;


-- PASO 2: CORREGIR STATUS según el estado del reporte
-- Items en reporte 'pending' → status='in_review'
-- Items en reporte 'approved' → status='assigned'
-- Items en reporte 'paid' → status='paid'

UPDATE pending_items pi
SET status = CASE 
  WHEN ar.status = 'pending' THEN 'in_review'
  WHEN ar.status = 'approved' THEN 'assigned'
  WHEN ar.status = 'paid' THEN 'paid'
  ELSE pi.status
END
FROM adjustment_report_items ari
JOIN adjustment_reports ar ON ar.id = ari.report_id
WHERE pi.id = ari.pending_item_id
  AND pi.policy_number IN (
    '02-93-1120932-1',
    '0225-08096-09',
    '04-04-2002168-0',
    '04-04-2032418-0',
    '04-05-2050034-0',
    '04-08-2001818-0',
    '1-16-68399',
    '1-16-68400',
    '1-40-14792',
    '62724'
  )
  AND pi.status = 'open'; -- Solo actualizar los que están en 'open'


-- PASO 3: Ver qué policies/clients existen prematuramente
SELECT 
  p.id as policy_id,
  p.policy_number,
  p.broker_id,
  b.name as broker_name,
  c.id as client_id,
  c.name as client_name,
  c.national_id,
  p.created_at as policy_created,
  c.created_at as client_created
FROM policies p
LEFT JOIN clients c ON c.id = p.client_id
LEFT JOIN brokers b ON b.id = p.broker_id
WHERE p.policy_number IN (
  '02-93-1120932-1',
  '0225-08096-09',
  '04-04-2002168-0',
  '04-04-2032418-0',
  '04-05-2050034-0',
  '04-08-2001818-0',
  '1-16-68399',
  '1-16-68400',
  '1-40-14792',
  '62724'
)
ORDER BY p.policy_number;


-- PASO 4: ELIMINAR policies prematuros (estas NO deberían existir aún)
-- ⚠️ ESTO ELIMINARÁ EN CASCADE los clients asociados si no tienen otras policies

DELETE FROM policies
WHERE policy_number IN (
  '02-93-1120932-1',
  '0225-08096-09',
  '04-04-2002168-0',
  '04-04-2032418-0',
  '04-05-2050034-0',
  '04-08-2001818-0',
  '1-16-68399',
  '1-16-68400',
  '1-40-14792',
  '62724'
);


-- PASO 5: ELIMINAR clients huérfanos (sin policies)
DELETE FROM clients
WHERE id NOT IN (
  SELECT DISTINCT client_id 
  FROM policies 
  WHERE client_id IS NOT NULL
);


-- PASO 6: VERIFICAR que pending_items ahora tienen status correcto
SELECT 
  pi.policy_number,
  pi.status,
  ar.status as report_status,
  COUNT(*) as count
FROM pending_items pi
LEFT JOIN adjustment_report_items ari ON ari.pending_item_id = pi.id
LEFT JOIN adjustment_reports ar ON ar.id = ari.report_id
WHERE pi.policy_number IN (
  '02-93-1120932-1',
  '0225-08096-09',
  '04-04-2002168-0',
  '04-04-2032418-0',
  '04-05-2050034-0',
  '04-08-2001818-0',
  '1-16-68399',
  '1-16-68400',
  '1-40-14792',
  '62724'
)
GROUP BY pi.policy_number, pi.status, ar.status
ORDER BY pi.policy_number;


-- PASO 7: VERIFICAR que NO existen en clients/policies
SELECT 
  'Policies restantes:' as check_type,
  COUNT(*) as count
FROM policies
WHERE policy_number IN (
  '02-93-1120932-1',
  '0225-08096-09',
  '04-04-2002168-0',
  '04-04-2032418-0',
  '04-05-2050034-0',
  '04-08-2001818-0',
  '1-16-68399',
  '1-16-68400',
  '1-40-14792',
  '62724'
);

-- Debe retornar 0
