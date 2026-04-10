-- Add cotizador_enabled flag to brokers table.
-- Controls whether a broker user has access to the cotizadores flow
-- with payment bypass and auto-assignment of their own broker ID.
-- Default false — Master must explicitly enable per broker.

ALTER TABLE brokers
  ADD COLUMN IF NOT EXISTS cotizador_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN brokers.cotizador_enabled IS
  'When true, broker user has payment bypass + auto broker assignment in cotizadores. Master-controlled.';
