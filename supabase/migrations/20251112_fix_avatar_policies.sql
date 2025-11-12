-- Migration: Fix avatar storage policies to allow userId.ext format
-- Description: Updates RLS policies to allow files named as userId.ext without underscore

-- =====================================================
-- Drop existing policies
-- =====================================================
DROP POLICY IF EXISTS "Avatar upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public access" ON storage.objects;

-- =====================================================
-- Create updated RLS policies
-- =====================================================

-- Policy 1: Users can upload their own avatar
-- Allows: userId.ext, userId_anything.ext, or userId/filename.ext
CREATE POLICY "Avatar upload policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar' 
  AND (
    -- Files in user's folder: userId/filename.ext
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Files starting with userId (with or without underscore/dot)
    name ~ ('^' || auth.uid()::text || '[_.]')
  )
);

-- Policy 2: Users can update their own avatar
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

-- Policy 3: Users can delete their own avatar
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

-- Policy 4: Anyone can view avatars (public read access)
CREATE POLICY "Avatar public access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatar');

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Verificar políticas creadas:
-- SELECT schemaname, tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename = 'objects' AND policyname LIKE '%Avatar%';
