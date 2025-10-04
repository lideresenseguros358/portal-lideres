-- =====================================================
-- VERIFICACIÓN DE DATOS EN TABLA BROKERS
-- =====================================================

-- 1. Contar brokers en la tabla
SELECT 
  'Total brokers' as tipo,
  COUNT(*) as cantidad
FROM public.brokers;

-- 2. Ver brokers con sus profiles
SELECT 
  b.id,
  b.name as broker_name,
  b.email as broker_email,
  b.active,
  b.p_id,
  p.email as profile_email,
  p.full_name as profile_full_name,
  p.role as profile_role
FROM public.brokers b
LEFT JOIN public.profiles p ON b.p_id = p.id
ORDER BY b.created_at DESC
LIMIT 10;

-- 3. Ver si hay brokers sin profile
SELECT 
  'Brokers sin profile' as tipo,
  COUNT(*) as cantidad
FROM public.brokers b
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = b.p_id
);

-- 4. Ver profiles que NO tienen broker
SELECT 
  'Profiles sin broker' as tipo,
  COUNT(*) as cantidad
FROM public.profiles p
WHERE p.role = 'broker'
AND NOT EXISTS (
  SELECT 1 FROM public.brokers b WHERE b.p_id = p.id
);

-- 5. Ver detalles de la relación
SELECT 
  b.id as broker_id,
  b.name,
  b.p_id,
  p.id as profile_id,
  p.email,
  p.full_name,
  CASE 
    WHEN b.p_id = p.id THEN '✓ OK'
    ELSE '✗ ERROR'
  END as relacion_status
FROM public.brokers b
LEFT JOIN public.profiles p ON b.p_id = p.id
ORDER BY b.name
LIMIT 20;

-- 6. Verificar constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  conrelid::regclass as table_name
FROM pg_constraint
WHERE conrelid = 'public.brokers'::regclass
AND contype = 'f'; -- foreign keys
