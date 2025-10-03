-- ==============================================
-- PASO 2 · Verificación
-- ==============================================

-- A) Tablas presentes
select 'profiles'  as tbl, count(*) as ncols
from information_schema.columns
where table_schema='public' and table_name='profiles'
union all
select 'brokers', count(*) from information_schema.columns
where table_schema='public' and table_name='brokers'
union all
select 'insurers', count(*) from information_schema.columns
where table_schema='public' and table_name='insurers'
union all
select 'insurer_assa_codes', count(*) from information_schema.columns
where table_schema='public' and table_name='insurer_assa_codes';

-- B) Columna demo_enabled
select 'profiles.demo_enabled exists' as check,
       exists(
         select 1 from information_schema.columns
         where table_schema='public' and table_name='profiles' and column_name='demo_enabled'
       ) as ok;

-- C) Políticas activas
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname='public'
  and tablename in ('profiles','brokers','insurers','insurer_assa_codes')
order by tablename, policyname;

-- D) Buckets existentes
select id, name, public from storage.buckets
where name in ('avatars','descargas','pendientes')
order by name;

-- E) Políticas de storage aplicadas
select policyname, cmd
from pg_policies
where schemaname='storage' and tablename='objects'
  and (qual ilike '%bucket_id = ''avatars''%' or qual ilike '%bucket_id = ''descargas''%' or qual ilike '%bucket_id = ''pendientes''%')
order by policyname;

-- ==============================================
