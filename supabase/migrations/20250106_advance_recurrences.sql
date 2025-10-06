-- Crear tabla para adelantos recurrentes
CREATE TABLE IF NOT EXISTS advance_recurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_advance_recurrences_updated_at ON advance_recurrences;
CREATE TRIGGER update_advance_recurrences_updated_at
  BEFORE UPDATE ON advance_recurrences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índices
CREATE INDEX IF NOT EXISTS idx_advance_recurrences_broker ON advance_recurrences(broker_id);
CREATE INDEX IF NOT EXISTS idx_advance_recurrences_active ON advance_recurrences(is_active);

-- RLS Policies
ALTER TABLE advance_recurrences ENABLE ROW LEVEL SECURITY;

-- Masters pueden hacer todo
CREATE POLICY "Masters can manage advance_recurrences"
  ON advance_recurrences
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Brokers pueden ver sus propias recurrencias
CREATE POLICY "Brokers can view their own recurrences"
  ON advance_recurrences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      JOIN brokers ON brokers.p_id = profiles.id
      WHERE profiles.id = auth.uid()
      AND brokers.id = advance_recurrences.broker_id
    )
  );

-- Comentarios
COMMENT ON TABLE advance_recurrences IS 'Configuración de adelantos recurrentes mensuales';
COMMENT ON COLUMN advance_recurrences.amount IS 'Monto del adelanto recurrente';
COMMENT ON COLUMN advance_recurrences.reason IS 'Motivo del adelanto recurrente';
COMMENT ON COLUMN advance_recurrences.is_active IS 'Si la recurrencia está activa';
COMMENT ON COLUMN advance_recurrences.start_date IS 'Fecha de inicio de la recurrencia';
