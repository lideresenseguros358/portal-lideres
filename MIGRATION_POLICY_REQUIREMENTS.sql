-- =====================================================
-- TABLA: policy_requirements
-- Descripción: Requisitos de documentos por tipo de ramo
-- Fecha: 2024-11-26
-- =====================================================

CREATE TABLE IF NOT EXISTS policy_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ramo TEXT NOT NULL, -- AUTO, VIDA, VIDA_ASSA, SALUD, AP, HOGAR, PYME, INCENDIO, RC, TRANSPORTE, OTROS
  label TEXT NOT NULL, -- Nombre del requisito visible para usuario
  required BOOLEAN NOT NULL DEFAULT true, -- Si es obligatorio o opcional
  standard_name TEXT NOT NULL, -- Nombre estandarizado para archivos (sin espacios ni caracteres especiales)
  linked_download_section UUID REFERENCES download_sections(id) ON DELETE SET NULL, -- Vinculado con sección en Descargas
  linked_download_file UUID REFERENCES download_files(id) ON DELETE SET NULL, -- Vinculado con archivo específico en Descargas
  display_order INTEGER NOT NULL DEFAULT 999, -- Orden de visualización
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_policy_requirements_ramo ON policy_requirements(ramo);
CREATE INDEX IF NOT EXISTS idx_policy_requirements_linked_section ON policy_requirements(linked_download_section) WHERE linked_download_section IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_policy_requirements_linked_file ON policy_requirements(linked_download_file) WHERE linked_download_file IS NOT NULL;

-- RLS (Row Level Security)
ALTER TABLE policy_requirements ENABLE ROW LEVEL SECURITY;

-- Policy 1: Master puede ver todos los requisitos
CREATE POLICY "Master puede ver todos los requisitos"
  ON policy_requirements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Policy 2: Broker puede ver todos los requisitos (solo lectura)
CREATE POLICY "Broker puede ver todos los requisitos"
  ON policy_requirements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'broker'
    )
  );

-- Policy 3: Solo Master puede insertar requisitos
CREATE POLICY "Solo Master puede insertar requisitos"
  ON policy_requirements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Policy 4: Solo Master puede actualizar requisitos
CREATE POLICY "Solo Master puede actualizar requisitos"
  ON policy_requirements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Policy 5: Solo Master puede eliminar requisitos
CREATE POLICY "Solo Master puede eliminar requisitos"
  ON policy_requirements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Datos iniciales de ejemplo (AUTO)
INSERT INTO policy_requirements (ramo, label, required, standard_name, display_order) VALUES
  ('AUTO', 'Licencia de conducir', true, 'licencia_conducir', 1),
  ('AUTO', 'Cédula del conductor principal', true, 'cedula_conductor', 2),
  ('AUTO', 'Certificado de registro vehicular', true, 'certificado_registro', 3),
  ('AUTO', 'Inspección vehicular', false, 'inspeccion_vehicular', 4),
  ('AUTO', 'Fotos del vehículo', false, 'fotos_vehiculo', 5);

-- Datos iniciales de ejemplo (VIDA_ASSA)
INSERT INTO policy_requirements (ramo, label, required, standard_name, display_order) VALUES
  ('VIDA_ASSA', 'Cédula del asegurado', true, 'cedula_asegurado', 1),
  ('VIDA_ASSA', 'Solicitud firmada', true, 'solicitud_firmada', 2),
  ('VIDA_ASSA', 'Examen médico', false, 'examen_medico', 3);

-- Datos iniciales de ejemplo (SALUD)
INSERT INTO policy_requirements (ramo, label, required, standard_name, display_order) VALUES
  ('SALUD', 'Cédula del asegurado', true, 'cedula_asegurado', 1),
  ('SALUD', 'Solicitud de seguro', true, 'solicitud_seguro', 2),
  ('SALUD', 'Historia clínica', false, 'historia_clinica', 3),
  ('SALUD', 'Exámenes de laboratorio', false, 'examenes_laboratorio', 4);

COMMENT ON TABLE policy_requirements IS 'Requisitos de documentos necesarios por tipo de ramo de póliza';
COMMENT ON COLUMN policy_requirements.ramo IS 'Tipo de ramo: AUTO, VIDA, VIDA_ASSA, SALUD, AP, HOGAR, PYME, INCENDIO, RC, TRANSPORTE, OTROS';
COMMENT ON COLUMN policy_requirements.label IS 'Nombre descriptivo del requisito visible para el usuario';
COMMENT ON COLUMN policy_requirements.required IS 'Define si el documento es obligatorio (true) u opcional (false)';
COMMENT ON COLUMN policy_requirements.standard_name IS 'Nombre estandarizado sin espacios ni caracteres especiales para nombrar archivos';
COMMENT ON COLUMN policy_requirements.linked_download_section IS 'ID de la sección en download_sections a la que está vinculado (opcional)';
COMMENT ON COLUMN policy_requirements.linked_download_file IS 'ID del archivo en download_files al que está vinculado (opcional)';
COMMENT ON COLUMN policy_requirements.display_order IS 'Orden en que se muestra el requisito (menor = primero)';
