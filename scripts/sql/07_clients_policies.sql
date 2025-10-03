-- Step 7: clients and policies tables with constraints, preliminares, and RLS

begin;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  broker_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  national_id text,
  email text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint clients_national_id_per_broker_unique unique (broker_id, national_id)
);

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  broker_id uuid not null references public.profiles(id) on delete cascade,
  insurer_id uuid not null references public.insurers(id),
  policy_number text not null,
  ramo text not null,
  start_date date not null,
  renewal_date date,
  status public.policy_status_enum not null default 'active',
  percent_override numeric(5,2),
  preliminar boolean not null default false,
  created_at timestamptz not null default now(),
  constraint policies_policy_number_unique unique (policy_number)
);

create index if not exists idx_policies_client_id on public.policies (client_id);
create index if not exists idx_policies_broker_id on public.policies (broker_id);
create index if not exists idx_clients_broker_id on public.clients (broker_id);

-- TODO: ensure morosidad tables exist; cascade deletes should remove linked delinquency records via triggers

alter table public.clients enable row level security;
alter table public.policies enable row level security;

drop policy if exists clients_by_owner on public.clients;
create policy clients_select_by_role
  on public.clients
  for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'MASTER')
    or broker_id = auth.uid()
  );

create policy clients_modify_by_role
  on public.clients
  for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'MASTER')
    or broker_id = auth.uid()
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'MASTER')
    or broker_id = auth.uid()
  );

drop policy if exists policies_by_owner on public.policies;
create policy policies_select_by_role
  on public.policies
  for select
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'MASTER')
    or broker_id = auth.uid()
  );

create policy policies_modify_by_role
  on public.policies
  for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'MASTER')
    or broker_id = auth.uid()
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'MASTER')
    or broker_id = auth.uid()
  );

commit;
