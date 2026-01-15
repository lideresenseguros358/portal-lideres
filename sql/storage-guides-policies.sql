-- ========================================
-- POLÍTICAS RLS PARA STORAGE BUCKET "GUIDES"
-- ========================================
-- Ejecutar en Supabase SQL Editor

-- 1. Permitir INSERT (upload) para usuarios autenticados
CREATE POLICY "Authenticated users can upload to guides"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'guides');

-- 2. Permitir SELECT (read/download) para usuarios autenticados
CREATE POLICY "Authenticated users can read from guides"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'guides');

-- 3. Permitir UPDATE para usuarios autenticados (reemplazar archivos)
CREATE POLICY "Authenticated users can update in guides"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'guides')
WITH CHECK (bucket_id = 'guides');

-- 4. Permitir DELETE para usuarios autenticados
CREATE POLICY "Authenticated users can delete from guides"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'guides');

-- Verificar políticas creadas
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
WHERE tablename = 'objects'
AND policyname LIKE '%guides%'
ORDER BY policyname;
