-- Migration: Create avatar storage bucket and policies
-- Description: Creates the avatar bucket for profile photos with proper RLS policies

-- =====================================================
-- STEP 1: Create the bucket
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatar',
  'avatar',
  true,
  2097152, -- 2MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- =====================================================
-- STEP 2: Drop existing policies if any
-- =====================================================
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatar upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar update policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar delete policy" ON storage.objects;
DROP POLICY IF EXISTS "Avatar public access" ON storage.objects;

-- =====================================================
-- STEP 3: Create RLS policies
-- =====================================================

-- Policy 1: Users can upload their own avatar (in their own folder or root with their ID prefix)
CREATE POLICY "Avatar upload policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatar' 
  AND (
    -- Allow files in user's folder: userId/filename.ext
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Allow files in root starting with userId_: userId_timestamp.ext
    (name ~ ('^' || auth.uid()::text || '_'))
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
    (name ~ ('^' || auth.uid()::text || '_'))
  )
)
WITH CHECK (
  bucket_id = 'avatar' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (name ~ ('^' || auth.uid()::text || '_'))
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
    (name ~ ('^' || auth.uid()::text || '_'))
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
-- Run these queries to verify the setup:
-- SELECT * FROM storage.buckets WHERE id = 'avatar';
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%Avatar%';
