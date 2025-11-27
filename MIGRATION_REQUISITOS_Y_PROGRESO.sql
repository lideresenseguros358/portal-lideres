-- =====================================================
-- TABLAS: policy_requirements y workflow_steps
-- Descripción: Sistema completo de requisitos y progreso de trámites
-- Fecha: 2024-11-26
-- =====================================================

-- =====================================================
-- TABLA 1: policy_requirements (Actualizada con tipos)
-- =====================================================

CREATE TABLE IF NOT EXISTS policy_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ramo TEXT NOT NULL, -- AUTO, VIDA, VIDA_ASSA, SALUD, AP, HOGAR, PYME, INCENDIO, RC, TRANSPORTE, OTROS
  label TEXT NOT NULL, -- Nombre del requisito visible para usuario
  required BOOLEAN NOT NULL DEFAULT true, -- Si es obligatorio o opcional
  standard_name TEXT NOT NULL, -- Nombre estandarizado para archivos (sin espacios ni caracteres especiales)
  
  -- NUEVO: Tipo de requisito
  requirement_type TEXT NOT NULL DEFAULT 'DOCUMENTO', -- 'DOCUMENTO' o 'FORMULARIO'
  -- DOCUMENTO: Debe suministrarlo el cliente/broker (cédula, fotos, etc.)
  -- FORMULARIO: Existe en Descargas para descargar y completar
  
  -- Vínculos con Descargas (solo para FORMULARIO)
  linked_download_section UUID REFERENCES download_sections(id) ON DELETE SET NULL,
  linked_download_file UUID REFERENCES download_files(id) ON DELETE SET NULL,
  
  display_order INTEGER NOT NULL DEFAULT 999, -- Orden de visualización
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_policy_requirements_ramo ON policy_requirements(ramo);
CREATE INDEX IF NOT EXISTS idx_policy_requirements_type ON policy_requirements(requirement_type);
CREATE INDEX IF NOT EXISTS idx_policy_requirements_linked_section ON policy_requirements(linked_download_section) WHERE linked_download_section IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_policy_requirements_linked_file ON policy_requirements(linked_download_file) WHERE linked_download_file IS NOT NULL;

-- RLS
ALTER TABLE policy_requirements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Master puede ver todos los requisitos"
  ON policy_requirements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

CREATE POLICY "Broker puede ver todos los requisitos"
  ON policy_requirements FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'broker'));

CREATE POLICY "Solo Master puede insertar requisitos"
  ON policy_requirements FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

CREATE POLICY "Solo Master puede actualizar requisitos"
  ON policy_requirements FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

CREATE POLICY "Solo Master puede eliminar requisitos"
  ON policy_requirements FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

-- =====================================================
-- TABLA 2: workflow_steps (Pasos de proceso por ramo/tipo)
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ramo TEXT NOT NULL, -- AUTO, VIDA, VIDA_ASSA, etc.
  management_type TEXT NOT NULL, -- COTIZACION, EMISION, MODIFICACION, etc.
  step_number INTEGER NOT NULL, -- 1, 2, 3, etc.
  step_name TEXT NOT NULL, -- "Recepción de documentos", "Cotización", etc.
  step_description TEXT, -- Descripción detallada opcional
  estimated_days INTEGER DEFAULT 1, -- Días estimados para completar este paso
  display_order INTEGER NOT NULL DEFAULT 999,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ramo, management_type, step_number)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_workflow_steps_ramo ON workflow_steps(ramo);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_management_type ON workflow_steps(management_type);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_ramo_management ON workflow_steps(ramo, management_type);

-- RLS
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Master puede ver todos los pasos"
  ON workflow_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

CREATE POLICY "Broker puede ver todos los pasos"
  ON workflow_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'broker'));

CREATE POLICY "Solo Master puede insertar pasos"
  ON workflow_steps FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

CREATE POLICY "Solo Master puede actualizar pasos"
  ON workflow_steps FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

CREATE POLICY "Solo Master puede eliminar pasos"
  ON workflow_steps FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

-- =====================================================
-- TABLA 3: case_progress (Progreso actual de cada caso)
-- =====================================================

CREATE TABLE IF NOT EXISTS case_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  current_step_number INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  step_completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(case_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_case_progress_case_id ON case_progress(case_id);
CREATE INDEX IF NOT EXISTS idx_case_progress_step_number ON case_progress(current_step_number);

-- RLS
ALTER TABLE case_progress ENABLE ROW LEVEL SECURITY;

-- Policies (mismo que cases)
CREATE POLICY "Master puede ver todo el progreso"
  ON case_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

CREATE POLICY "Broker ve progreso de sus casos"
  ON case_progress FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cases 
      JOIN brokers ON cases.broker_id = brokers.id
      WHERE cases.id = case_progress.case_id 
      AND brokers.p_id = auth.uid()
    )
  );

CREATE POLICY "Master puede insertar progreso"
  ON case_progress FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

CREATE POLICY "Master puede actualizar progreso"
  ON case_progress FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

-- =====================================================
-- DATOS INICIALES: Requisitos por Ramo
-- =====================================================

-- AUTO
INSERT INTO policy_requirements (ramo, label, required, standard_name, requirement_type, display_order) VALUES
  ('AUTO', 'Cédula del asegurado', true, 'cedula_asegurado', 'DOCUMENTO', 1),
  ('AUTO', 'Licencia de conducir vigente', true, 'licencia_conducir', 'DOCUMENTO', 2),
  ('AUTO', 'Tarjeta de circulación', true, 'tarjeta_circulacion', 'DOCUMENTO', 3),
  ('AUTO', 'Formulario de solicitud', true, 'formulario_solicitud_auto', 'FORMULARIO', 4),
  ('AUTO', 'Fotos de inspección (8 fotos)', true, 'fotos_inspeccion', 'DOCUMENTO', 5),
  ('AUTO', 'Póliza anterior (opcional)', false, 'poliza_anterior', 'DOCUMENTO', 6);

-- VIDA
INSERT INTO policy_requirements (ramo, label, required, standard_name, requirement_type, display_order) VALUES
  ('VIDA', 'Cédula del asegurado', true, 'cedula_asegurado', 'DOCUMENTO', 1),
  ('VIDA', 'Formulario de solicitud firmado', true, 'formulario_solicitud_vida', 'FORMULARIO', 2),
  ('VIDA', 'Exámenes médicos (según monto)', false, 'examenes_medicos', 'DOCUMENTO', 3),
  ('VIDA', 'Declaración de salud', true, 'declaracion_salud', 'FORMULARIO', 4);

-- VIDA_ASSA
INSERT INTO policy_requirements (ramo, label, required, standard_name, requirement_type, display_order) VALUES
  ('VIDA_ASSA', 'Cédula del asegurado', true, 'cedula_asegurado', 'DOCUMENTO', 1),
  ('VIDA_ASSA', 'Solicitud ASSA Web', true, 'solicitud_assa_web', 'FORMULARIO', 2),
  ('VIDA_ASSA', 'Exámenes médicos (según monto)', false, 'examenes_medicos', 'DOCUMENTO', 3);

-- SALUD
INSERT INTO policy_requirements (ramo, label, required, standard_name, requirement_type, display_order) VALUES
  ('SALUD', 'Cédula del asegurado', true, 'cedula_asegurado', 'DOCUMENTO', 1),
  ('SALUD', 'Formulario de solicitud', true, 'formulario_solicitud_salud', 'FORMULARIO', 2),
  ('SALUD', 'Historial médico', true, 'historial_medico', 'DOCUMENTO', 3),
  ('SALUD', 'Declaración de salud', true, 'declaracion_salud', 'FORMULARIO', 4);

-- AP (Accidentes Personales)
INSERT INTO policy_requirements (ramo, label, required, standard_name, requirement_type, display_order) VALUES
  ('AP', 'Cédula del asegurado', true, 'cedula_asegurado', 'DOCUMENTO', 1),
  ('AP', 'Formulario de solicitud', true, 'formulario_solicitud_ap', 'FORMULARIO', 2),
  ('AP', 'Lista de asegurados (colectivo)', false, 'lista_asegurados', 'DOCUMENTO', 3);

-- INCENDIO
INSERT INTO policy_requirements (ramo, label, required, standard_name, requirement_type, display_order) VALUES
  ('INCENDIO', 'Cédula del propietario', true, 'cedula_propietario', 'DOCUMENTO', 1),
  ('INCENDIO', 'Formulario de solicitud', true, 'formulario_solicitud_incendio', 'FORMULARIO', 2),
  ('INCENDIO', 'Título de propiedad', true, 'titulo_propiedad', 'DOCUMENTO', 3),
  ('INCENDIO', 'Avalúo del inmueble', true, 'avaluo_inmueble', 'DOCUMENTO', 4),
  ('INCENDIO', 'Fotos del inmueble', true, 'fotos_inmueble', 'DOCUMENTO', 5);

-- =====================================================
-- DATOS INICIALES: Pasos de Workflow (Ejemplos)
-- =====================================================

-- AUTO - COTIZACION
INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order) VALUES
  ('AUTO', 'COTIZACION', 1, 'Recepción de solicitud', 'Cliente envía datos básicos del vehículo', 1, 1),
  ('AUTO', 'COTIZACION', 2, 'Generación de cotización', 'Se genera cotización con aseguradoras', 1, 2),
  ('AUTO', 'COTIZACION', 3, 'Envío al cliente', 'Se envía cotización al cliente para aprobación', 1, 3);

-- AUTO - EMISION
INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order) VALUES
  ('AUTO', 'EMISION', 1, 'Recepción de documentos', 'Cliente envía todos los documentos requeridos', 2, 1),
  ('AUTO', 'EMISION', 2, 'Validación de documentos', 'Verificación de documentos completos y correctos', 1, 2),
  ('AUTO', 'EMISION', 3, 'Inspección vehicular', 'Fotos de inspección recibidas y aprobadas', 1, 3),
  ('AUTO', 'EMISION', 4, 'Emisión en aseguradora', 'Envío a aseguradora para emisión', 2, 4),
  ('AUTO', 'EMISION', 5, 'Entrega de póliza', 'Póliza emitida y enviada al cliente', 1, 5);

-- VIDA_ASSA - EMISION
INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order) VALUES
  ('VIDA_ASSA', 'EMISION', 1, 'Recepción de solicitud', 'Cliente envía solicitud web ASSA', 1, 1),
  ('VIDA_ASSA', 'EMISION', 2, 'Validación de datos', 'Verificación de información del solicitante', 1, 2),
  ('VIDA_ASSA', 'EMISION', 3, 'Evaluación médica', 'Exámenes médicos si aplica según monto', 3, 3),
  ('VIDA_ASSA', 'EMISION', 4, 'Emisión automática ASSA', 'Sistema ASSA procesa y emite', 1, 4),
  ('VIDA_ASSA', 'EMISION', 5, 'Entrega de póliza', 'Póliza digital enviada al cliente', 1, 5);

-- SALUD - EMISION
INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order) VALUES
  ('SALUD', 'EMISION', 1, 'Recepción de solicitud', 'Cliente envía formulario y declaración', 1, 1),
  ('SALUD', 'EMISION', 2, 'Evaluación médica', 'Revisión de historial y exámenes', 3, 2),
  ('SALUD', 'EMISION', 3, 'Aprobación de aseguradora', 'Aseguradora aprueba o solicita más info', 2, 3),
  ('SALUD', 'EMISION', 4, 'Emisión de póliza', 'Generación de póliza y carnet', 2, 4),
  ('SALUD', 'EMISION', 5, 'Entrega y activación', 'Entrega de documentos y activación de cobertura', 1, 5);

-- MODIFICACION (Genérico - aplica a todos)
INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order) VALUES
  ('AUTO', 'MODIFICACION', 1, 'Solicitud de cambio', 'Cliente solicita modificación', 1, 1),
  ('AUTO', 'MODIFICACION', 2, 'Validación con aseguradora', 'Verificar si es posible la modificación', 1, 2),
  ('AUTO', 'MODIFICACION', 3, 'Emisión de endoso', 'Generación de endoso con cambios', 2, 3),
  ('AUTO', 'MODIFICACION', 4, 'Entrega', 'Envío de endoso al cliente', 1, 4);

-- Comentarios
COMMENT ON TABLE policy_requirements IS 'Requisitos de documentos/formularios por tipo de ramo';
COMMENT ON COLUMN policy_requirements.requirement_type IS 'DOCUMENTO: lo debe suministrar el cliente. FORMULARIO: está en Descargas para descargar';
COMMENT ON TABLE workflow_steps IS 'Pasos del proceso/workflow por ramo y tipo de gestión';
COMMENT ON TABLE case_progress IS 'Progreso actual de cada caso en el workflow';
