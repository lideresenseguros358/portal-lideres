-- Script para corregir permisos de avatar storage
-- Ejecutar directamente en Supabase SQL Editor

-- =====================================================
-- Eliminar políticas antiguas
-- =====================================================
DROP POLICY IF EXISTS "Avatar upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public access" ON storage.objects;

-- =====================================================
-- Crear políticas actualizadas
-- =====================================================

-- Policy 1: Usuarios pueden subir su propio avatar
-- Permite: userId.ext, userId_anything.ext, o userId/filename.ext
CREATE POLICY "Avatar upload policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar' 
  AND (
    -- Archivos en carpeta del usuario: userId/filename.ext
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Archivos que empiezan con userId (con _ o .)
    name ~ ('^' || auth.uid()::text || '[_.]')
  )
);

-- Policy 2: Usuarios pueden actualizar su propio avatar
CREATE POLICY "Avatar update policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name ~ ('^' || auth.uid()::text || '[_.]')
  )
)
WITH CHECK (
  bucket_id = 'avatar' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name ~ ('^' || auth.uid()::text || '[_.]')
  )
);

-- Policy 3: Usuarios pueden eliminar su propio avatar
CREATE POLICY "Avatar delete policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    name ~ ('^' || auth.uid()::text || '[_.]')
  )
);

-- Policy 4: Todos pueden ver avatares (acceso público de lectura)
CREATE POLICY "Avatar public access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatar');

-- =====================================================
-- VERIFICAR RESULTADO
-- =====================================================
-- Ejecutar para verificar:
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' AND policyname LIKE '%Avatar%'
ORDER BY policyname;
