-- ==============================================
-- PASO 2 · RLS de tablas públicas
-- ==============================================

-- Habilitar RLS (idempotente)
alter table public.profiles enable row level security;
alter table public.brokers  enable row level security;
alter table public.insurers enable row level security;
alter table public.insurer_assa_codes enable row level security;

-- Limpieza de políticas previas (si existieran)
do $$ declare p text;
begin
  for p in
    select policyname from pg_policies
    where schemaname='public' and tablename in ('profiles','brokers','insurers','insurer_assa_codes')
  loop
    execute format('drop policy if exists %I on public.profiles;', p);
    execute format('drop policy if exists %I on public.brokers;', p);
    execute format('drop policy if exists %I on public.insurers;', p);
    execute format('drop policy if exists %I on public.insurer_assa_codes;', p);
  end loop;
exception when others then null;
end$$;

-- PROFILES
create policy profiles_read_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_master());

create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_master
  on public.profiles for update
  to authenticated
  using (public.is_master())
  with check (public.is_master());

-- BROKERS
create policy brokers_read_own
  on public.brokers for select
  to authenticated
  using (p_id = auth.uid() or public.is_master());

create policy brokers_cud_master
  on public.brokers for all
  to authenticated
  using (public.is_master())
  with check (public.is_master());

-- INSURERS
create policy insurers_read_all_auth
  on public.insurers for select
  to authenticated
  using (true);

create policy insurers_cud_master
  on public.insurers for all
  to authenticated
  using (public.is_master())
  with check (public.is_master());

-- INSURER_ASSA_CODES
create policy assa_codes_read_all_auth
  on public.insurer_assa_codes for select
  to authenticated
  using (true);

create policy assa_codes_cud_master
  on public.insurer_assa_codes for all
  to authenticated
  using (public.is_master())
  with check (public.is_master());

-- ==============================================
