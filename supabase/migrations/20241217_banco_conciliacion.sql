-- MIGRACIÓN: Módulo BANCO para conciliación bancaria de comisiones
-- Fecha: 2024-12-17
-- Autor: Sistema LISSA

-- ==============================================
-- 1. TABLA: bank_cutoffs (Cortes bancarios)
-- ==============================================
-- Representa cada corte/periodo de importación del banco
CREATE TABLE IF NOT EXISTS public.bank_cutoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id),
  CONSTRAINT unique_cutoff_dates UNIQUE(start_date, end_date)
);

CREATE INDEX idx_bank_cutoffs_dates ON public.bank_cutoffs(start_date, end_date);
CREATE INDEX idx_bank_cutoffs_created_at ON public.bank_cutoffs(created_at DESC);

-- ==============================================
-- 2. TABLA: bank_transfers_comm (Transferencias bancarias RAW)
-- ==============================================
-- Registro de cada transferencia del banco (intocable, RAW)
CREATE TABLE IF NOT EXISTS public.bank_transfers_comm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_id UUID REFERENCES bank_cutoffs(id) ON DELETE CASCADE,
  
  -- Datos RAW del banco (intocables)
  date DATE NOT NULL,
  reference_number TEXT NOT NULL,
  description_raw TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  
  -- Capa operativa (editable)
  insurer_assigned_id UUID REFERENCES insurers(id),
  transfer_type TEXT DEFAULT 'PENDING' CHECK (transfer_type IN ('REPORTE', 'BONO', 'OTRO', 'PENDIENTE')),
  notes_internal TEXT,
  
  -- Estado de conciliación
  status TEXT DEFAULT 'SIN_CLASIFICAR' CHECK (status IN ('SIN_CLASIFICAR', 'PENDIENTE', 'OK_CONCILIADO', 'PAGADO')),
  
  -- Metadatos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_transfer_reference UNIQUE(reference_number)
);

CREATE INDEX idx_bank_transfers_comm_cutoff ON public.bank_transfers_comm(cutoff_id);
CREATE INDEX idx_bank_transfers_comm_status ON public.bank_transfers_comm(status);
CREATE INDEX idx_bank_transfers_comm_date ON public.bank_transfers_comm(date DESC);
CREATE INDEX idx_bank_transfers_comm_reference ON public.bank_transfers_comm(reference_number);
CREATE INDEX idx_bank_transfers_comm_insurer ON public.bank_transfers_comm(insurer_assigned_id);

-- ==============================================
-- 3. TABLA: bank_groups (Grupos de transferencias)
-- ==============================================
-- Agrupa transferencias para matching con reportes
CREATE TABLE IF NOT EXISTS public.bank_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  
  -- Tipo de grupo (plantilla)
  group_template TEXT NOT NULL CHECK (group_template IN (
    'NORMAL',
    'ASSA_CODIGOS',
    'ASSA_PJ750',
    'ASSA_PJ750_1',
    'ASSA_PJ750_6',
    'ASSA_PJ750_9'
  )),
  
  -- Aseguradora objetivo (para imports)
  insurer_id UUID REFERENCES insurers(id),
  
  -- Clasificación VIDA/NO VIDA (para ASSA)
  is_life_insurance BOOLEAN,
  
  -- Total calculado del grupo
  total_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Estado del grupo
  status TEXT DEFAULT 'EN_PROCESO' CHECK (status IN ('EN_PROCESO', 'OK_CONCILIADO', 'PAGADO')),
  
  -- Quincena de pago (solo cuando PAGADO)
  fortnight_paid_id UUID REFERENCES fortnights(id),
  paid_at TIMESTAMPTZ,
  
  -- Metadatos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_bank_groups_status ON public.bank_groups(status);
CREATE INDEX idx_bank_groups_insurer ON public.bank_groups(insurer_id);
CREATE INDEX idx_bank_groups_fortnight ON public.bank_groups(fortnight_paid_id);

-- ==============================================
-- 4. TABLA: bank_group_transfers (Relación N:N)
-- ==============================================
-- Relaciona transferencias con grupos
CREATE TABLE IF NOT EXISTS public.bank_group_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES bank_groups(id) ON DELETE CASCADE,
  transfer_id UUID NOT NULL REFERENCES bank_transfers_comm(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_transfer_in_group UNIQUE(transfer_id)
);

CREATE INDEX idx_bank_group_transfers_group ON public.bank_group_transfers(group_id);
CREATE INDEX idx_bank_group_transfers_transfer ON public.bank_group_transfers(transfer_id);

-- ==============================================
-- 5. TABLA: bank_group_imports (Relación con reportes)
-- ==============================================
-- Relaciona grupos bancarios con imports de comisiones
CREATE TABLE IF NOT EXISTS public.bank_group_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES bank_groups(id) ON DELETE CASCADE,
  import_id UUID NOT NULL REFERENCES comm_imports(id) ON DELETE CASCADE,
  amount_assigned NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_group_import UNIQUE(group_id, import_id)
);

CREATE INDEX idx_bank_group_imports_group ON public.bank_group_imports(group_id);
CREATE INDEX idx_bank_group_imports_import ON public.bank_group_imports(import_id);

-- ==============================================
-- 6. TRIGGER: Actualizar updated_at
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bank_transfers_comm_updated_at
  BEFORE UPDATE ON bank_transfers_comm
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bank_groups_updated_at
  BEFORE UPDATE ON bank_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- 7. FUNCTION: Calcular total de grupo
-- ==============================================
CREATE OR REPLACE FUNCTION calculate_bank_group_total(p_group_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_total
  FROM bank_group_transfers bgt
  JOIN bank_transfers_comm t ON t.id = bgt.transfer_id
  WHERE bgt.group_id = p_group_id;
  
  UPDATE bank_groups
  SET total_amount = v_total
  WHERE id = p_group_id;
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- 8. RLS (Row Level Security) - Solo MASTER
-- ==============================================
ALTER TABLE bank_cutoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transfers_comm ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_group_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_group_imports ENABLE ROW LEVEL SECURITY;

-- Solo usuarios MASTER pueden ver y modificar
CREATE POLICY "Only MASTER can access bank_cutoffs"
  ON bank_cutoffs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Only MASTER can access bank_transfers_comm"
  ON bank_transfers_comm FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Only MASTER can access bank_groups"
  ON bank_groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Only MASTER can access bank_group_transfers"
  ON bank_group_transfers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Only MASTER can access bank_group_imports"
  ON bank_group_imports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- ==============================================
-- 9. MIGRACIÓN DE DATOS EXISTENTES (Temporal)
-- ==============================================
-- Crear un corte ficticio para quincenas existentes
-- Esto evita colisiones con el nuevo sistema

DO $$
DECLARE
  v_temp_cutoff_id UUID;
BEGIN
  -- Verificar si ya existe una quincena pagada (PAID)
  IF EXISTS (SELECT 1 FROM fortnights WHERE status = 'PAID' LIMIT 1) THEN
    -- Crear un corte temporal para datos pre-BANCO
    INSERT INTO bank_cutoffs (start_date, end_date, notes, created_at)
    VALUES (
      '2024-01-01',
      '2024-11-30',
      'CORTE TEMPORAL - Datos anteriores a la implementación del módulo BANCO. No tiene transferencias asociadas.',
      now()
    )
    ON CONFLICT (start_date, end_date) DO NOTHING
    RETURNING id INTO v_temp_cutoff_id;
    
    RAISE NOTICE 'Corte temporal creado para quincenas pre-BANCO: %', v_temp_cutoff_id;
  END IF;
END $$;

-- ==============================================
-- 10. COMENTARIOS PARA DOCUMENTACIÓN
-- ==============================================
COMMENT ON TABLE bank_cutoffs IS 'Cortes/periodos de importación del extracto bancario';
COMMENT ON TABLE bank_transfers_comm IS 'Transferencias bancarias RAW (intocables) con capa operativa';
COMMENT ON TABLE bank_groups IS 'Grupos de transferencias para matching con reportes de comisiones';
COMMENT ON TABLE bank_group_transfers IS 'Relación N:N entre grupos y transferencias';
COMMENT ON TABLE bank_group_imports IS 'Relación entre grupos bancarios y reportes importados de comisiones';

COMMENT ON COLUMN bank_transfers_comm.description_raw IS 'Descripción original del banco (intocable)';
COMMENT ON COLUMN bank_transfers_comm.insurer_assigned_id IS 'Aseguradora asignada operativamente (puede diferir del RAW)';
COMMENT ON COLUMN bank_transfers_comm.transfer_type IS 'Clasificación: REPORTE, BONO, OTRO, PENDIENTE';
COMMENT ON COLUMN bank_transfers_comm.status IS 'SIN_CLASIFICAR, PENDIENTE, OK_CONCILIADO, PAGADO';

COMMENT ON COLUMN bank_groups.group_template IS 'Tipo de plantilla: NORMAL, ASSA_CODIGOS, ASSA_PJ750_X';
COMMENT ON COLUMN bank_groups.is_life_insurance IS 'Clasificación VIDA/NO VIDA (requerido para ASSA)';
