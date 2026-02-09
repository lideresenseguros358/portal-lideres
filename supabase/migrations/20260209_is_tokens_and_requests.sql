-- ============================================
-- IS Tokens: Persistencia de token diario
-- ============================================
CREATE TABLE IF NOT EXISTS is_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  environment text NOT NULL CHECK (environment IN ('development', 'production')),
  daily_token text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  updated_by text DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment)
);

-- Index para lookup rápido por ambiente
CREATE INDEX IF NOT EXISTS idx_is_tokens_env ON is_tokens (environment);

-- ============================================
-- IS Requests: Deduplicación / idempotency
-- ============================================
CREATE TABLE IF NOT EXISTS is_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('development', 'production')),
  endpoint text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, success, error
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (idempotency_key, environment)
);

-- Index para lookup rápido
CREATE INDEX IF NOT EXISTS idx_is_requests_key ON is_requests (idempotency_key, environment);
-- Auto-cleanup: borrar requests > 24h
CREATE INDEX IF NOT EXISTS idx_is_requests_created ON is_requests (created_at);

-- ============================================
-- IS Circuit Breaker state (optional persistence)
-- ============================================
CREATE TABLE IF NOT EXISTS is_circuit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  environment text NOT NULL CHECK (environment IN ('development', 'production')),
  is_open boolean NOT NULL DEFAULT false,
  open_until timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  last_failure_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment)
);

-- Seed initial rows
INSERT INTO is_circuit (environment, is_open, failure_count)
VALUES ('development', false, 0), ('production', false, 0)
ON CONFLICT (environment) DO NOTHING;

-- ============================================
-- RLS: Solo acceso desde service_role (server-side)
-- ============================================
ALTER TABLE is_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE is_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE is_circuit ENABLE ROW LEVEL SECURITY;

-- Policies para service_role (server-side only)
CREATE POLICY "is_tokens_service" ON is_tokens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "is_requests_service" ON is_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "is_circuit_service" ON is_circuit FOR ALL USING (true) WITH CHECK (true);
