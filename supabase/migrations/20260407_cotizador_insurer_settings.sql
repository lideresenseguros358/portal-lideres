-- Migration: Add cotizador_insurer_settings table for managing insurer visibility
-- Date: 2026-04-07
-- Purpose: Allow master users to enable/disable insurers separately for Daños a Terceros (tp_activo)
-- and Cobertura Completa (cc_activo) sections of the public cotizadores module

CREATE TABLE IF NOT EXISTS public.cotizador_insurer_settings (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT            NOT NULL UNIQUE,       -- 'fedpa', 'regional', 'internacional', 'ancon'
  display_name    TEXT            NOT NULL,
  logo_key        TEXT,                                  -- key for InsurerLogo component
  tp_activo       BOOLEAN         NOT NULL DEFAULT true, -- Daños a Terceros visibility
  cc_activo       BOOLEAN         NOT NULL DEFAULT true, -- Cobertura Completa visibility
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Index for slug lookup
CREATE INDEX IF NOT EXISTS idx_cotizador_insurer_settings_slug
  ON public.cotizador_insurer_settings(slug);

-- RLS: Public read (cotizadores are public), master-only write
ALTER TABLE public.cotizador_insurer_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read insurer settings (needed for public cotizador flow)
CREATE POLICY "public_read"
  ON public.cotizador_insurer_settings
  FOR SELECT
  USING (true);

-- Only authenticated master users can insert/update/delete
CREATE POLICY "master_write"
  ON public.cotizador_insurer_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND LOWER(profiles.role) = 'master'
    )
  );

-- Seed initial data: 4 insurers with API implementation
INSERT INTO public.cotizador_insurer_settings (slug, display_name, logo_key, tp_activo, cc_activo)
VALUES
  ('fedpa',           'FEDPA Seguros',                'fedpa',          true, true),
  ('internacional',   'INTERNACIONAL de Seguros',    'internacional',  true, true),
  ('regional',        'La Regional de Seguros',      'regional',       true, true),
  ('ancon',           'ANCÓN Seguros',               'ancon',          true, true)
ON CONFLICT (slug) DO NOTHING;
