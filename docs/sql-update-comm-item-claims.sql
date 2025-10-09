-- =====================================================
-- ACTUALIZACIÓN DE TABLA comm_item_claims
-- Sistema de Ajustes con Selección Múltiple y Pago
-- =====================================================

-- Agregar campos necesarios para el flujo completo
ALTER TABLE comm_item_claims
ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('now', 'next_fortnight')),
ADD COLUMN IF NOT EXISTS paid_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS fortnight_id UUID REFERENCES fortnights(id) ON DELETE SET NULL;

-- Agregar índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_comm_item_claims_status ON comm_item_claims(status);
CREATE INDEX IF NOT EXISTS idx_comm_item_claims_broker_status ON comm_item_claims(broker_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_item_claims_payment_type ON comm_item_claims(payment_type);
CREATE INDEX IF NOT EXISTS idx_comm_item_claims_fortnight ON comm_item_claims(fortnight_id);

-- Comentarios para documentación
COMMENT ON COLUMN comm_item_claims.payment_type IS 'Tipo de pago: "now" para pago inmediato, "next_fortnight" para siguiente quincena';
COMMENT ON COLUMN comm_item_claims.paid_date IS 'Fecha en que se confirmó el pago del ajuste';
COMMENT ON COLUMN comm_item_claims.rejection_reason IS 'Razón por la cual Master rechazó el ajuste';
COMMENT ON COLUMN comm_item_claims.fortnight_id IS 'ID de la quincena en la que se incluyó este ajuste (solo para payment_type = next_fortnight)';

-- =====================================================
-- VISTA HELPER: Claims con información completa
-- =====================================================
CREATE OR REPLACE VIEW v_claims_full AS
SELECT 
  c.*,
  ci.policy_number,
  ci.insured_name,
  ci.gross_amount as raw_amount,
  ci.insurer_id,
  ci.import_id,
  imp.period_label as fortnight_label,
  b.name as broker_name,
  b.percent_default as broker_percent,
  -- Cálculo de monto bruto (monto crudo × porcentaje broker)
  ci.gross_amount * (COALESCE(b.percent_default, 0) / 100.0) as broker_amount,
  b.bank_account_no,
  b.tipo_cuenta as account_type,
  b.national_id,
  b.nombre_completo,
  i.name as insurer_name,
  p.full_name as broker_full_name,
  p.email as broker_email
FROM comm_item_claims c
JOIN comm_items ci ON c.comm_item_id = ci.id
JOIN brokers b ON c.broker_id = b.id
JOIN profiles p ON b.p_id = p.id
LEFT JOIN insurers i ON ci.insurer_id = i.id
LEFT JOIN comm_imports imp ON ci.import_id = imp.id;

COMMENT ON VIEW v_claims_full IS 'Vista con toda la información de claims incluyendo cálculo de comisión broker';

-- =====================================================
-- FUNCIÓN: Obtener reportes agrupados por broker
-- =====================================================
CREATE OR REPLACE FUNCTION get_claims_reports_grouped()
RETURNS TABLE (
  broker_id UUID,
  broker_name TEXT,
  broker_email TEXT,
  total_raw_amount NUMERIC,
  total_broker_amount NUMERIC,
  item_count BIGINT,
  status TEXT,
  claims JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.broker_id,
    MAX(c.broker_name) as broker_name,
    MAX(c.broker_email) as broker_email,
    SUM(c.raw_amount) as total_raw_amount,
    SUM(c.broker_amount) as total_broker_amount,
    COUNT(*) as item_count,
    c.status,
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'comm_item_id', c.comm_item_id,
        'policy_number', c.policy_number,
        'insured_name', c.insured_name,
        'insurer_name', c.insurer_name,
        'raw_amount', c.raw_amount,
        'broker_percent', c.broker_percent,
        'broker_amount', c.broker_amount,
        'created_at', c.created_at
      ) ORDER BY c.created_at DESC
    ) as claims
  FROM v_claims_full c
  WHERE c.status IN ('pending', 'approved')
  GROUP BY c.broker_id, c.status
  ORDER BY MAX(c.created_at) DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_claims_reports_grouped IS 'Obtiene reportes de ajustes agrupados por broker con totales calculados';

-- =====================================================
-- FUNCIÓN: Aprobar claims y crear registros preliminares
-- =====================================================
CREATE OR REPLACE FUNCTION approve_claims_and_create_preliminary(
  p_claim_ids UUID[],
  p_payment_type TEXT,
  p_approved_by UUID
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  preliminary_count INTEGER
) AS $$
DECLARE
  v_claim_record RECORD;
  v_preliminary_count INTEGER := 0;
BEGIN
  -- Validar payment_type
  IF p_payment_type NOT IN ('now', 'next_fortnight') THEN
    RETURN QUERY SELECT FALSE, 'Tipo de pago inválido', 0;
    RETURN;
  END IF;

  -- Procesar cada claim
  FOR v_claim_record IN 
    SELECT 
      c.id as claim_id,
      c.comm_item_id,
      c.broker_id,
      ci.policy_number,
      ci.insured_name as client_name,
      ci.insurer_id
    FROM comm_item_claims c
    JOIN comm_items ci ON c.comm_item_id = ci.id
    WHERE c.id = ANY(p_claim_ids)
      AND c.status = 'pending'
  LOOP
    -- Actualizar claim
    UPDATE comm_item_claims
    SET 
      status = 'approved',
      payment_type = p_payment_type,
      resolved_at = NOW(),
      resolved_by = p_approved_by
    WHERE id = v_claim_record.claim_id;

    -- Crear registro preliminar
    INSERT INTO temp_client_import (
      client_name,
      policy_number,
      insurer_id,
      broker_id,
      source,
      source_id
    ) VALUES (
      v_claim_record.client_name,
      v_claim_record.policy_number,
      v_claim_record.insurer_id,
      v_claim_record.broker_id,
      'adjustment',
      v_claim_record.comm_item_id
    )
    ON CONFLICT (source, source_id) DO NOTHING; -- Evitar duplicados
    
    v_preliminary_count := v_preliminary_count + 1;
  END LOOP;

  RETURN QUERY SELECT TRUE, 'Claims aprobados exitosamente', v_preliminary_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION approve_claims_and_create_preliminary IS 'Aprueba claims y crea registros en temp_client_import';

-- =====================================================
-- FUNCIÓN: Rechazar claims
-- =====================================================
CREATE OR REPLACE FUNCTION reject_claims(
  p_claim_ids UUID[],
  p_rejection_reason TEXT,
  p_rejected_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE comm_item_claims
  SET 
    status = 'rejected',
    rejection_reason = p_rejection_reason,
    resolved_at = NOW(),
    resolved_by = p_rejected_by
  WHERE id = ANY(p_claim_ids)
    AND status = 'pending';
    
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reject_claims IS 'Rechaza claims con razón especificada';

-- =====================================================
-- FUNCIÓN: Confirmar pago de claims
-- =====================================================
CREATE OR REPLACE FUNCTION confirm_claims_paid(
  p_claim_ids UUID[]
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE comm_item_claims
  SET 
    status = 'paid',
    paid_date = NOW()
  WHERE id = ANY(p_claim_ids)
    AND status = 'approved'
    AND payment_type = 'now';
    
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION confirm_claims_paid IS 'Marca claims como pagados (solo para payment_type = now)';

-- =====================================================
-- FUNCIÓN: Obtener claims pendientes para siguiente quincena
-- =====================================================
CREATE OR REPLACE FUNCTION get_queued_claims_for_fortnight()
RETURNS TABLE (
  broker_id UUID,
  broker_name TEXT,
  broker_amount NUMERIC,
  claim_ids UUID[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.broker_id,
    MAX(c.broker_name) as broker_name,
    SUM(c.broker_amount) as broker_amount,
    array_agg(c.id) as claim_ids
  FROM v_claims_full c
  WHERE c.status = 'approved'
    AND c.payment_type = 'next_fortnight'
  GROUP BY c.broker_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_queued_claims_for_fortnight IS 'Obtiene claims aprobados pendientes de incluir en siguiente quincena';

-- =====================================================
-- TRIGGER: Notificar cuando se crea un nuevo claim
-- =====================================================
CREATE OR REPLACE FUNCTION notify_new_claim()
RETURNS TRIGGER AS $$
BEGIN
  -- Aquí se puede integrar con sistema de notificaciones
  -- Por ahora solo log
  RAISE NOTICE 'Nuevo claim creado: % por broker %', NEW.id, NEW.broker_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_new_claim ON comm_item_claims;
CREATE TRIGGER trigger_notify_new_claim
  AFTER INSERT ON comm_item_claims
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_claim();

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Tabla comm_item_claims actualizada correctamente';
  RAISE NOTICE '✅ Vista v_claims_full creada';
  RAISE NOTICE '✅ Funciones helper creadas';
  RAISE NOTICE '✅ Triggers configurados';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Próximo paso: Regenerar types con: npm run supabase:types';
END $$;
