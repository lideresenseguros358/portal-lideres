-- ============================================================
-- ADM COT — Migration: All tables for the quotation admin module
-- Created: 2026-02-24
-- ============================================================

-- ┌─────────────────────────────────────────────┐
-- │ 1. COTIZACIONES LOG (Log General)           │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificación
  quote_ref     TEXT NOT NULL,                       -- ID visible en descargable
  -- Cliente
  client_name   TEXT NOT NULL,
  cedula        TEXT,
  email         TEXT,
  phone         TEXT,
  -- Tracking
  ip_address    TEXT,                                -- IP completa (enmascarada en UI)
  region        TEXT,                                -- ej: "Panamá Oeste"
  device        TEXT,                                -- ej: "Windows", "iOS", "Android"
  user_agent    TEXT,
  -- Cotización
  status        TEXT NOT NULL DEFAULT 'COTIZADA'     -- COTIZADA | EMITIDA | FALLIDA | ABANDONADA
    CHECK (status IN ('COTIZADA','EMITIDA','FALLIDA','ABANDONADA')),
  insurer       TEXT NOT NULL,                       -- ej: "INTERNACIONAL", "FEDPA"
  ramo          TEXT NOT NULL DEFAULT 'AUTO',        -- ej: "AUTO", "SALUD", "VIDA"
  coverage_type TEXT,                                -- ej: "Cobertura Completa", "Daños a Terceros"
  plan_name     TEXT,
  annual_premium NUMERIC(12,2),
  vehicle_info  JSONB,                               -- marca, modelo, año, placa, etc.
  quote_payload JSONB,                               -- raw payload completo
  -- Step tracking (abandono)
  last_step     TEXT,                                -- último step alcanzado
  steps_log     JSONB,                               -- [{step, ts}]
  -- Timestamps
  quoted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  emitted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adm_cot_quotes_status ON adm_cot_quotes(status);
CREATE INDEX idx_adm_cot_quotes_insurer ON adm_cot_quotes(insurer);
CREATE INDEX idx_adm_cot_quotes_ramo ON adm_cot_quotes(ramo);
CREATE INDEX idx_adm_cot_quotes_quoted_at ON adm_cot_quotes(quoted_at);
CREATE INDEX idx_adm_cot_quotes_cedula ON adm_cot_quotes(cedula);

-- ┌─────────────────────────────────────────────┐
-- │ 2. EXPEDIENTES DE EMISIÓN                   │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_expedientes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        UUID REFERENCES adm_cot_quotes(id) ON DELETE SET NULL,
  -- Póliza
  nro_poliza      TEXT,
  insurer         TEXT NOT NULL,
  ramo            TEXT NOT NULL DEFAULT 'AUTO',
  coverage_type   TEXT,
  -- Cliente
  client_name     TEXT NOT NULL,
  cedula          TEXT,
  email           TEXT,
  phone           TEXT,
  -- Vehículo / objeto asegurado
  asset_info      JSONB,                             -- marca, modelo, placa, chasis, etc.
  -- Prima
  annual_premium  NUMERIC(12,2),
  payment_method  TEXT,                              -- contado, cuotas
  installments    INT DEFAULT 1,
  -- Documentos (rutas en storage bucket)
  documents       JSONB DEFAULT '[]'::jsonb,         -- [{name, path, type, size, uploaded_at}]
  -- Firma digital
  signature_url   TEXT,                              -- ruta en storage o data-url
  signature_at    TIMESTAMPTZ,
  -- Aceptación de veracidad
  veracidad_accepted BOOLEAN DEFAULT false,
  veracidad_ip       TEXT,
  veracidad_at       TIMESTAMPTZ,
  veracidad_user_agent TEXT,
  -- Auditoría
  audit_log       JSONB DEFAULT '[]'::jsonb,         -- [{action, by, at, detail}]
  -- Tracking
  ip_address      TEXT,
  region          TEXT,
  user_agent      TEXT,
  -- Timestamps
  emitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adm_cot_expedientes_nro ON adm_cot_expedientes(nro_poliza);
CREATE INDEX idx_adm_cot_expedientes_insurer ON adm_cot_expedientes(insurer);
CREATE INDEX idx_adm_cot_expedientes_cedula ON adm_cot_expedientes(cedula);
CREATE INDEX idx_adm_cot_expedientes_emitted ON adm_cot_expedientes(emitted_at);

-- ┌─────────────────────────────────────────────┐
-- │ 3. PAGOS COT (Pagos de Cotizadores)         │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   UUID REFERENCES adm_cot_expedientes(id) ON DELETE SET NULL,
  quote_id        UUID REFERENCES adm_cot_quotes(id) ON DELETE SET NULL,
  -- Asegurado
  client_name     TEXT NOT NULL,
  cedula          TEXT,
  nro_poliza      TEXT,
  -- Monto
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'USD',
  -- Aseguradora
  insurer         TEXT NOT NULL,
  ramo            TEXT NOT NULL DEFAULT 'AUTO',
  -- Estado
  status          TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (status IN ('PENDIENTE','AGRUPADO','PAGADO','DEVOLUCION')),
  -- Agrupación
  group_id        UUID,                              -- FK a adm_cot_payment_groups si agrupado
  -- Origen del pago
  payment_source  TEXT,                              -- ej: "PagueloFacil", "Transferencia"
  payment_ref     TEXT,                              -- referencia de pago externo
  payment_date    DATE,
  -- Recurrencia
  is_recurring    BOOLEAN DEFAULT false,
  recurrence_id   UUID,                              -- FK a adm_cot_recurrences
  installment_num INT,                               -- ej: cuota 3 de 12
  -- Devolución
  is_refund       BOOLEAN DEFAULT false,
  refund_bank     TEXT,
  refund_account  TEXT,
  refund_account_type TEXT,                          -- Ahorro, Corriente
  refund_reason   TEXT,
  -- Metadata
  notes           JSONB,
  created_by      UUID,                              -- profile_id del master que lo creó
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adm_cot_payments_status ON adm_cot_payments(status);
CREATE INDEX idx_adm_cot_payments_insurer ON adm_cot_payments(insurer);
CREATE INDEX idx_adm_cot_payments_group ON adm_cot_payments(group_id);
CREATE INDEX idx_adm_cot_payments_poliza ON adm_cot_payments(nro_poliza);

-- ┌─────────────────────────────────────────────┐
-- │ 4. AGRUPACIONES DE PAGO                     │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_payment_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referencia bancaria (se asigna al agrupar, no por ítem)
  bank_reference  TEXT,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'PENDIENTE'
    CHECK (status IN ('PENDIENTE','PARCIAL','PAGADO')),
  -- Puede mezclar aseguradoras
  insurers        TEXT[] DEFAULT '{}',               -- lista de aseguradoras en el grupo
  payment_date    DATE,
  notes           TEXT,
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ┌─────────────────────────────────────────────┐
-- │ 5. HISTORIAL BANCO                          │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_bank_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID REFERENCES adm_cot_payment_groups(id) ON DELETE SET NULL,
  -- Referencia
  bank_reference  TEXT NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  transfer_date   DATE,
  -- Detalle
  payments        JSONB DEFAULT '[]'::jsonb,         -- [{payment_id, client, poliza, amount}]
  is_refund       BOOLEAN DEFAULT false,
  -- Auditoría
  executed_by     UUID,                              -- profile_id del master
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adm_cot_bank_ref ON adm_cot_bank_history(bank_reference);

-- ┌─────────────────────────────────────────────┐
-- │ 6. RECURRENCIAS                             │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_recurrences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expediente_id   UUID REFERENCES adm_cot_expedientes(id) ON DELETE SET NULL,
  nro_poliza      TEXT,
  client_name     TEXT NOT NULL,
  cedula          TEXT,
  insurer         TEXT NOT NULL,
  -- Configuración
  total_installments INT NOT NULL DEFAULT 1,         -- total de cuotas
  frequency       TEXT NOT NULL DEFAULT 'MENSUAL'    -- MENSUAL | SEMESTRAL
    CHECK (frequency IN ('MENSUAL','SEMESTRAL')),
  installment_amount NUMERIC(12,2) NOT NULL,
  -- Estado
  status          TEXT NOT NULL DEFAULT 'ACTIVA'
    CHECK (status IN ('ACTIVA','PAUSADA','CANCELADA','COMPLETADA')),
  -- Fechas
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,                     -- no puede superar 1 año desde start
  next_due_date   DATE,
  -- Calendario generado
  schedule        JSONB DEFAULT '[]'::jsonb,         -- [{num, due_date, status, payment_id}]
  -- Cancelación
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    UUID,
  cancel_reason   TEXT,
  -- Metadata
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adm_cot_recurrences_next ON adm_cot_recurrences(next_due_date);
CREATE INDEX idx_adm_cot_recurrences_status ON adm_cot_recurrences(status);

-- ┌─────────────────────────────────────────────┐
-- │ 7. SEGUIMIENTO DE CHATS                     │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_chats (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Contacto
  phone           TEXT,
  email           TEXT,
  cedula          TEXT,
  session_id      TEXT,
  region          TEXT,
  -- Clasificación IA
  classification  TEXT DEFAULT 'CONSULTA'
    CHECK (classification IN ('CONSULTA','COTIZACION','SOPORTE','QUEJA','QUEJA_COMPLEJA')),
  -- Estado
  status          TEXT NOT NULL DEFAULT 'ABIERTO'
    CHECK (status IN ('ABIERTO','ESCALADO','CERRADO')),
  -- Escalamiento
  is_escalated    BOOLEAN DEFAULT false,
  escalation_reason TEXT,                            -- ej: "Amenaza legal", "Reclamo formal"
  escalation_email_sent BOOLEAN DEFAULT false,
  -- Resumen IA
  ai_summary      TEXT,
  -- Historial completo
  messages        JSONB DEFAULT '[]'::jsonb,         -- [{role, content, ts}]
  -- Tarea asociada
  task_id         UUID,                              -- referencia opcional a cases/pendientes
  -- Metadata
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_adm_cot_chats_status ON adm_cot_chats(status);
CREATE INDEX idx_adm_cot_chats_classification ON adm_cot_chats(classification);
CREATE INDEX idx_adm_cot_chats_session ON adm_cot_chats(session_id);
CREATE INDEX idx_adm_cot_chats_phone ON adm_cot_chats(phone);

-- ┌─────────────────────────────────────────────┐
-- │ 8. DASHBOARD KPIs (Materialized snapshots)  │
-- └─────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS adm_cot_kpi_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date   DATE NOT NULL,
  environment     TEXT NOT NULL DEFAULT 'development',
  -- KPIs
  quotes_today    INT DEFAULT 0,
  quotes_week     INT DEFAULT 0,
  quotes_month    INT DEFAULT 0,
  emissions_today INT DEFAULT 0,
  emissions_week  INT DEFAULT 0,
  emissions_month INT DEFAULT 0,
  conversion_rate NUMERIC(5,2) DEFAULT 0,            -- cotización → emisión %
  avg_time_to_emit NUMERIC(10,2) DEFAULT 0,          -- minutos promedio
  -- Por aseguradora (JSONB)
  by_insurer      JSONB DEFAULT '{}'::jsonb,         -- {FEDPA: {quotes, emissions}, IS: {...}}
  -- Por ramo
  by_ramo         JSONB DEFAULT '{}'::jsonb,
  -- Abandono por step
  abandonment     JSONB DEFAULT '[]'::jsonb,          -- [{step, count, pct}]
  -- Dispositivos
  by_device       JSONB DEFAULT '{}'::jsonb,          -- {Windows: 40, iOS: 30, ...}
  -- Regiones
  by_region       JSONB DEFAULT '{}'::jsonb,          -- {"Panamá": 50, "Chiriquí": 10, ...}
  -- Errores
  endpoint_errors JSONB DEFAULT '[]'::jsonb,          -- [{endpoint, count, last_error}]
  -- Pagos
  pending_payments_total NUMERIC(12,2) DEFAULT 0,
  payments_by_insurer    JSONB DEFAULT '{}'::jsonb,
  refunds_total          NUMERIC(12,2) DEFAULT 0,
  -- Heatmap data
  hourly_heatmap  JSONB DEFAULT '[]'::jsonb,          -- [{hour, day, count}]
  --
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_adm_cot_kpi_date_env ON adm_cot_kpi_snapshots(snapshot_date, environment);

-- ┌─────────────────────────────────────────────┐
-- │ RLS Policies — Master only                  │
-- └─────────────────────────────────────────────┘

ALTER TABLE adm_cot_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_payment_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_bank_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE adm_cot_kpi_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is master
CREATE OR REPLACE FUNCTION is_master()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'master'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Apply master-only policy to all ADM COT tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'adm_cot_quotes',
      'adm_cot_expedientes',
      'adm_cot_payments',
      'adm_cot_payment_groups',
      'adm_cot_bank_history',
      'adm_cot_recurrences',
      'adm_cot_chats',
      'adm_cot_kpi_snapshots'
    ])
  LOOP
    EXECUTE format(
      'CREATE POLICY master_all ON %I FOR ALL USING (is_master()) WITH CHECK (is_master())',
      tbl
    );
  END LOOP;
END $$;

-- ┌─────────────────────────────────────────────┐
-- │ Trigger: auto-update updated_at             │
-- └─────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION adm_cot_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'adm_cot_quotes',
      'adm_cot_expedientes',
      'adm_cot_payments',
      'adm_cot_payment_groups',
      'adm_cot_recurrences',
      'adm_cot_chats'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION adm_cot_set_updated_at()',
      tbl, tbl
    );
  END LOOP;
END $$;
