-- =====================================================
-- MIGRATION: Adapt existing production table
-- Date: 2025-10-03
-- Description: Adapta la tabla production existente para el flujo de Producción
-- =====================================================

-- =====================================================
-- 1. AGREGAR COLUMNAS NECESARIAS (si no existen)
-- =====================================================

-- Columna broker_id (si no existe)
ALTER TABLE production 
ADD COLUMN IF NOT EXISTS broker_id UUID REFERENCES brokers(id) ON DELETE CASCADE;

-- Columna year (si no existe)
ALTER TABLE production 
ADD COLUMN IF NOT EXISTS year INTEGER;

-- Columna month ya existe como INTEGER (1-12)
-- No necesitamos agregarla, solo verificar que esté
-- ALTER TABLE production 
-- ADD COLUMN IF NOT EXISTS month INTEGER;

-- Columna bruto (si no existe)
ALTER TABLE production 
ADD COLUMN IF NOT EXISTS bruto DECIMAL(12,2) DEFAULT 0;

-- Columna canceladas (si no existe)
ALTER TABLE production 
ADD COLUMN IF NOT EXISTS canceladas DECIMAL(12,2) DEFAULT 0;

-- Columna pma_neto calculado (opcional, puede ser calculado on-the-fly)
ALTER TABLE production 
ADD COLUMN IF NOT EXISTS pma_neto DECIMAL(12,2) GENERATED ALWAYS AS (bruto - canceladas) STORED;

-- Timestamps
ALTER TABLE production 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE production 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- 2. AGREGAR CONSTRAINTS
-- =====================================================

-- Constraint: Canceladas <= Bruto
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'canceladas_le_bruto'
  ) THEN
    ALTER TABLE production 
    ADD CONSTRAINT canceladas_le_bruto CHECK (canceladas <= bruto);
  END IF;
END $$;

-- Constraint: Valores no negativos
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bruto_non_negative'
  ) THEN
    ALTER TABLE production 
    ADD CONSTRAINT bruto_non_negative CHECK (bruto >= 0);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'canceladas_non_negative'
  ) THEN
    ALTER TABLE production 
    ADD CONSTRAINT canceladas_non_negative CHECK (canceladas >= 0);
  END IF;
END $$;

-- Constraint: Month values válidos (1-12)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'month_valid_values'
  ) THEN
    ALTER TABLE production 
    ADD CONSTRAINT month_valid_values 
    CHECK (month >= 1 AND month <= 12);
  END IF;
END $$;

-- Constraint: Unique per broker, year, month
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_broker_year_month'
  ) THEN
    ALTER TABLE production 
    ADD CONSTRAINT unique_broker_year_month UNIQUE(broker_id, year, month);
  END IF;
END $$;

-- =====================================================
-- 3. CREAR ÍNDICES (si no existen)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_production_broker_year ON production(broker_id, year);
CREATE INDEX IF NOT EXISTS idx_production_year ON production(year);
CREATE INDEX IF NOT EXISTS idx_production_broker ON production(broker_id);
CREATE INDEX IF NOT EXISTS idx_production_month ON production(month);

-- =====================================================
-- 4. HABILITAR RLS
-- =====================================================

ALTER TABLE production ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. ELIMINAR POLICIES EXISTENTES (si existen)
-- =====================================================

DROP POLICY IF EXISTS "Masters can view all production" ON production;
DROP POLICY IF EXISTS "Masters can insert production" ON production;
DROP POLICY IF EXISTS "Masters can update production" ON production;
DROP POLICY IF EXISTS "Brokers can view their production" ON production;

-- =====================================================
-- 6. CREAR POLICIES
-- =====================================================

-- Master puede ver todo
CREATE POLICY "Masters can view all production"
  ON production FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Master puede insertar
CREATE POLICY "Masters can insert production"
  ON production FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Master puede actualizar
CREATE POLICY "Masters can update production"
  ON production FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Broker solo puede ver su propia producción
CREATE POLICY "Brokers can view their production"
  ON production FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'broker'
      AND profiles.broker_id = production.broker_id
    )
  );

-- =====================================================
-- 7. TRIGGER PARA UPDATED_AT
-- =====================================================

-- Crear función si no existe
CREATE OR REPLACE FUNCTION update_production_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Eliminar trigger si existe
DROP TRIGGER IF EXISTS production_updated_at ON production;

-- Crear trigger
CREATE TRIGGER production_updated_at
  BEFORE UPDATE ON production
  FOR EACH ROW
  EXECUTE FUNCTION update_production_updated_at();

-- =====================================================
-- 8. CONFIGURACIÓN DE CONCURSOS EN APP_SETTINGS
-- =====================================================

-- Insertar configuración de concursos si no existe
-- Nota: app_settings solo tiene 3 columnas: key, value, updated_at
INSERT INTO app_settings (key, value, updated_at)
VALUES 
  ('production.contests.assa', 
   '{"start_month": 1, "end_month": 12, "goal": 250000}'::jsonb,
   NOW()),
  ('production.contests.convivio', 
   '{"start_month": 1, "end_month": 6, "goal": 150000}'::jsonb,
   NOW())
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- 9. COMENTARIOS
-- =====================================================

COMMENT ON TABLE production IS 'Datos de producción mensual por broker para cálculos de PMA Bruto, Canceladas y PMA Neto';
COMMENT ON COLUMN production.broker_id IS 'Referencia al broker';
COMMENT ON COLUMN production.year IS 'Año de la producción';
COMMENT ON COLUMN production.month IS 'Mes en formato numérico (1-12, donde 1=Enero, 12=Diciembre)';
COMMENT ON COLUMN production.bruto IS 'Producción bruta del mes';
COMMENT ON COLUMN production.canceladas IS 'Cancelaciones del mes (siempre <= bruto)';
COMMENT ON COLUMN production.pma_neto IS 'PMA Neto calculado automáticamente (bruto - canceladas)';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

-- Verificar columnas agregadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'production' 
ORDER BY ordinal_position;

-- Verificar constraints
SELECT conname, contype, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'production'::regclass;

-- Verificar índices
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'production';

-- Verificar policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'production';

-- Verificar triggers
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'production';

-- Verificar configuración de concursos
SELECT key, value, updated_at 
FROM app_settings 
WHERE key LIKE 'production.contests%';
