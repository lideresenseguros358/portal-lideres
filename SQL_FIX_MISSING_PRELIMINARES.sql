-- ============================================================
-- FIX: Insertar en temp_client_import la póliza 03G51178
-- que quedó solo en comm_items por bug de fortnight_id
-- ============================================================

-- 1. CORREGIR CASO ESPECÍFICO: 03G51178
INSERT INTO temp_client_import (
  policy_number, client_name, insurer_id, broker_id,
  migrated, status, source, notes
)
SELECT 
  ci.policy_number,
  ci.insured_name,
  ci.insurer_id,
  ci.broker_id,
  false,
  'ACTIVA',
  'manual_fix',
  'Fix: faltaba en preliminar por bug fortnight_id en actionPayFortnight'
FROM comm_items ci
WHERE ci.policy_number = '03G51178'
  AND ci.id = '566eea51-0f5a-4568-ab37-757aa40cb5ac'
  AND NOT EXISTS (
    SELECT 1 FROM temp_client_import tci WHERE tci.policy_number = '03G51178'
  )
  AND NOT EXISTS (
    SELECT 1 FROM policies p WHERE p.policy_number = '03G51178'
  );

-- 2. DETECTAR OTROS CASOS AFECTADOS:
-- Pólizas que están en comm_items con broker asignado
-- pero NO tienen registro en temp_client_import NI en policies
-- (son candidatos a haber sido afectados por el mismo bug)
SELECT 
  ci.id,
  ci.policy_number,
  ci.insured_name,
  ci.broker_id,
  b.name as broker_name,
  ci.insurer_id,
  ins.name as insurer_name,
  ci.created_at
FROM comm_items ci
LEFT JOIN brokers b ON ci.broker_id = b.id
LEFT JOIN insurers ins ON ci.insurer_id = ins.id
WHERE ci.broker_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM policies p WHERE UPPER(p.policy_number) = UPPER(ci.policy_number)
  )
  AND NOT EXISTS (
    SELECT 1 FROM temp_client_import tci WHERE UPPER(tci.policy_number) = UPPER(ci.policy_number)
  )
ORDER BY ci.created_at DESC;

-- 3. FIX MASIVO (EJECUTAR SOLO DESPUÉS DE REVISAR QUERY 2):
-- Descomentar si los resultados de la query 2 confirman más casos afectados
/*
INSERT INTO temp_client_import (
  policy_number, client_name, insurer_id, broker_id,
  migrated, status, source, notes
)
SELECT DISTINCT ON (ci.policy_number)
  ci.policy_number,
  ci.insured_name,
  ci.insurer_id,
  ci.broker_id,
  false,
  'ACTIVA',
  'manual_fix',
  'Fix masivo: faltaba en preliminar por bug fortnight_id'
FROM comm_items ci
WHERE ci.broker_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM policies p WHERE UPPER(p.policy_number) = UPPER(ci.policy_number)
  )
  AND NOT EXISTS (
    SELECT 1 FROM temp_client_import tci WHERE UPPER(tci.policy_number) = UPPER(ci.policy_number)
  )
ORDER BY ci.policy_number, ci.created_at DESC;
*/
