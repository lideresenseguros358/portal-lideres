-- Migration: Update Cases/Pendientes Module
-- Description: Updates existing cases tables to match new requirements
-- Date: 2025-10-17
-- Note: Tables already exist, only updating/adding fields and enums

-- =====================================================
-- STEP 1: Update case_type_enum to add missing values
-- =====================================================

DO $$ 
BEGIN
  -- Add REHABILITACION if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'REHABILITACION' AND enumtypid = 'case_type_enum'::regtype) THEN
    ALTER TYPE case_type_enum ADD VALUE 'REHABILITACION';
  END IF;
  
  -- Add MODIFICACION if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MODIFICACION' AND enumtypid = 'case_type_enum'::regtype) THEN
    ALTER TYPE case_type_enum ADD VALUE 'MODIFICACION';
  END IF;
  
  -- Add CANCELACION if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CANCELACION' AND enumtypid = 'case_type_enum'::regtype) THEN
    ALTER TYPE case_type_enum ADD VALUE 'CANCELACION';
  END IF;
  
  -- Add CAMBIO_CORREDOR if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CAMBIO_CORREDOR' AND enumtypid = 'case_type_enum'::regtype) THEN
    ALTER TYPE case_type_enum ADD VALUE 'CAMBIO_CORREDOR';
  END IF;
  
  -- Add RECLAMO if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RECLAMO' AND enumtypid = 'case_type_enum'::regtype) THEN
    ALTER TYPE case_type_enum ADD VALUE 'RECLAMO';
  END IF;
  
  -- Add EMISION_EXPRESS if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'EMISION_EXPRESS' AND enumtypid = 'case_type_enum'::regtype) THEN
    ALTER TYPE case_type_enum ADD VALUE 'EMISION_EXPRESS';
  END IF;
END $$;

-- =====================================================
-- STEP 2: Update case_status_enum to add missing values
-- =====================================================

DO $$ 
BEGIN
  -- Add PENDIENTE_DOCUMENTACION if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENDIENTE_DOCUMENTACION' AND enumtypid = 'case_status_enum'::regtype) THEN
    ALTER TYPE case_status_enum ADD VALUE 'PENDIENTE_DOCUMENTACION';
  END IF;
  
  -- Add COTIZANDO if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COTIZANDO' AND enumtypid = 'case_status_enum'::regtype) THEN
    ALTER TYPE case_status_enum ADD VALUE 'COTIZANDO';
  END IF;
  
  -- Add RECHAZADO if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RECHAZADO' AND enumtypid = 'case_status_enum'::regtype) THEN
    ALTER TYPE case_status_enum ADD VALUE 'RECHAZADO';
  END IF;
  
  -- Add REVISAR_ORIGEN if not exists
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'REVISAR_ORIGEN' AND enumtypid = 'case_status_enum'::regtype) THEN
    ALTER TYPE case_status_enum ADD VALUE 'REVISAR_ORIGEN';
  END IF;
END $$;

-- =====================================================
-- STEP 3: Update case_section_enum to add NO_IDENTIFICADOS
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'NO_IDENTIFICADOS' AND enumtypid = 'case_section_enum'::regtype) THEN
    ALTER TYPE case_section_enum ADD VALUE 'NO_IDENTIFICADOS';
  END IF;
END $$;

-- =====================================================
-- STEP 4: Add missing columns to cases table if they don't exist
-- =====================================================

-- Add case_number if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'case_number') THEN
    ALTER TABLE public.cases ADD COLUMN case_number VARCHAR(20) UNIQUE;
  END IF;
END $$;

-- Add content_hash if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'content_hash') THEN
    ALTER TABLE public.cases ADD COLUMN content_hash VARCHAR(64);
  END IF;
END $$;

-- Add policy_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'policy_id') THEN
    ALTER TABLE public.cases ADD COLUMN policy_id UUID REFERENCES public.policies(id);
  END IF;
END $$;

-- Add admin_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'admin_id') THEN
    ALTER TABLE public.cases ADD COLUMN admin_id UUID REFERENCES public.profiles(id);
  END IF;
END $$;

-- Add adelanto_id if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'adelanto_id') THEN
    ALTER TABLE public.cases ADD COLUMN adelanto_id UUID;
  END IF;
END $$;

-- Add aplazar_reason if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'aplazar_reason') THEN
    ALTER TABLE public.cases ADD COLUMN aplazar_reason TEXT;
  END IF;
END $$;

-- Add deleted_reason if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'deleted_reason') THEN
    ALTER TABLE public.cases ADD COLUMN deleted_reason TEXT;
  END IF;
END $$;

-- Rename columns to match new naming convention
-- seen_by_broker -> visto
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_schema = 'public' 
             AND table_name = 'cases' 
             AND column_name = 'seen_by_broker') 
  AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_schema = 'public' 
                  AND table_name = 'cases' 
                  AND column_name = 'visto') THEN
    ALTER TABLE public.cases RENAME COLUMN seen_by_broker TO visto;
  END IF;
END $$;

-- Add visto_at and visto_by if not exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'visto_at') THEN
    ALTER TABLE public.cases ADD COLUMN visto_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'visto_by') THEN
    ALTER TABLE public.cases ADD COLUMN visto_by UUID REFERENCES public.profiles(id);
  END IF;
END $$;

-- =====================================================
-- STEP 5: Create broker_assistants table if not exists
-- =====================================================

CREATE TABLE IF NOT EXISTS public.broker_assistants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indices if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_broker_assistants_broker') THEN
    CREATE INDEX idx_broker_assistants_broker ON public.broker_assistants(broker_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_broker_assistants_email') THEN
    CREATE INDEX idx_broker_assistants_email ON public.broker_assistants(email) WHERE is_active = TRUE;
  END IF;
END $$;

-- =====================================================
-- STEP 6: Update function for case_number generation
-- =====================================================

CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT;
  next_num INT;
  new_number TEXT;
BEGIN
  -- Only generate if case_number is null or empty
  IF NEW.case_number IS NOT NULL AND NEW.case_number != '' THEN
    RETURN NEW;
  END IF;
  
  -- Get current year
  year_str := TO_CHAR(NOW(), 'YYYY');
  
  -- Get next number for this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(case_number FROM 'CASE-' || year_str || '-(\d+)') AS INT)
  ), 0) + 1
  INTO next_num
  FROM public.cases
  WHERE case_number LIKE 'CASE-' || year_str || '-%';
  
  -- Generate new number
  new_number := 'CASE-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
  
  NEW.case_number := new_number;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS cases_generate_number ON public.cases;
CREATE TRIGGER cases_generate_number
  BEFORE INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION generate_case_number();

-- =====================================================
-- STEP 7: Update RLS policies with correct role names (lowercase)
-- =====================================================

-- Drop and recreate policies with correct role names
DROP POLICY IF EXISTS "Brokers can view their own cases" ON public.cases;
CREATE POLICY "Brokers can view their own cases"
ON public.cases
FOR SELECT
TO authenticated
USING (
  broker_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'::role_enum
  )
);

DROP POLICY IF EXISTS "Brokers can update their own cases" ON public.cases;
CREATE POLICY "Brokers can update their own cases"
ON public.cases
FOR UPDATE
TO authenticated
USING (broker_id = auth.uid())
WITH CHECK (
  broker_id = auth.uid()
);

DROP POLICY IF EXISTS "Masters can do everything on cases" ON public.cases;
CREATE POLICY "Masters can do everything on cases"
ON public.cases
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'::role_enum
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'master'::role_enum
  )
);

-- Update case_checklist policies
DROP POLICY IF EXISTS "Users can view checklist from their cases" ON public.case_checklist;
CREATE POLICY "Users can view checklist from their cases"
ON public.case_checklist
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_checklist.case_id
    AND (
      cases.broker_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
    )
  )
);

DROP POLICY IF EXISTS "Users can update checklist on their cases" ON public.case_checklist;
CREATE POLICY "Users can update checklist on their cases"
ON public.case_checklist
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_checklist.case_id
    AND (
      cases.broker_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
    )
  )
);

DROP POLICY IF EXISTS "Masters can insert checklist items" ON public.case_checklist;
CREATE POLICY "Masters can insert checklist items"
ON public.case_checklist
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
);

DROP POLICY IF EXISTS "Masters can delete checklist items" ON public.case_checklist;
CREATE POLICY "Masters can delete checklist items"
ON public.case_checklist
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
);

-- Update case_files policies
DROP POLICY IF EXISTS "Users can view files from their cases" ON public.case_files;
CREATE POLICY "Users can view files from their cases"
ON public.case_files
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_files.case_id
    AND (
      cases.broker_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
    )
  )
);

DROP POLICY IF EXISTS "Users can upload files to their cases" ON public.case_files;
CREATE POLICY "Users can upload files to their cases"
ON public.case_files
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_files.case_id
    AND (
      cases.broker_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
    )
  )
);

DROP POLICY IF EXISTS "Only masters can delete files" ON public.case_files;
CREATE POLICY "Only masters can delete files"
ON public.case_files
FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
);

-- Update case_comments policies
DROP POLICY IF EXISTS "Users can view comments from their cases" ON public.case_comments;
CREATE POLICY "Users can view comments from their cases"
ON public.case_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_comments.case_id
    AND (
      cases.broker_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
    )
  )
);

DROP POLICY IF EXISTS "Users can add comments to their cases" ON public.case_comments;
CREATE POLICY "Users can add comments to their cases"
ON public.case_comments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_comments.case_id
    AND (
      cases.broker_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
    )
  )
);

-- Update case_history policies
DROP POLICY IF EXISTS "Users can view history from their cases" ON public.case_history;
CREATE POLICY "Users can view history from their cases"
ON public.case_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.cases
    WHERE cases.id = case_history.case_id
    AND (
      cases.broker_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
    )
  )
);

-- Enable RLS on broker_assistants
ALTER TABLE public.broker_assistants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters can manage assistants" ON public.broker_assistants;
CREATE POLICY "Masters can manage assistants"
ON public.broker_assistants
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
);

DROP POLICY IF EXISTS "Brokers can view their assistants" ON public.broker_assistants;
CREATE POLICY "Brokers can view their assistants"
ON public.broker_assistants
FOR SELECT
TO authenticated
USING (
  broker_id = auth.uid()
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'master'::role_enum)
);

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify enum updates
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'case_type_enum'::regtype ORDER BY enumlabel;
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'case_status_enum'::regtype ORDER BY enumlabel;
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'case_section_enum'::regtype ORDER BY enumlabel;
