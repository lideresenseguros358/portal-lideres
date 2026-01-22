-- ============================================
-- UPDATE CASES TABLE - Sistema AI + Tickets Posicionales
-- ============================================
-- Actualiza tabla cases existente con nuevas columnas
-- para sistema de tickets posicionales, estados simplificados,
-- SLA pausable y vinculación con correos
-- ============================================

-- Agregar columnas nuevas para sistema de tickets posicionales
DO $$ 
BEGIN
  -- Ticket con formato posicional AAMM+RAMO+ASEG+TRAMITE+CORREL
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'ticket') THEN
    ALTER TABLE public.cases ADD COLUMN ticket TEXT UNIQUE;
  END IF;
  
  -- Códigos de clasificación AI (2 dígitos cada uno)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'ramo_code') THEN
    ALTER TABLE public.cases ADD COLUMN ramo_code TEXT; -- '01', '02', etc
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'aseguradora_code') THEN
    ALTER TABLE public.cases ADD COLUMN aseguradora_code TEXT; -- '01', '05', etc
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'tramite_code') THEN
    ALTER TABLE public.cases ADD COLUMN tramite_code TEXT; -- '1', '01', etc
  END IF;
  
  -- Bucket de clasificación AI
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'ramo_bucket') THEN
    ALTER TABLE public.cases ADD COLUMN ramo_bucket TEXT; 
    -- 'vida_assa' | 'ramos_generales' | 'ramo_personas' | 'desconocido'
  END IF;
  
  -- Estado simplificado (string en lugar de enum por flexibilidad)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'estado_simple') THEN
    ALTER TABLE public.cases ADD COLUMN estado_simple TEXT DEFAULT 'Nuevo';
    -- 'Nuevo' | 'En proceso' | 'Pendiente cliente' | 'Pendiente broker' | 
    -- 'Enviado' | 'Aplazado' | 'Cerrado aprobado' | 'Cerrado rechazado' | 'Sin clasificar'
  END IF;
  
  -- SLA tracking con pausa
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'sla_due_date') THEN
    ALTER TABLE public.cases ADD COLUMN sla_due_date TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'sla_paused_at') THEN
    ALTER TABLE public.cases ADD COLUMN sla_paused_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'sla_accumulated_pause_hours') THEN
    ALTER TABLE public.cases ADD COLUMN sla_accumulated_pause_hours INTEGER DEFAULT 0;
  END IF;
  
  -- Aplazado tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'aplazado_until') THEN
    ALTER TABLE public.cases ADD COLUMN aplazado_until DATE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'aplazado_months') THEN
    ALTER TABLE public.cases ADD COLUMN aplazado_months INTEGER;
  END IF;
  
  -- Clasificación AI metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'ai_classification') THEN
    ALTER TABLE public.cases ADD COLUMN ai_classification JSONB;
    -- Guarda resultado completo de Vertex AI
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'ai_confidence') THEN
    ALTER TABLE public.cases ADD COLUMN ai_confidence NUMERIC(3,2); -- 0.00 a 1.00
  END IF;
  
  -- Campos faltantes detectados por AI
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'missing_fields') THEN
    ALTER TABLE public.cases ADD COLUMN missing_fields JSONB;
    -- Array: ['aseguradora','tramite','tipo_poliza','broker']
  END IF;
  
  -- Flags especiales detectados por AI
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'special_flags') THEN
    ALTER TABLE public.cases ADD COLUMN special_flags JSONB;
    -- Ej: ['cambio_corredor_sin_poliza','adjuntos_sueltos','solo_pdf']
  END IF;
  
  -- Master asignado (puede diferir de admin_id si hay routing por vacaciones)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'assigned_master_id') THEN
    ALTER TABLE public.cases ADD COLUMN assigned_master_id UUID REFERENCES public.profiles(id);
  END IF;
  
  -- Broker detectado por AI (puede diferir del creador)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'detected_broker_email') THEN
    ALTER TABLE public.cases ADD COLUMN detected_broker_email TEXT;
  END IF;
  
  -- Caso del cual deriva (si fue reabierto desde Aplazado)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'derived_from_case_id') THEN
    ALTER TABLE public.cases ADD COLUMN derived_from_case_id UUID REFERENCES public.cases(id);
  END IF;
  
  -- Número de póliza generado (solo si tramite=Emisión y cerrado aprobado)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'generated_policy_number') THEN
    ALTER TABLE public.cases ADD COLUMN generated_policy_number TEXT;
  END IF;
  
  -- Cliente preliminar creado ID
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'cases' 
                 AND column_name = 'created_client_id') THEN
    ALTER TABLE public.cases ADD COLUMN created_client_id UUID REFERENCES public.clients(id);
  END IF;
  
END $$;

-- Crear índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_cases_ticket ON public.cases(ticket);
CREATE INDEX IF NOT EXISTS idx_cases_estado_simple ON public.cases(estado_simple);
CREATE INDEX IF NOT EXISTS idx_cases_ramo_bucket ON public.cases(ramo_bucket);
CREATE INDEX IF NOT EXISTS idx_cases_sla_due_date ON public.cases(sla_due_date) WHERE sla_due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_aplazado_until ON public.cases(aplazado_until) WHERE aplazado_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cases_assigned_master ON public.cases(assigned_master_id);
CREATE INDEX IF NOT EXISTS idx_cases_ramo_code ON public.cases(ramo_code);
CREATE INDEX IF NOT EXISTS idx_cases_aseguradora_code ON public.cases(aseguradora_code);

-- Agregar constraint FK para case_emails ahora que cases está actualizado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'case_emails_case_id_fkey'
    AND table_name = 'case_emails'
  ) THEN
    ALTER TABLE case_emails 
      ADD CONSTRAINT case_emails_case_id_fkey 
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Agregar constraint FK para case_history_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'case_history_events_case_id_fkey'
    AND table_name = 'case_history_events'
  ) THEN
    ALTER TABLE case_history_events 
      ADD CONSTRAINT case_history_events_case_id_fkey 
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- FUNCIÓN: Pausar SLA
-- ============================================

CREATE OR REPLACE FUNCTION pause_case_sla(p_case_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE cases
  SET sla_paused_at = NOW()
  WHERE id = p_case_id
    AND sla_paused_at IS NULL; -- Solo pausar si no está ya pausado
END;
$$;

-- ============================================
-- FUNCIÓN: Reanudar SLA
-- ============================================

CREATE OR REPLACE FUNCTION resume_case_sla(p_case_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_pause_duration INTERVAL;
  v_pause_hours INTEGER;
BEGIN
  SELECT sla_paused_at INTO v_pause_duration
  FROM cases
  WHERE id = p_case_id;
  
  IF v_pause_duration IS NOT NULL THEN
    -- Calcular horas pausadas
    v_pause_hours := EXTRACT(EPOCH FROM (NOW() - v_pause_duration)) / 3600;
    
    -- Acumular y limpiar pausa
    UPDATE cases
    SET 
      sla_accumulated_pause_hours = COALESCE(sla_accumulated_pause_hours, 0) + v_pause_hours,
      sla_paused_at = NULL,
      -- Extender due_date por las horas pausadas
      sla_due_date = sla_due_date + (v_pause_hours || ' hours')::INTERVAL
    WHERE id = p_case_id;
  END IF;
END;
$$;

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON COLUMN cases.ticket IS 'Ticket posicional formato AAMM+RAMO+ASEG+TRAMITE+CORREL (12 dígitos)';
COMMENT ON COLUMN cases.estado_simple IS 'Estado simplificado para UX tipo Monday';
COMMENT ON COLUMN cases.ramo_bucket IS 'Bucket de clasificación AI: vida_assa|ramos_generales|ramo_personas|desconocido';
COMMENT ON COLUMN cases.sla_paused_at IS 'Timestamp cuando se pausó SLA (Pendiente cliente/broker)';
COMMENT ON COLUMN cases.sla_accumulated_pause_hours IS 'Horas acumuladas de pausa en SLA';
COMMENT ON COLUMN cases.ai_classification IS 'Resultado completo de clasificación por Vertex AI';
COMMENT ON COLUMN cases.ai_confidence IS 'Confianza de clasificación AI (0.00 a 1.00)';
COMMENT ON COLUMN cases.missing_fields IS 'Campos faltantes detectados por AI';
COMMENT ON COLUMN cases.special_flags IS 'Flags especiales detectados por AI';
COMMENT ON COLUMN cases.derived_from_case_id IS 'Caso original si fue reabierto desde Aplazado';
COMMENT ON COLUMN cases.generated_policy_number IS 'Número de póliza generado al cerrar aprobado (solo Emisión)';
