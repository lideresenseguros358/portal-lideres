-- SCRIPT DE DIAGNÓSTICO: Verificar datos de cliente y pólizas después de reasignación
-- Reemplaza {CLIENT_ID} con el ID del cliente que reasignaste
-- Reemplaza {NEW_BROKER_ID} con el ID del nuevo broker

-- 1. Ver datos del cliente
SELECT 
  id,
  name,
  broker_id,
  created_at
FROM clients 
WHERE id = '{CLIENT_ID}';

-- 2. Ver todas las pólizas del cliente
SELECT 
  id,
  policy_number,
  client_id,
  broker_id,
  insurer_id,
  ramo,
  status
FROM policies 
WHERE client_id = '{CLIENT_ID}';

-- 3. Ver datos del broker nuevo
SELECT 
  id,
  name,
  p_id,
  active
FROM brokers 
WHERE id = '{NEW_BROKER_ID}';

-- 4. Verificar si el broker_id de las pólizas coincide con el del cliente
SELECT 
  c.name as cliente_nombre,
  c.broker_id as cliente_broker_id,
  p.policy_number,
  p.broker_id as policy_broker_id,
  CASE 
    WHEN c.broker_id = p.broker_id THEN '✓ CORRECTO'
    ELSE '✗ DESAJUSTE'
  END as estado
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
WHERE c.id = '{CLIENT_ID}';

-- 5. Ver qué brokers puede ver este cliente (según RLS de clients)
-- Esto simula la query que hace el broker
SELECT 
  c.id,
  c.name,
  c.broker_id,
  b.name as broker_nombre
FROM clients c
JOIN brokers b ON c.broker_id = b.id
WHERE c.id = '{CLIENT_ID}';

-- 6. Ver qué pólizas puede ver el broker según RLS
-- Reemplaza {BROKER_P_ID} con el p_id del broker (el auth.uid())
SELECT 
  p.id,
  p.policy_number,
  p.client_id,
  p.broker_id,
  b.id as broker_id_from_table,
  b.p_id as broker_p_id
FROM policies p
JOIN brokers b ON p.broker_id = b.id
WHERE p.client_id = '{CLIENT_ID}'
AND p.broker_id IN (
  SELECT id FROM brokers WHERE p_id = '{BROKER_P_ID}'
);

-- INSTRUCCIONES:
-- 1. Reemplaza {CLIENT_ID} con el UUID del cliente
-- 2. Reemplaza {NEW_BROKER_ID} con el UUID del broker nuevo
-- 3. Reemplaza {BROKER_P_ID} con el p_id del broker (el user ID del auth)
-- 4. Ejecuta cada query por separado
-- 5. Comparte los resultados para diagnosticar
