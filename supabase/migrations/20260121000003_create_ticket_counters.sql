-- ============================================
-- TICKET COUNTERS - Sistema de Numeración Posicional
-- ============================================
-- Formato: [AAMM][RAMO(2)][ASEG(2)][TRAMITE(1-2)][CORREL(3)]
-- Ejemplo: 2601010503001
-- Reinicia cada mes por combinación AAMM+ramo+aseg+tramite
-- ============================================

CREATE TABLE IF NOT EXISTS ticket_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Componentes del ticket
  aamm TEXT NOT NULL, -- '2601' para Enero 2026
  ramo_code TEXT NOT NULL, -- '01', '02', etc (2 dígitos)
  aseg_code TEXT NOT NULL, -- '01', '05', etc (2 dígitos)
  tramite_code TEXT NOT NULL, -- '1' o '01' (1-2 dígitos)
  
  -- Contador
  current INTEGER NOT NULL DEFAULT 0,
  
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint único por combinación
  UNIQUE(aamm, ramo_code, aseg_code, tramite_code)
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_ticket_counters_aamm ON ticket_counters(aamm);
CREATE INDEX IF NOT EXISTS idx_ticket_counters_combo ON ticket_counters(aamm, ramo_code, aseg_code, tramite_code);

-- ============================================
-- FUNCIÓN HELPER: Generar siguiente ticket
-- ============================================

CREATE OR REPLACE FUNCTION generate_next_ticket(
  p_aamm TEXT,
  p_ramo_code TEXT,
  p_aseg_code TEXT,
  p_tramite_code TEXT
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_current INTEGER;
  v_ticket TEXT;
BEGIN
  -- Upsert del counter (incrementar o crear)
  INSERT INTO ticket_counters (aamm, ramo_code, aseg_code, tramite_code, current, updated_at)
  VALUES (p_aamm, p_ramo_code, p_aseg_code, p_tramite_code, 1, NOW())
  ON CONFLICT (aamm, ramo_code, aseg_code, tramite_code)
  DO UPDATE SET 
    current = ticket_counters.current + 1,
    updated_at = NOW()
  RETURNING current INTO v_current;
  
  -- Construir ticket con padding
  -- Formato: AAMM (4) + RAMO (2) + ASEG (2) + TRAMITE (1-2) + CORREL (3)
  v_ticket := p_aamm || 
              LPAD(p_ramo_code, 2, '0') || 
              LPAD(p_aseg_code, 2, '0') || 
              p_tramite_code || -- Ya viene formateado (1 o 2 dígitos)
              LPAD(v_current::TEXT, 3, '0');
  
  RETURN v_ticket;
END;
$$;

-- ============================================
-- MASTER ROUTING CONFIG - Vacaciones y Backup
-- ============================================
-- Define qué master maneja cada bucket y quién es backup
-- ============================================

CREATE TABLE IF NOT EXISTS master_routing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Bucket de casos
  bucket TEXT NOT NULL UNIQUE,
  -- 'vida_personas' (Vida ASSA + Ramo Personas)
  -- 'ramos_generales'
  
  -- Masters asignados
  primary_master_user_id UUID NOT NULL, -- FK a profiles
  backup_master_user_id UUID NULL, -- FK a profiles (opcional)
  
  -- Estado de vacaciones
  primary_on_vacation BOOLEAN DEFAULT FALSE,
  
  -- Master efectivo (computed)
  -- Si primary_on_vacation=true => backup, else => primary
  effective_master_user_id UUID GENERATED ALWAYS AS (
    CASE 
      WHEN primary_on_vacation AND backup_master_user_id IS NOT NULL 
      THEN backup_master_user_id
      ELSE primary_master_user_id
    END
  ) STORED,
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint para buckets válidos
ALTER TABLE master_routing_config
  ADD CONSTRAINT master_routing_config_bucket_check
  CHECK (bucket IN ('vida_personas', 'ramos_generales'));

-- Insertar configuración inicial (solo si los usuarios existen)
DO $$
DECLARE
  v_lucia_id UUID;
  v_yira_id UUID;
BEGIN
  -- Buscar usuarios master
  SELECT id INTO v_lucia_id FROM profiles WHERE email ILIKE 'lucianieto@lideresenseguros.com' LIMIT 1;
  SELECT id INTO v_yira_id FROM profiles WHERE email ILIKE 'yiraramos@lideresenseguros.com' LIMIT 1;
  
  -- Insertar solo si se encontraron los usuarios
  IF v_lucia_id IS NOT NULL THEN
    INSERT INTO master_routing_config (bucket, primary_master_user_id, backup_master_user_id, primary_on_vacation)
    VALUES ('vida_personas', v_lucia_id, NULL, FALSE)
    ON CONFLICT (bucket) DO NOTHING;
  ELSE
    RAISE NOTICE 'Usuario lucianieto@lideresenseguros.com no encontrado - configuración pendiente';
  END IF;
  
  IF v_yira_id IS NOT NULL THEN
    INSERT INTO master_routing_config (bucket, primary_master_user_id, backup_master_user_id, primary_on_vacation)
    VALUES ('ramos_generales', v_yira_id, NULL, FALSE)
    ON CONFLICT (bucket) DO NOTHING;
  ELSE
    RAISE NOTICE 'Usuario yiraramos@lideresenseguros.com no encontrado - configuración pendiente';
  END IF;
END $$;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE ticket_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_routing_config ENABLE ROW LEVEL SECURITY;

-- Solo master puede ver counters
CREATE POLICY ticket_counters_master_all ON ticket_counters
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

-- Solo master puede ver routing config
CREATE POLICY master_routing_master_all ON master_routing_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'master'
    )
  );

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE ticket_counters IS 'Contadores para generación de tickets con formato posicional 12 dígitos';
COMMENT ON FUNCTION generate_next_ticket IS 'Genera siguiente ticket incrementando contador de manera atómica';
COMMENT ON TABLE master_routing_config IS 'Configuración de routing de casos a masters con soporte de vacaciones';
COMMENT ON COLUMN master_routing_config.effective_master_user_id IS 'Master efectivo considerando vacaciones (computed column)';
