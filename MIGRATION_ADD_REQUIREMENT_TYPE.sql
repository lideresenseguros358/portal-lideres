-- =====================================================
-- MIGRACIÓN: Agregar requirement_type a tabla existente
-- =====================================================

-- 1. Agregar columna requirement_type si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'policy_requirements' 
        AND column_name = 'requirement_type'
    ) THEN
        ALTER TABLE policy_requirements 
        ADD COLUMN requirement_type TEXT NOT NULL DEFAULT 'DOCUMENTO';
        
        RAISE NOTICE 'Columna requirement_type agregada exitosamente';
    ELSE
        RAISE NOTICE 'Columna requirement_type ya existe, saltando...';
    END IF;
END $$;

-- 2. Agregar índice para requirement_type
CREATE INDEX IF NOT EXISTS idx_policy_requirements_type 
ON policy_requirements(requirement_type);

-- 3. Actualizar registros existentes según el nombre
-- Los que contienen "formulario" o "solicitud" serán FORMULARIO
UPDATE policy_requirements 
SET requirement_type = 'FORMULARIO'
WHERE LOWER(label) LIKE '%formulario%' 
   OR LOWER(label) LIKE '%solicitud%'
   OR LOWER(standard_name) LIKE '%formulario%'
   OR LOWER(standard_name) LIKE '%solicitud%';

-- 4. Crear tabla workflow_steps si no existe
CREATE TABLE IF NOT EXISTS workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ramo TEXT NOT NULL,
  management_type TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  step_description TEXT,
  estimated_days INTEGER DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 999,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(ramo, management_type, step_number)
);

CREATE INDEX IF NOT EXISTS idx_workflow_steps_ramo ON workflow_steps(ramo);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_management_type ON workflow_steps(management_type);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_ramo_management ON workflow_steps(ramo, management_type);

-- RLS para workflow_steps
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master puede ver todos los pasos" ON workflow_steps;
CREATE POLICY "Master puede ver todos los pasos"
  ON workflow_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

DROP POLICY IF EXISTS "Broker puede ver todos los pasos" ON workflow_steps;
CREATE POLICY "Broker puede ver todos los pasos"
  ON workflow_steps FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'broker'));

DROP POLICY IF EXISTS "Solo Master puede insertar pasos" ON workflow_steps;
CREATE POLICY "Solo Master puede insertar pasos"
  ON workflow_steps FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

DROP POLICY IF EXISTS "Solo Master puede actualizar pasos" ON workflow_steps;
CREATE POLICY "Solo Master puede actualizar pasos"
  ON workflow_steps FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

DROP POLICY IF EXISTS "Solo Master puede eliminar pasos" ON workflow_steps;
CREATE POLICY "Solo Master puede eliminar pasos"
  ON workflow_steps FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

-- 5. Crear tabla case_progress si no existe
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

CREATE INDEX IF NOT EXISTS idx_case_progress_case_id ON case_progress(case_id);
CREATE INDEX IF NOT EXISTS idx_case_progress_step_number ON case_progress(current_step_number);

-- RLS para case_progress
ALTER TABLE case_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master puede ver todo el progreso" ON case_progress;
CREATE POLICY "Master puede ver todo el progreso"
  ON case_progress FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

DROP POLICY IF EXISTS "Broker ve progreso de sus casos" ON case_progress;
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

DROP POLICY IF EXISTS "Master puede insertar progreso" ON case_progress;
CREATE POLICY "Master puede insertar progreso"
  ON case_progress FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

DROP POLICY IF EXISTS "Master puede actualizar progreso" ON case_progress;
CREATE POLICY "Master puede actualizar progreso"
  ON case_progress FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'master'));

-- 6. Insertar datos de ejemplo para workflow_steps (solo si no existen)
-- AUTO - COTIZACION
INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'AUTO', 'COTIZACION', 1, 'Recepción de solicitud', 'Cliente envía datos básicos del vehículo', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'AUTO' AND management_type = 'COTIZACION' AND step_number = 1);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'AUTO', 'COTIZACION', 2, 'Generación de cotización', 'Se genera cotización con aseguradoras', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'AUTO' AND management_type = 'COTIZACION' AND step_number = 2);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'AUTO', 'COTIZACION', 3, 'Envío al cliente', 'Se envía cotización al cliente para aprobación', 1, 3
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'AUTO' AND management_type = 'COTIZACION' AND step_number = 3);

-- AUTO - EMISION
INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'AUTO', 'EMISION', 1, 'Recepción de documentos', 'Cliente envía todos los documentos requeridos', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'AUTO' AND management_type = 'EMISION' AND step_number = 1);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'AUTO', 'EMISION', 2, 'Validación de documentos', 'Verificación de documentos completos y correctos', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'AUTO' AND management_type = 'EMISION' AND step_number = 2);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'AUTO', 'EMISION', 3, 'Inspección vehicular', 'Fotos de inspección recibidas y aprobadas', 1, 3
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'AUTO' AND management_type = 'EMISION' AND step_number = 3);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'AUTO', 'EMISION', 4, 'Emisión en aseguradora', 'Envío a aseguradora para emisión', 2, 4
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'AUTO' AND management_type = 'EMISION' AND step_number = 4);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'AUTO', 'EMISION', 5, 'Entrega de póliza', 'Póliza emitida y enviada al cliente', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'AUTO' AND management_type = 'EMISION' AND step_number = 5);

-- VIDA_ASSA - EMISION
INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'VIDA_ASSA', 'EMISION', 1, 'Recepción de solicitud', 'Cliente envía solicitud web ASSA', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'VIDA_ASSA' AND management_type = 'EMISION' AND step_number = 1);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'VIDA_ASSA', 'EMISION', 2, 'Validación de datos', 'Verificación de información del solicitante', 1, 2
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'VIDA_ASSA' AND management_type = 'EMISION' AND step_number = 2);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'VIDA_ASSA', 'EMISION', 3, 'Evaluación médica', 'Exámenes médicos si aplica según monto', 3, 3
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'VIDA_ASSA' AND management_type = 'EMISION' AND step_number = 3);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'VIDA_ASSA', 'EMISION', 4, 'Emisión automática ASSA', 'Sistema ASSA procesa y emite', 1, 4
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'VIDA_ASSA' AND management_type = 'EMISION' AND step_number = 4);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'VIDA_ASSA', 'EMISION', 5, 'Entrega de póliza', 'Póliza digital enviada al cliente', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'VIDA_ASSA' AND management_type = 'EMISION' AND step_number = 5);

-- SALUD - EMISION
INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'SALUD', 'EMISION', 1, 'Recepción de solicitud', 'Cliente envía formulario y declaración', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'SALUD' AND management_type = 'EMISION' AND step_number = 1);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'SALUD', 'EMISION', 2, 'Evaluación médica', 'Revisión de historial y exámenes', 3, 2
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'SALUD' AND management_type = 'EMISION' AND step_number = 2);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'SALUD', 'EMISION', 3, 'Aprobación de aseguradora', 'Aseguradora aprueba o solicita más info', 2, 3
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'SALUD' AND management_type = 'EMISION' AND step_number = 3);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'SALUD', 'EMISION', 4, 'Emisión de póliza', 'Generación de póliza y carnet', 2, 4
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'SALUD' AND management_type = 'EMISION' AND step_number = 4);

INSERT INTO workflow_steps (ramo, management_type, step_number, step_name, step_description, estimated_days, display_order)
SELECT 'SALUD', 'EMISION', 5, 'Entrega y activación', 'Entrega de documentos y activación de cobertura', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM workflow_steps WHERE ramo = 'SALUD' AND management_type = 'EMISION' AND step_number = 5);

-- Comentarios
COMMENT ON COLUMN policy_requirements.requirement_type IS 'DOCUMENTO: lo debe suministrar el cliente. FORMULARIO: está en Descargas para descargar';
COMMENT ON TABLE workflow_steps IS 'Pasos del proceso/workflow por ramo y tipo de gestión';
COMMENT ON TABLE case_progress IS 'Progreso actual de cada caso en el workflow';

-- Confirmar éxito
DO $$ 
BEGIN
    RAISE NOTICE '✓ Migración completada exitosamente';
    RAISE NOTICE '✓ Columna requirement_type agregada o ya existía';
    RAISE NOTICE '✓ Tablas workflow_steps y case_progress creadas';
    RAISE NOTICE '✓ Datos de ejemplo insertados';
END $$;
