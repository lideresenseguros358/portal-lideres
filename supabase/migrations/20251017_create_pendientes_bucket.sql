-- Migration: Create pendientes storage bucket
-- Description: Creates the pendientes bucket for case attachments with proper RLS policies
-- Date: 2025-10-17

-- =====================================================
-- STEP 1: Create the bucket
-- =====================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pendientes',
  'pendientes',
  true,
  10485760, -- 10MB in bytes
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

-- =====================================================
-- STEP 2: Drop existing policies if any
-- =====================================================
DROP POLICY IF EXISTS "Pendientes upload policy" ON storage.objects;
DROP POLICY IF EXISTS "Pendientes update policy" ON storage.objects;
DROP POLICY IF EXISTS "Pendientes delete policy" ON storage.objects;
DROP POLICY IF EXISTS "Pendientes public access" ON storage.objects;

-- =====================================================
-- STEP 3: Create RLS policies
-- =====================================================

-- Policy 1: Authenticated users can upload to pendientes
CREATE POLICY "Pendientes upload policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pendientes'
);

-- Policy 2: Users can update their own uploads (via case ownership)
CREATE POLICY "Pendientes update policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pendientes'
  AND (
    -- Allow masters to update anything
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'MASTER'
    )
    OR
    -- Allow brokers to update files from their cases
    EXISTS (
      SELECT 1 
      FROM public.case_files cf
      JOIN public.cases c ON c.id = cf.case_id
      WHERE cf.file_path = name
      AND c.broker_id = auth.uid()
    )
  )
);

-- Policy 3: Only masters can delete files
CREATE POLICY "Pendientes delete policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'pendientes'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'MASTER'
  )
);

-- Policy 4: Anyone can view pendientes files (public read access)
CREATE POLICY "Pendientes public access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'pendientes');

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Run these queries to verify the setup:
-- SELECT * FROM storage.buckets WHERE id = 'pendientes';
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%Pendientes%';
