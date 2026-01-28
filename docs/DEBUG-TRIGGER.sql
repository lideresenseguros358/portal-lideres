-- =====================================================
-- DEBUG: Verificar estado del trigger y registros
-- =====================================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- =====================================================

-- 1. VERIFICAR QUE TRIGGER EXISTE Y ESTÁ ACTIVO
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'trigger_migrate_temp_client';

-- 2. VER REGISTROS PRELIMINARES NO MIGRADOS
SELECT 
  id,
  client_name,
  policy_number,
  insurer_id,
  renewal_date,
  broker_id,
  migrated,
  created_at,
  updated_at,
  CASE 
    WHEN client_name IS NULL OR client_name = '' THEN 'Falta client_name'
    WHEN policy_number IS NULL OR policy_number = '' THEN 'Falta policy_number'
    WHEN insurer_id IS NULL THEN 'Falta insurer_id'
    WHEN renewal_date IS NULL THEN 'Falta renewal_date'
    WHEN broker_id IS NULL THEN 'Falta broker_id'
    WHEN migrated = true THEN 'Ya está migrado'
    ELSE 'Debería migrar ✓'
  END AS status_migracion
FROM temp_client_import
WHERE national_id = '8-905-1500'  -- El cliente que estás editando
ORDER BY updated_at DESC
LIMIT 5;

-- 3. VERIFICAR SI FUNCIONES EXISTEN
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name IN ('check_temp_client_complete', 'migrate_temp_client_to_production')
ORDER BY routine_name;

-- 4. MIGRAR MANUALMENTE UN REGISTRO PARA PROBAR
-- Descomenta la siguiente línea y reemplaza con el ID real del registro
-- SELECT migrate_temp_client_to_production('PONER-ID-AQUI');
