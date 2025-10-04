-- ========================================
-- SCRIPT DE PRUEBA: Trigger temp_client_imports
-- ========================================
-- Este script prueba el comportamiento del trigger automático

-- PASO 1: Verificar estado inicial
SELECT 'Registros en temp_client_imports ANTES:' as test;
SELECT COUNT(*) as total FROM public.temp_client_imports;

SELECT 'Registros en clients ANTES:' as test;
SELECT COUNT(*) as total FROM public.clients;

SELECT 'Registros en policies ANTES:' as test;
SELECT COUNT(*) as total FROM public.policies;

-- ========================================
-- PRUEBA 1: INSERT con national_id (debe procesar y NO insertar en temp)
-- ========================================
INSERT INTO public.temp_client_imports (
  client_name,
  national_id,
  email,
  phone,
  policy_number,
  insurer_name,
  ramo,
  start_date,
  renewal_date,
  broker_email,
  source
) VALUES (
  'Cliente de Prueba 1',
  '8-123-4567',
  'prueba1@test.com',
  '6000-1111',
  'POL-TEST-001',
  'ASSA', -- Aseguradora debe existir
  'Vida',
  '2025-01-01',
  '2026-01-01',
  'corredor@test.com', -- Email de broker debe existir
  'manual'
);
-- Nota: status queda NULL, se convierte automáticamente a 'ACTIVA' al crear la póliza

-- Verificar: NO debe estar en temp_client_imports
SELECT 'PRUEBA 1 - temp_client_imports (debe estar vacío):' as test;
SELECT * FROM public.temp_client_imports WHERE policy_number = 'POL-TEST-001';

-- Verificar: SÍ debe estar en clients
SELECT 'PRUEBA 1 - clients (debe tener 1 registro):' as test;
SELECT * FROM public.clients WHERE national_id = '8-123-4567';

-- Verificar: SÍ debe estar en policies
SELECT 'PRUEBA 1 - policies (debe tener 1 registro):' as test;
SELECT * FROM public.policies WHERE policy_number = 'POL-TEST-001';

-- ========================================
-- PRUEBA 2: INSERT sin national_id (debe quedar como preliminar en temp)
-- ========================================
INSERT INTO public.temp_client_imports (
  client_name,
  national_id,
  email,
  phone,
  policy_number,
  insurer_name,
  ramo,
  broker_email,
  source
) VALUES (
  'Cliente Preliminar',
  NULL, -- Sin cédula
  'preliminar@test.com',
  '6000-2222',
  'POL-TEST-002',
  'ASSA',
  'Auto',
  'corredor@test.com',
  'manual'
);
-- Nota: status NULL por defecto

-- Verificar: SÍ debe estar en temp_client_imports (preliminar)
SELECT 'PRUEBA 2 - temp_client_imports (debe tener 1 preliminar):' as test;
SELECT * FROM public.temp_client_imports WHERE policy_number = 'POL-TEST-002';

-- Verificar: NO debe estar en clients (sin national_id)
SELECT 'PRUEBA 2 - clients (no debe tener este registro):' as test;
SELECT * FROM public.clients WHERE email = 'preliminar@test.com';

-- ========================================
-- PRUEBA 3: UPDATE agregando national_id (debe procesar y eliminar de temp)
-- ========================================
UPDATE public.temp_client_imports
SET national_id = '8-987-6543'
WHERE policy_number = 'POL-TEST-002';

-- Verificar: NO debe estar en temp_client_imports (fue procesado y eliminado)
SELECT 'PRUEBA 3 - temp_client_imports (debe estar vacío):' as test;
SELECT * FROM public.temp_client_imports WHERE policy_number = 'POL-TEST-002';

-- Verificar: SÍ debe estar en clients
SELECT 'PRUEBA 3 - clients (debe tener el registro):' as test;
SELECT * FROM public.clients WHERE national_id = '8-987-6543';

-- Verificar: SÍ debe estar en policies
SELECT 'PRUEBA 3 - policies (debe tener el registro):' as test;
SELECT * FROM public.policies WHERE policy_number = 'POL-TEST-002';

-- ========================================
-- PRUEBA 4: INSERT con broker inexistente (debe quedar en temp con error)
-- ========================================
INSERT INTO public.temp_client_imports (
  client_name,
  national_id,
  policy_number,
  insurer_name,
  broker_email,
  source
) VALUES (
  'Cliente Error Broker',
  '8-111-2222',
  'POL-TEST-003',
  'ASSA',
  'broker_no_existe@fake.com', -- Email que NO existe
  'manual'
);
-- Nota: status NULL por defecto

-- Verificar: SÍ debe estar en temp con status 'error'
SELECT 'PRUEBA 4 - temp_client_imports (debe tener error):' as test;
SELECT 
  policy_number,
  import_status,
  error_message
FROM public.temp_client_imports 
WHERE policy_number = 'POL-TEST-003';

-- ========================================
-- RESUMEN FINAL
-- ========================================
SELECT '========== RESUMEN FINAL ==========' as resultado;

SELECT 'Total en temp_client_imports:' as tabla, COUNT(*) as registros
FROM public.temp_client_imports
UNION ALL
SELECT 'Total en clients:', COUNT(*)
FROM public.clients
UNION ALL
SELECT 'Total en policies:', COUNT(*)
FROM public.policies;

-- Detalle de registros en temp (solo errores o preliminares)
SELECT 'Registros en temp_client_imports:' as detalle;
SELECT 
  client_name,
  national_id,
  policy_number,
  import_status,
  error_message
FROM public.temp_client_imports;

-- ========================================
-- LIMPIAR DATOS DE PRUEBA (OPCIONAL)
-- ========================================
/*
-- Descomentar para limpiar:

DELETE FROM public.policies WHERE policy_number LIKE 'POL-TEST-%';
DELETE FROM public.clients WHERE national_id IN ('8-123-4567', '8-987-6543', '8-111-2222');
DELETE FROM public.temp_client_imports WHERE policy_number LIKE 'POL-TEST-%';

SELECT 'Datos de prueba eliminados' as resultado;
*/
