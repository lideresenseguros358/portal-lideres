-- VERIFICACIÓN SIMPLE: Ver si las pólizas tienen el broker_id correcto
-- Esta query muestra TODOS los clientes con sus pólizas y si hay desajuste

-- Ver clientes con sus pólizas y detectar desajustes de broker_id
SELECT 
  c.id as client_id,
  c.name as cliente_nombre,
  c.broker_id as cliente_broker_id,
  b_client.name as broker_del_cliente,
  p.id as policy_id,
  p.policy_number,
  p.broker_id as policy_broker_id,
  b_policy.name as broker_de_poliza,
  CASE 
    WHEN c.broker_id = p.broker_id THEN '✓ OK'
    WHEN p.broker_id IS NULL THEN '⚠ SIN BROKER'
    ELSE '✗ DESAJUSTE'
  END as estado
FROM clients c
LEFT JOIN policies p ON p.client_id = c.id
LEFT JOIN brokers b_client ON c.broker_id = b_client.id
LEFT JOIN brokers b_policy ON p.broker_id = b_policy.id
WHERE p.id IS NOT NULL
ORDER BY 
  CASE 
    WHEN c.broker_id != p.broker_id THEN 0
    ELSE 1
  END,
  c.name;

-- Si encuentras filas con estado "✗ DESAJUSTE", ese es el problema
-- Las pólizas tienen un broker_id diferente al del cliente
