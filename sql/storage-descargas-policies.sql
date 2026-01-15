-- ========================================
-- POLÍTICAS RLS PARA STORAGE BUCKET "DESCARGAS"
-- ========================================
-- Ejecutar en Supabase SQL Editor

-- 1. Permitir INSERT (upload) para usuarios autenticados
CREATE POLICY "Authenticated users can upload to descargas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'descargas');

-- 2. Permitir SELECT (read/download) para usuarios autenticados
CREATE POLICY "Authenticated users can read from descargas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'descargas');

-- 3. Permitir UPDATE para usuarios autenticados (reemplazar archivos)
CREATE POLICY "Authenticated users can update in descargas"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'descargas')
WITH CHECK (bucket_id = 'descargas');

-- 4. Permitir DELETE para usuarios autenticados
CREATE POLICY "Authenticated users can delete from descargas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'descargas');

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
AND policyname LIKE '%descargas%'
ORDER BY policyname;
