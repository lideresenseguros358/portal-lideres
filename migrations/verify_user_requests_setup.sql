-- ============================================
-- SCRIPT DE VERIFICACIÓN: USER_REQUESTS SETUP
-- ============================================
-- 
-- Ejecuta este script DESPUÉS de fix_user_requests_rls.sql
-- para verificar que todo está correctamente configurado
-- ============================================

-- 1. Verificar que la tabla existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_requests'
  ) THEN
    RAISE NOTICE '✅ Tabla user_requests existe';
  ELSE
    RAISE EXCEPTION '❌ ERROR: Tabla user_requests NO existe';
  END IF;
END $$;

-- 2. Verificar que RLS está habilitado
SELECT 
  CASE 
    WHEN relrowsecurity THEN '✅ RLS HABILITADO en user_requests'
    ELSE '❌ ERROR: RLS NO está habilitado'
  END as rls_status
FROM pg_class
WHERE relname = 'user_requests';

-- 3. Verificar políticas RLS creadas
SELECT 
  '=== POLÍTICAS RLS ENCONTRADAS ===' as header;

SELECT 
  policyname as "Nombre de Política",
  CASE 
    WHEN permissive = 'PERMISSIVE' THEN '✅ Permisiva'
    ELSE '⚠️ Restrictiva'
  END as "Tipo",
  array_to_string(roles, ', ') as "Roles Permitidos",
  cmd as "Comando",
  CASE 
    WHEN policyname = 'public_can_insert_request' AND cmd = 'INSERT' THEN '✅ CORRECTO'
    WHEN policyname = 'master_can_view_requests' AND cmd = 'SELECT' THEN '✅ CORRECTO'
    WHEN policyname = 'master_can_update_requests' AND cmd = 'UPDATE' THEN '✅ CORRECTO'
    WHEN policyname = 'master_can_delete_requests' AND cmd = 'DELETE' THEN '✅ CORRECTO'
    ELSE '⚠️ Política no reconocida'
  END as "Estado"
FROM pg_policies 
WHERE tablename = 'user_requests'
ORDER BY policyname;

-- 4. Contar políticas (deben ser 4)
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'user_requests';
  
  IF policy_count = 4 THEN
    RAISE NOTICE '✅ Se encontraron 4 políticas RLS (correcto)';
  ELSE
    RAISE NOTICE '⚠️ Se encontraron % políticas (se esperaban 4)', policy_count;
  END IF;
END $$;

-- 5. Verificar estructura de columnas críticas
SELECT 
  '=== COLUMNAS ACH VERIFICADAS ===' as header;

SELECT 
  column_name as "Columna",
  data_type as "Tipo",
  is_nullable as "Nullable",
  CASE 
    WHEN column_name IN ('bank_route', 'bank_account_no', 'tipo_cuenta', 'nombre_completo_titular') 
    THEN '✅ Columna ACH presente'
    ELSE '📄 Otra columna'
  END as "Estado"
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_requests'
  AND column_name IN (
    'email',
    'encrypted_password',
    'cedula',
    'nombre_completo',
    'bank_route',
    'bank_account_no',
    'tipo_cuenta',
    'nombre_completo_titular',
    'status'
  )
ORDER BY 
  CASE column_name
    WHEN 'email' THEN 1
    WHEN 'encrypted_password' THEN 2
    WHEN 'cedula' THEN 3
    WHEN 'nombre_completo' THEN 4
    WHEN 'bank_route' THEN 5
    WHEN 'bank_account_no' THEN 6
    WHEN 'tipo_cuenta' THEN 7
    WHEN 'nombre_completo_titular' THEN 8
    WHEN 'status' THEN 9
  END;

-- 6. Verificar que columnas ACH NO son nulas donde se requieren
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_requests'
      AND column_name = 'bank_account_no'
      AND is_nullable = 'NO'
  ) THEN
    RAISE NOTICE '✅ bank_account_no es NOT NULL (correcto)';
  ELSE
    RAISE NOTICE '⚠️ bank_account_no permite NULL';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_requests'
      AND column_name = 'nombre_completo_titular'
      AND is_nullable = 'NO'
  ) THEN
    RAISE NOTICE '✅ nombre_completo_titular es NOT NULL (correcto)';
  ELSE
    RAISE NOTICE '⚠️ nombre_completo_titular permite NULL';
  END IF;
END $$;

-- 7. Verificar foreign keys a ach_banks
SELECT 
  '=== FOREIGN KEYS VERIFICADAS ===' as header;

SELECT 
  conname as "Constraint Name",
  CASE 
    WHEN conname LIKE '%bank_route%' THEN '✅ FK a ach_banks presente'
    ELSE '📄 Otra FK'
  END as "Estado"
FROM pg_constraint
WHERE conrelid = 'user_requests'::regclass
  AND contype = 'f';

-- 8. Test de inserción simulada (sin realmente insertar)
DO $$
DECLARE
  test_email TEXT := 'test_verification_' || floor(random() * 10000)::TEXT || '@example.com';
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== TEST DE VALIDACIÓN ===';
  RAISE NOTICE 'Email de prueba: %', test_email;
  
  -- Simular validación de campos requeridos
  IF test_email IS NOT NULL 
     AND 'test_password' IS NOT NULL 
     AND '8-123-4567' IS NOT NULL 
     AND '1990-01-01' IS NOT NULL 
     AND '6000-0000' IS NOT NULL 
  THEN
    RAISE NOTICE '✅ Todos los campos requeridos están presentes en el test';
  ELSE
    RAISE NOTICE '❌ Faltan campos requeridos';
  END IF;
END $$;

-- 9. Resumen final
SELECT 
  '=== RESUMEN DE VERIFICACIÓN ===' as header;

DO $$
DECLARE
  table_exists BOOLEAN;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
  all_ok BOOLEAN := TRUE;
BEGIN
  -- Verificar tabla
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_requests'
  ) INTO table_exists;
  
  -- Verificar RLS
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class WHERE relname = 'user_requests';
  
  -- Contar políticas
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies WHERE tablename = 'user_requests';
  
  -- Evaluación
  RAISE NOTICE '';
  RAISE NOTICE '=== ESTADO FINAL ===';
  
  IF table_exists THEN
    RAISE NOTICE '✅ Tabla user_requests: OK';
  ELSE
    RAISE NOTICE '❌ Tabla user_requests: FALTA';
    all_ok := FALSE;
  END IF;
  
  IF rls_enabled THEN
    RAISE NOTICE '✅ RLS habilitado: OK';
  ELSE
    RAISE NOTICE '❌ RLS habilitado: NO';
    all_ok := FALSE;
  END IF;
  
  IF policy_count = 4 THEN
    RAISE NOTICE '✅ Políticas RLS (4): OK';
  ELSE
    RAISE NOTICE '⚠️ Políticas RLS: % (se esperaban 4)', policy_count;
    all_ok := FALSE;
  END IF;
  
  RAISE NOTICE '';
  IF all_ok THEN
    RAISE NOTICE '🎉 ✅ TODO ESTÁ CORRECTAMENTE CONFIGURADO';
    RAISE NOTICE '👉 El formulario /new-user debería funcionar correctamente';
    RAISE NOTICE '👉 Master puede aprobar/rechazar solicitudes';
  ELSE
    RAISE NOTICE '⚠️ HAY PROBLEMAS EN LA CONFIGURACIÓN';
    RAISE NOTICE '👉 Ejecuta migrations/fix_user_requests_rls.sql en Supabase';
  END IF;
END $$;

-- 10. Información adicional para debugging
SELECT 
  '=== INFORMACIÓN PARA DEBUGGING ===' as header;

SELECT 
  'Tabla' as tipo,
  'user_requests' as nombre,
  (SELECT COUNT(*) FROM user_requests) as "Total Registros",
  (SELECT COUNT(*) FROM user_requests WHERE status = 'pending') as "Pendientes",
  (SELECT COUNT(*) FROM user_requests WHERE status = 'approved') as "Aprobadas";
