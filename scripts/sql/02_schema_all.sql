-- ==============================================
-- PASO 2 · SCHEMA (core) · Profiles, Brokers, Insurers, ASSA Codes
-- Idempotente: usa IF NOT EXISTS / ALTER condicional.
-- Respeta el “esquema bíblico” acordado.
-- ==============================================

-- Extensiones necesarias
create extension if not exists pgcrypto;

-- Enum de roles (mantener mayúsculas)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_enum') then
    create type role_enum as enum ('MASTER','BROKER','OFFICE');
  end if;
end$$;

-- Tabla PROFILES (ya existe, solo asegurar estructura y columna demo)
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text unique,
  role        role_enum,
  created_at  timestamptz default now()
);

-- Columna demo_enabled si faltara
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='demo_enabled'
  ) then
    alter table public.profiles add column demo_enabled boolean not null default false;
  end if;
end$$;

-- Normaliza email único (case-insensitive)
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='profiles_email_lower_key') then
    create unique index profiles_email_lower_key on public.profiles (lower(email));
  end if;
end$$;

-- Función helper para políticas RLS (is_master)
create or replace function public.is_master() returns boolean
language sql stable as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'MASTER'
  );
$$;

-- Tabla BROKERS (corrige/crea estructura base)
create table if not exists public.brokers (
  id               uuid primary key default gen_random_uuid(),
  p_id             uuid not null references public.profiles(id) on delete cascade,
  name             text not null,
  email            text not null,
  national_id      text not null,        -- cédula/pasaporte
  phone            text,
  active           boolean not null default true,
  created_at       timestamptz default now(),

  percent_default  numeric(4,2) not null default 0.70
    check (percent_default in (0.50,0.60,0.70,0.80,0.82,0.94,1.00)),

  bank_account_no  text,
  bank_id          text,
  beneficiary_name text,
  beneficiary_id   text,
  license_no       text
);

-- Unicidades útiles
do $$
begin
  if not exists (select 1 from pg_indexes where indexname='brokers_email_lower_key') then
    create unique index brokers_email_lower_key on public.brokers (lower(email));
  end if;
  if not exists (select 1 from pg_indexes where indexname='brokers_profile_unique') then
    create unique index brokers_profile_unique on public.brokers (p_id);
  end if;
end$$;

-- Tabla INSURERS
create table if not exists public.insurers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- Tabla INSURER_ASSA_CODES (mapea códigos ASSA -> broker)
create table if not exists public.insurer_assa_codes (
  id         uuid primary key default gen_random_uuid(),
  insurer_id uuid not null references public.insurers(id) on delete cascade,
  code       text not null,
  broker_id  uuid references public.brokers(id) on delete set null,
  active     boolean not null default true,
  created_at timestamptz default now(),
  unique (insurer_id, lower(code))
);

-- Asegurar que la aseguradora ASSA exista
insert into public.insurers (id, name, active)
select gen_random_uuid(), 'ASSA', true
where not exists (select 1 from public.insurers where upper(name)='ASSA');

-- Listo (schema)
-- ==============================================
