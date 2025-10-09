-- =====================================================
-- CONFIGURACIÓN DEL BUCKET 'avatar' EN SUPABASE
-- =====================================================
-- Ejecutar estos comandos en el SQL Editor de Supabase
-- Dashboard > SQL Editor > New Query
-- =====================================================

-- PASO 1: Verificar si el bucket existe
-- (Si ya existe, omitir este paso)
SELECT * FROM storage.buckets WHERE id = 'avatar';

-- PASO 2: Crear el bucket (si no existe)
-- Nota: También puedes crear el bucket desde la UI:
-- Storage > New Bucket > Name: 'avatar', Public: Yes
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatar', 'avatar', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- POLÍTICA 1: Permitir que usuarios suban su propio avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- POLÍTICA 2: Permitir que usuarios actualicen su propio avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatar' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- POLÍTICA 3: Permitir que usuarios eliminen su propio avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatar' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- POLÍTICA 4: Permitir que cualquiera vea los avatares (lectura pública)
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatar');

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar que el bucket fue creado
SELECT * FROM storage.buckets WHERE id = 'avatar';

-- Verificar políticas creadas
SELECT * FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%avatar%';

-- =====================================================
-- LIMPIEZA (Solo si necesitas empezar de cero)
-- =====================================================

-- ADVERTENCIA: Esto eliminará TODAS las políticas y archivos del bucket
-- Descomenta solo si necesitas resetear completamente

/*
-- Eliminar todas las políticas del bucket
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Eliminar todos los archivos del bucket
DELETE FROM storage.objects WHERE bucket_id = 'avatar';

-- Eliminar el bucket
DELETE FROM storage.buckets WHERE id = 'avatar';
*/

-- =====================================================
-- CONFIGURACIÓN ADICIONAL (OPCIONAL)
-- =====================================================

-- Configurar límite de tamaño de archivo (2MB)
-- Esto se hace desde la UI de Supabase:
-- Storage > avatar (bucket) > Settings > File size limit: 2 MB

-- Configurar tipos MIME permitidos
-- Storage > avatar (bucket) > Settings > Allowed MIME types: image/*

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
