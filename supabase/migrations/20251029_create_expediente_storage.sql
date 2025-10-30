-- Migration: Create 'expediente' storage bucket
-- Date: 2025-10-29
-- Description: Creates storage bucket for client/policy documents (cedula, licencia, registro vehicular)

-- Create the expediente bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expediente',
  'expediente',
  false, -- private bucket
  10485760, -- 10MB limit per file
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the expediente bucket
-- Note: We drop existing policies first since CREATE POLICY doesn't support IF NOT EXISTS

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver expedientes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir expedientes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar expedientes" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar expedientes" ON storage.objects;

-- Policy 1: Allow authenticated users to view their own expediente files
CREATE POLICY "Usuarios autenticados pueden ver expedientes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expediente'
  AND (
    -- Masters can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
    OR
    -- Brokers can see files from their own clients
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.broker_id IN (
        SELECT broker_id FROM profiles WHERE profiles.id = auth.uid()
      )
      AND (storage.objects.name LIKE 'clients/' || clients.id || '/%')
    )
  )
);

-- Policy 2: Allow authenticated users to upload expediente files
CREATE POLICY "Usuarios autenticados pueden subir expedientes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expediente'
  AND (
    -- Masters can upload anywhere
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
    OR
    -- Brokers can upload for their own clients
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.broker_id IN (
        SELECT broker_id FROM profiles WHERE profiles.id = auth.uid()
      )
      AND (storage.objects.name LIKE 'clients/' || clients.id || '/%')
    )
  )
);

-- Policy 3: Allow authenticated users to update expediente files
CREATE POLICY "Usuarios autenticados pueden actualizar expedientes"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expediente'
  AND (
    -- Masters can update all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
    OR
    -- Brokers can update files from their own clients
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.broker_id IN (
        SELECT broker_id FROM profiles WHERE profiles.id = auth.uid()
      )
      AND (storage.objects.name LIKE 'clients/' || clients.id || '/%')
    )
  )
);

-- Policy 4: Allow authenticated users to delete expediente files
CREATE POLICY "Usuarios autenticados pueden eliminar expedientes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'expediente'
  AND (
    -- Masters can delete all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
    OR
    -- Brokers can delete files from their own clients
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.broker_id IN (
        SELECT broker_id FROM profiles WHERE profiles.id = auth.uid()
      )
      AND (storage.objects.name LIKE 'clients/' || clients.id || '/%')
    )
  )
);

-- Create a table to track expediente documents metadata
CREATE TABLE IF NOT EXISTS expediente_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('cedula', 'licencia', 'registro_vehicular', 'otros')),
  document_name VARCHAR(200), -- Nombre personalizado para documentos tipo "otros"
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_document_type_policy CHECK (
    (document_type IN ('cedula', 'licencia') AND policy_id IS NULL) OR
    (document_type = 'registro_vehicular' AND policy_id IS NOT NULL) OR
    (document_type = 'otros') -- 'otros' puede ser tanto de cliente como de póliza
  ),
  CONSTRAINT valid_otros_document_name CHECK (
    (document_type = 'otros' AND document_name IS NOT NULL AND LENGTH(document_name) > 0) OR
    (document_type != 'otros')
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expediente_documents_client_id ON expediente_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_expediente_documents_policy_id ON expediente_documents(policy_id);
CREATE INDEX IF NOT EXISTS idx_expediente_documents_document_type ON expediente_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_expediente_documents_uploaded_at ON expediente_documents(uploaded_at DESC);

-- Add RLS policies for expediente_documents table
ALTER TABLE expediente_documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Usuarios pueden ver documentos de expediente" ON expediente_documents;
DROP POLICY IF EXISTS "Usuarios pueden crear documentos de expediente" ON expediente_documents;
DROP POLICY IF EXISTS "Usuarios pueden actualizar documentos de expediente" ON expediente_documents;
DROP POLICY IF EXISTS "Usuarios pueden eliminar documentos de expediente" ON expediente_documents;

-- Policy: Users can view expediente documents
CREATE POLICY "Usuarios pueden ver documentos de expediente"
ON expediente_documents FOR SELECT
TO authenticated
USING (
  -- Masters can see all
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'
  )
  OR
  -- Brokers can see documents from their own clients
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = expediente_documents.client_id
    AND clients.broker_id IN (
      SELECT broker_id FROM profiles WHERE profiles.id = auth.uid()
    )
  )
);

-- Policy: Users can insert expediente documents
CREATE POLICY "Usuarios pueden crear documentos de expediente"
ON expediente_documents FOR INSERT
TO authenticated
WITH CHECK (
  -- Masters can insert all
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'
  )
  OR
  -- Brokers can insert for their own clients
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = expediente_documents.client_id
    AND clients.broker_id IN (
      SELECT broker_id FROM profiles WHERE profiles.id = auth.uid()
    )
  )
);

-- Policy: Users can update expediente documents
CREATE POLICY "Usuarios pueden actualizar documentos de expediente"
ON expediente_documents FOR UPDATE
TO authenticated
USING (
  -- Masters can update all
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'
  )
  OR
  -- Brokers can update documents from their own clients
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = expediente_documents.client_id
    AND clients.broker_id IN (
      SELECT broker_id FROM profiles WHERE profiles.id = auth.uid()
    )
  )
);

-- Policy: Users can delete expediente documents
CREATE POLICY "Usuarios pueden eliminar documentos de expediente"
ON expediente_documents FOR DELETE
TO authenticated
USING (
  -- Masters can delete all
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'
  )
  OR
  -- Brokers can delete documents from their own clients
  EXISTS (
    SELECT 1 FROM clients
    WHERE clients.id = expediente_documents.client_id
    AND clients.broker_id IN (
      SELECT broker_id FROM profiles WHERE profiles.id = auth.uid()
    )
  )
);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_expediente_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_expediente_documents_updated_at
BEFORE UPDATE ON expediente_documents
FOR EACH ROW
EXECUTE FUNCTION update_expediente_documents_updated_at();

-- Log the migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Created expediente storage bucket and expediente_documents table';
END $$;
