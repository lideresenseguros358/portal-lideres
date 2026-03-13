-- Fix expediente_documents CHECK constraints to allow 'debida_diligencia' and 'carta_autorizacion' document types
-- These types are used by the emission flow (send-expediente) but were missing from the original migration.

-- 1. Drop the old CHECK constraint on document_type column
ALTER TABLE expediente_documents DROP CONSTRAINT IF EXISTS expediente_documents_document_type_check;

-- 2. Re-create with all valid types including debida_diligencia and carta_autorizacion
ALTER TABLE expediente_documents ADD CONSTRAINT expediente_documents_document_type_check
  CHECK (document_type IN ('cedula', 'licencia', 'registro_vehicular', 'carta_autorizacion', 'debida_diligencia', 'otros'));

-- 3. Drop the old valid_document_type_policy constraint
ALTER TABLE expediente_documents DROP CONSTRAINT IF EXISTS valid_document_type_policy;

-- 4. Re-create with debida_diligencia and carta_autorizacion as policy-level types
ALTER TABLE expediente_documents ADD CONSTRAINT valid_document_type_policy CHECK (
  (document_type IN ('cedula', 'licencia') AND policy_id IS NULL) OR
  (document_type IN ('registro_vehicular', 'carta_autorizacion', 'debida_diligencia') AND policy_id IS NOT NULL) OR
  (document_type = 'otros')
);

-- 5. Update valid_otros_document_name to also allow document_name for debida_diligencia
ALTER TABLE expediente_documents DROP CONSTRAINT IF EXISTS valid_otros_document_name;

ALTER TABLE expediente_documents ADD CONSTRAINT valid_otros_document_name CHECK (
  (document_type IN ('otros', 'debida_diligencia', 'carta_autorizacion') AND document_name IS NOT NULL AND LENGTH(document_name) > 0) OR
  (document_type NOT IN ('otros', 'debida_diligencia', 'carta_autorizacion'))
);
