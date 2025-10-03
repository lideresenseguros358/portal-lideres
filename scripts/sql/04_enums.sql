-- Step 4: foundational enums required by the "Biblia" schema
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('MASTER', 'BROKER');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.map_kind AS ENUM ('COMMISSIONS', 'DELINQUENCY');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.case_section AS ENUM (
    'SIN_CLASIFICAR',
    'RAMOS_GENERALES',
    'VIDA_ASSA',
    'OTROS_PERSONAS'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.case_status AS ENUM (
    'PENDIENTE_REVISION',
    'EN_PROCESO',
    'RESUELTO',
    'DESCARTADO'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.event_audience AS ENUM ('ALL', 'SELECTED');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
