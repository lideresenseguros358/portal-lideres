-- Tabla de datos de producción mensual por broker
CREATE TABLE IF NOT EXISTS production_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month TEXT NOT NULL CHECK (month IN ('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec')),
  bruto DECIMAL(12,2) DEFAULT 0 NOT NULL CHECK (bruto >= 0),
  canceladas DECIMAL(12,2) DEFAULT 0 NOT NULL CHECK (canceladas >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: unique per broker, year, month
  UNIQUE(broker_id, year, month),
  
  -- Constraint: Canceladas <= Bruto
  CONSTRAINT canceladas_le_bruto CHECK (canceladas <= bruto)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_production_data_broker_year ON production_data(broker_id, year);
CREATE INDEX IF NOT EXISTS idx_production_data_year ON production_data(year);
CREATE INDEX IF NOT EXISTS idx_production_data_broker ON production_data(broker_id);

-- Tabla de configuración de concursos (usando app_settings existente)
-- Solo insertar si no existe
INSERT INTO app_settings (key, value, description, created_at, updated_at)
VALUES 
  ('production.contests.assa', 
   '{"start_month": 1, "end_month": 12, "goal": 250000}'::jsonb,
   'Configuración del Concurso ASSA',
   NOW(),
   NOW()),
  ('production.contests.convivio', 
   '{"start_month": 1, "end_month": 6, "goal": 150000}'::jsonb,
   'Configuración del Convivio LISSA',
   NOW(),
   NOW())
ON CONFLICT (key) DO NOTHING;

-- RLS Policies para production_data
ALTER TABLE production_data ENABLE ROW LEVEL SECURITY;

-- Master puede ver y editar todo
CREATE POLICY "Masters can view all production data"
  ON production_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can insert production data"
  ON production_data FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

CREATE POLICY "Masters can update production data"
  ON production_data FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Brokers solo pueden ver su propia producción
CREATE POLICY "Brokers can view their own production data"
  ON production_data FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'broker'
      AND profiles.broker_id = production_data.broker_id
    )
  );

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_production_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS production_data_updated_at ON production_data;
CREATE TRIGGER production_data_updated_at
  BEFORE UPDATE ON production_data
  FOR EACH ROW
  EXECUTE FUNCTION update_production_data_updated_at();

-- Comentarios
COMMENT ON TABLE production_data IS 'Datos de producción mensual por broker para cálculos de PMA Bruto, Canceladas y PMA Neto';
COMMENT ON COLUMN production_data.bruto IS 'Producción bruta del mes';
COMMENT ON COLUMN production_data.canceladas IS 'Cancelaciones del mes (siempre <= bruto)';
COMMENT ON COLUMN production_data.month IS 'Mes en formato abreviado (jan, feb, mar, ...)';
