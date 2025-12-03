-- Ver EXACTAMENTE qué campos están vacíos en cada cliente
SELECT 
  id,
  client_name,
  -- Cliente
  CASE WHEN client_name IS NULL OR TRIM(client_name) = '' THEN '❌ Nombre' ELSE NULL END as campo1,
  CASE WHEN national_id IS NULL OR TRIM(national_id) = '' THEN '❌ Cédula' ELSE NULL END as campo2,
  CASE WHEN email IS NULL OR TRIM(email) = '' THEN '❌ Email' ELSE NULL END as campo3,
  CASE WHEN phone IS NULL OR TRIM(phone) = '' THEN '❌ Teléfono' ELSE NULL END as campo4,
  CASE WHEN birth_date IS NULL THEN '❌ F.Nacimiento' ELSE NULL END as campo5,
  -- Póliza
  CASE WHEN policy_number IS NULL OR TRIM(policy_number) = '' THEN '❌ Póliza' ELSE NULL END as campo6,
  CASE WHEN ramo IS NULL OR TRIM(ramo) = '' THEN '❌ Ramo' ELSE NULL END as campo7,
  CASE WHEN insurer_id IS NULL THEN '❌ Aseguradora' ELSE NULL END as campo8,
  CASE WHEN start_date IS NULL THEN '❌ F.Inicio' ELSE NULL END as campo9,
  CASE WHEN renewal_date IS NULL THEN '❌ F.Renovación' ELSE NULL END as campo10,
  CASE WHEN status IS NULL OR TRIM(status) = '' THEN '❌ Status' ELSE NULL END as campo11,
  -- Otros
  CASE WHEN broker_id IS NULL THEN '❌ Corredor' ELSE NULL END as campo12
FROM temp_client_import
WHERE migrated = false
  AND id = 'aee8eaf2-4bfc-41a8-93ac-60235b5a058c'
LIMIT 1;
