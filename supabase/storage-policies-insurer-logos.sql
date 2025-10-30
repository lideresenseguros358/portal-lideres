-- =====================================================
-- POLICIES PARA BUCKET: insurer-logos
-- =====================================================
-- Ejecutar desde Supabase Dashboard > SQL Editor
-- IMPORTANTE: Activar "Run as service_role" toggle
-- =====================================================

-- Eliminar policies existentes si hay (para evitar errores)
DROP POLICY IF EXISTS "Public can view insurer logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload insurer logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update insurer logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete insurer logos" ON storage.objects;

-- 1. Policy: Public can view insurer logos
CREATE POLICY "Public can view insurer logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'insurer-logos');

-- 2. Policy: Authenticated users can upload insurer logos
CREATE POLICY "Authenticated users can upload insurer logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'insurer-logos');

-- 3. Policy: Authenticated users can update insurer logos
CREATE POLICY "Authenticated users can update insurer logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'insurer-logos');

-- 4. Policy: Authenticated users can delete insurer logos
CREATE POLICY "Authenticated users can delete insurer logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'insurer-logos');

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Para verificar que las policies se crearon correctamente:
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%insurer%'
ORDER BY policyname;
