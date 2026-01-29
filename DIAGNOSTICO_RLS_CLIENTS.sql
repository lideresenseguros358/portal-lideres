-- DIAGNÓSTICO: Verificar políticas RLS de tabla clients
-- Este script muestra las políticas actuales y ayuda a identificar el problema

-- 1. Ver todas las políticas RLS de la tabla clients
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'clients'
ORDER BY policyname;

-- 2. Ver todas las políticas RLS de la tabla policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'policies'
ORDER BY policyname;

-- 3. Ver todas las políticas RLS de la tabla brokers
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'brokers'
ORDER BY policyname;

-- NOTAS:
-- - La columna 'qual' muestra la condición USING de la política
-- - La columna 'with_check' muestra la condición WITH CHECK
-- - Busca políticas que usen 'auth.uid()' o subqueries con 'p_id'
-- - El problema está si la política cachea el broker_id al inicio de sesión
