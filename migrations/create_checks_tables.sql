-- ========================================
-- SISTEMA COMPLETO DE CHEQUES Y PAGOS
-- ========================================

-- ========================================
-- 1. HISTORIAL DE BANCO (Transferencias)
-- ========================================
CREATE TABLE IF NOT EXISTS public.bank_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  reference_number TEXT NOT NULL UNIQUE,
  transaction_code TEXT,
  description TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  used_amount NUMERIC(12,2) DEFAULT 0 CHECK (used_amount >= 0),
  remaining_amount NUMERIC(12,2) GENERATED ALWAYS AS (amount - used_amount) STORED,
  status TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN used_amount = 0 THEN 'available'
      WHEN used_amount < amount THEN 'partial'
      WHEN used_amount >= amount THEN 'exhausted'
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_bank_transfers_ref ON bank_transfers(reference_number);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_status ON bank_transfers(status);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_date ON bank_transfers(date DESC);

-- ========================================
-- 2. PAGOS PENDIENTES
-- ========================================
CREATE TABLE IF NOT EXISTS public.pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  client_name TEXT NOT NULL,
  policy_number TEXT,
  insurer_name TEXT,
  purpose TEXT NOT NULL CHECK (purpose IN ('poliza', 'devolucion', 'otro')),
  amount_to_pay NUMERIC(12,2) NOT NULL CHECK (amount_to_pay > 0),
  total_received NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  can_be_paid BOOLEAN DEFAULT false,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_pending_payments_client ON pending_payments(client_name);
CREATE INDEX IF NOT EXISTS idx_pending_payments_policy ON pending_payments(policy_number);

-- ========================================
-- 3. REFERENCIAS DE PAGO (1 pago → N referencias)
-- ========================================
CREATE TABLE IF NOT EXISTS public.payment_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES pending_payments(id) ON DELETE CASCADE,
  reference_number TEXT NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  amount_to_use NUMERIC(12,2) NOT NULL CHECK (amount_to_use > 0 AND amount_to_use <= amount),
  exists_in_bank BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_refs_payment ON payment_references(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_refs_reference ON payment_references(reference_number);

-- ========================================
-- 4. DETALLES DE PAGO (Historial de uso)
-- ========================================
CREATE TABLE IF NOT EXISTS public.payment_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_transfer_id UUID REFERENCES bank_transfers(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES pending_payments(id) ON DELETE SET NULL,
  policy_number TEXT,
  insurer_name TEXT,
  client_name TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('poliza', 'devolucion', 'otro')),
  amount_used NUMERIC(12,2) NOT NULL CHECK (amount_used > 0),
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_details_transfer ON payment_details(bank_transfer_id);
CREATE INDEX IF NOT EXISTS idx_payment_details_payment ON payment_details(payment_id);

-- ========================================
-- FUNCIONES Y TRIGGERS
-- ========================================

-- Función para validar referencias contra banco
CREATE OR REPLACE FUNCTION validate_payment_references()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar si la referencia existe en bank_transfers
  NEW.exists_in_bank := EXISTS (
    SELECT 1 FROM bank_transfers 
    WHERE reference_number = NEW.reference_number
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar referencias automáticamente
DROP TRIGGER IF EXISTS trg_validate_payment_refs ON payment_references;
CREATE TRIGGER trg_validate_payment_refs
  BEFORE INSERT OR UPDATE ON payment_references
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_references();

-- Función para actualizar can_be_paid en pending_payments
CREATE OR REPLACE FUNCTION update_can_be_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar el estado can_be_paid del pago
  UPDATE pending_payments
  SET 
    can_be_paid = NOT EXISTS (
      SELECT 1 FROM payment_references
      WHERE payment_id = NEW.payment_id
      AND exists_in_bank = false
    ),
    total_received = (
      SELECT COALESCE(SUM(amount), 0)
      FROM payment_references
      WHERE payment_id = NEW.payment_id
    )
  WHERE id = NEW.payment_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar can_be_paid automáticamente
DROP TRIGGER IF EXISTS trg_update_can_be_paid ON payment_references;
CREATE TRIGGER trg_update_can_be_paid
  AFTER INSERT OR UPDATE ON payment_references
  FOR EACH ROW
  EXECUTE FUNCTION update_can_be_paid();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Habilitar RLS
ALTER TABLE bank_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_details ENABLE ROW LEVEL SECURITY;

-- Policies para bank_transfers
CREATE POLICY "Masters pueden ver todo bank_transfers"
  ON bank_transfers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'master'
    )
  );

CREATE POLICY "Masters pueden insertar bank_transfers"
  ON bank_transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'master'
    )
  );

-- Policies para pending_payments (Master y Broker ven sus propios)
CREATE POLICY "Users pueden ver sus pending_payments"
  ON pending_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND (
        raw_user_meta_data->>'role' = 'master'
        OR created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Users pueden crear pending_payments"
  ON pending_payments FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users pueden actualizar sus pending_payments"
  ON pending_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND (
        raw_user_meta_data->>'role' = 'master'
        OR created_by = auth.uid()
      )
    )
  );

-- Policies para payment_references (heredan de pending_payments)
CREATE POLICY "Users pueden ver payment_references de sus pagos"
  ON payment_references FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pending_payments pp
      INNER JOIN auth.users u ON u.id = auth.uid()
      WHERE pp.id = payment_id
      AND (
        u.raw_user_meta_data->>'role' = 'master'
        OR pp.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Users pueden crear payment_references"
  ON payment_references FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pending_payments pp
      WHERE pp.id = payment_id
      AND pp.created_by = auth.uid()
    )
  );

-- Policies para payment_details
CREATE POLICY "Masters pueden ver todo payment_details"
  ON payment_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'master'
    )
  );

CREATE POLICY "Masters pueden insertar payment_details"
  ON payment_details FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.uid() = id
      AND raw_user_meta_data->>'role' = 'master'
    )
  );

-- ========================================
-- COMENTARIOS
-- ========================================

COMMENT ON TABLE bank_transfers IS 'Historial de transferencias bancarias importadas desde CSV';
COMMENT ON TABLE pending_payments IS 'Pagos pendientes de procesar';
COMMENT ON TABLE payment_references IS 'Referencias bancarias asociadas a pagos pendientes';
COMMENT ON TABLE payment_details IS 'Detalle de pagos procesados y asociados a transferencias';

COMMENT ON COLUMN bank_transfers.remaining_amount IS 'Calculado automáticamente: amount - used_amount';
COMMENT ON COLUMN bank_transfers.status IS 'Calculado automáticamente según used_amount';
COMMENT ON COLUMN pending_payments.can_be_paid IS 'true si todas las referencias existen en banco';
COMMENT ON COLUMN payment_references.exists_in_bank IS 'Validado automáticamente via trigger';
