-- Agregar columna de retención en fortnight_broker_totals
ALTER TABLE fortnight_broker_totals 
ADD COLUMN IF NOT EXISTS is_retained BOOLEAN DEFAULT false;

-- Crear tabla para comisiones retenidas (cuando se liberan/pagan)
CREATE TABLE IF NOT EXISTS retained_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  fortnight_id UUID NOT NULL REFERENCES fortnights(id) ON DELETE CASCADE,
  
  -- Totales originales de la quincena retenida
  gross_amount NUMERIC(12, 2) NOT NULL,
  discount_amount NUMERIC(12, 2) DEFAULT 0,
  net_amount NUMERIC(12, 2) NOT NULL,
  
  -- Estado: 'pending', 'paid_immediate', 'paid_in_fortnight', 'applied_to_advance'
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Si se pagó inmediatamente
  paid_at TIMESTAMPTZ,
  
  -- Si se aplicó a siguiente quincena
  applied_fortnight_id UUID REFERENCES fortnights(id) ON DELETE SET NULL,
  
  -- Si se aplicó a adelanto
  applied_advance_id UUID REFERENCES advances(id) ON DELETE SET NULL,
  
  -- Detalles por aseguradora (JSON array)
  insurers_detail JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_retained_commissions_broker ON retained_commissions(broker_id);
CREATE INDEX IF NOT EXISTS idx_retained_commissions_fortnight ON retained_commissions(fortnight_id);
CREATE INDEX IF NOT EXISTS idx_retained_commissions_status ON retained_commissions(status);
CREATE INDEX IF NOT EXISTS idx_fortnight_broker_totals_retained ON fortnight_broker_totals(is_retained);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_retained_commissions_updated_at ON retained_commissions;
CREATE TRIGGER update_retained_commissions_updated_at
  BEFORE UPDATE ON retained_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE retained_commissions ENABLE ROW LEVEL SECURITY;

-- Masters pueden hacer todo
CREATE POLICY "Masters can manage retained_commissions"
  ON retained_commissions
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

-- Brokers pueden ver sus propias retenciones
CREATE POLICY "Brokers can view their own retained_commissions"
  ON retained_commissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      JOIN brokers ON brokers.p_id = profiles.id
      WHERE profiles.id = auth.uid()
      AND brokers.id = retained_commissions.broker_id
    )
  );

-- Comentarios
COMMENT ON TABLE retained_commissions IS 'Comisiones retenidas que están pendientes de liberación o pago';
COMMENT ON COLUMN retained_commissions.status IS 'Estado: pending, paid_immediate, paid_in_fortnight, applied_to_advance';
COMMENT ON COLUMN retained_commissions.insurers_detail IS 'Detalle JSON de las comisiones por aseguradora';
COMMENT ON COLUMN fortnight_broker_totals.is_retained IS 'Indica si el pago fue retenido';
