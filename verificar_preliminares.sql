-- Verificar datos de clientes preliminares
-- Para identificar qué campos están vacíos/null

SELECT 
  id,
  client_name,
  national_id,
  email,
  phone,
  birth_date,
  policy_number,
  ramo,
  insurer_id,
  start_date,
  renewal_date,
  status,
  broker_id,
  migrated,
  created_at,
  -- Verificar cuáles están null
  CASE WHEN client_name IS NULL OR TRIM(client_name) = '' THEN '❌' ELSE '✅' END as tiene_nombre,
  CASE WHEN birth_date IS NULL THEN '❌' ELSE '✅' END as tiene_fecha_nacimiento,
  CASE WHEN policy_number IS NULL OR TRIM(policy_number) = '' THEN '❌' ELSE '✅' END as tiene_poliza,
  CASE WHEN insurer_id IS NULL THEN '❌' ELSE '✅' END as tiene_aseguradora,
  CASE WHEN start_date IS NULL THEN '❌' ELSE '✅' END as tiene_fecha_inicio,
  CASE WHEN renewal_date IS NULL THEN '❌' ELSE '✅' END as tiene_fecha_renovacion,
  CASE WHEN broker_id IS NULL THEN '❌' ELSE '✅' END as tiene_corredor
FROM temp_client_import
WHERE migrated = false
ORDER BY created_at DESC
LIMIT 5;

-- Contar campos faltantes por cliente
SELECT 
  id,
  client_name,
  (CASE WHEN client_name IS NULL OR TRIM(client_name) = '' THEN 1 ELSE 0 END +
   CASE WHEN birth_date IS NULL THEN 1 ELSE 0 END +
   CASE WHEN policy_number IS NULL OR TRIM(policy_number) = '' THEN 1 ELSE 0 END +
   CASE WHEN insurer_id IS NULL THEN 1 ELSE 0 END +
   CASE WHEN start_date IS NULL THEN 1 ELSE 0 END +
   CASE WHEN renewal_date IS NULL THEN 1 ELSE 0 END +
   CASE WHEN broker_id IS NULL THEN 1 ELSE 0 END) as total_campos_faltantes
FROM temp_client_import
WHERE migrated = false
ORDER BY total_campos_faltantes DESC
LIMIT 10;
