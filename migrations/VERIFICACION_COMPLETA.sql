-- =====================================================
-- SCRIPT DE VERIFICACIÓN COMPLETA
-- =====================================================
-- Ejecuta esto en Supabase SQL Editor para ver qué tienes
-- =====================================================

-- 1. TABLAS DE CHEQUES
SELECT 
  'CHEQUES' as categoria,
  table_name,
  CASE 
    WHEN table_name IN ('bank_transfers', 'pending_payments', 'payment_references', 'payment_details') 
    THEN '✅ EXISTE'
    ELSE '❌ FALTA'
  END as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('bank_transfers', 'pending_payments', 'payment_references', 'payment_details')
ORDER BY table_name;

-- 2. TABLAS DE COMISIONES PENDIENTES
SELECT 
  'COMISIONES' as categoria,
  table_name,
  '✅ EXISTE' as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pending_items', 'pending_policy')
ORDER BY table_name;

-- 3. TABLA TEMP CLIENTS
SELECT 
  'BASE DATOS' as categoria,
  table_name,
  '✅ EXISTE' as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'temp_client_imports';

-- 4. COLUMNA IS_LIFE_INSURANCE
SELECT 
  'COMISIONES' as categoria,
  'comm_imports.is_life_insurance' as columna,
  CASE 
    WHEN column_name = 'is_life_insurance' 
    THEN '✅ EXISTE'
    ELSE '❌ FALTA'
  END as estado
FROM information_schema.columns 
WHERE table_name = 'comm_imports' 
AND column_name = 'is_life_insurance';

-- 5. FUNCIONES
SELECT 
  'FUNCIONES' as categoria,
  routine_name,
  '✅ EXISTE' as estado
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'assign_pending_to_office_after_3m',
  'get_pending_items_grouped',
  'process_temp_client_import',
  'delete_processed_temp_import',
  'cleanup_processed_temp_imports',
  'validate_payment_references',
  'update_can_be_paid'
)
ORDER BY routine_name;

-- =====================================================
-- RESUMEN POR MIGRACIÓN
-- =====================================================

-- Migración 1: create_checks_tables.sql
SELECT '=== MIGRACIÓN 1: create_checks_tables.sql ===' as titulo;
SELECT COUNT(*) as tablas_encontradas, 
       4 as tablas_esperadas,
       CASE WHEN COUNT(*) = 4 THEN '✅ COMPLETO' ELSE '⚠️ INCOMPLETO' END as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('bank_transfers', 'pending_payments', 'payment_references', 'payment_details');

-- Migración 2: create_pending_commissions_tables.sql
SELECT '=== MIGRACIÓN 2: create_pending_commissions_tables.sql ===' as titulo;
SELECT COUNT(*) as tablas_encontradas,
       2 as tablas_esperadas,
       CASE WHEN COUNT(*) = 2 THEN '✅ COMPLETO' ELSE '⚠️ INCOMPLETO' END as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pending_items', 'pending_policy');

-- Migración 3: add_life_insurance_flag.sql
SELECT '=== MIGRACIÓN 3: add_life_insurance_flag.sql ===' as titulo;
SELECT COUNT(*) as columnas_encontradas,
       1 as columnas_esperadas,
       CASE WHEN COUNT(*) = 1 THEN '✅ COMPLETO' ELSE '❌ FALTA EJECUTAR' END as estado
FROM information_schema.columns 
WHERE table_name = 'comm_imports' 
AND column_name = 'is_life_insurance';

-- Migración 4: create_temp_clients_table.sql
SELECT '=== MIGRACIÓN 4: create_temp_clients_table.sql ===' as titulo;
SELECT COUNT(*) as tablas_encontradas,
       1 as tablas_esperadas,
       CASE WHEN COUNT(*) = 1 THEN '✅ COMPLETO' ELSE '❌ FALTA EJECUTAR' END as estado
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'temp_client_imports';

-- Migración 5: fix_temp_client_imports_trigger.sql
SELECT '=== MIGRACIÓN 5: fix_temp_client_imports_trigger.sql ===' as titulo;
SELECT COUNT(*) as funciones_encontradas,
       1 as funciones_esperadas,
       CASE WHEN COUNT(*) = 1 THEN '✅ COMPLETO' ELSE '❌ FALTA EJECUTAR' END as estado
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'delete_processed_temp_import';

-- =====================================================
-- CONTEO FINAL
-- =====================================================
SELECT '=== RESUMEN FINAL ===' as titulo;
SELECT 
  (SELECT COUNT(*) FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('bank_transfers', 'pending_payments', 'payment_references', 'payment_details', 
                      'pending_items', 'pending_policy', 'temp_client_imports')) as total_tablas_nuevas,
  7 as tablas_esperadas,
  (SELECT COUNT(*) FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN ('assign_pending_to_office_after_3m', 'get_pending_items_grouped',
                        'process_temp_client_import', 'delete_processed_temp_import',
                        'cleanup_processed_temp_imports', 'validate_payment_references',
                        'update_can_be_paid')) as total_funciones,
  7 as funciones_esperadas;
