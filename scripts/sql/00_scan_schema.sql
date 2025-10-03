-- 1) Enums y sus valores
select n.nspname as schema, t.typname as enum_name, e.enumlabel as value
from pg_type t
join pg_enum e on t.oid = e.enumtypid
join pg_catalog.pg_namespace n on n.oid = t.typnamespace
order by schema, enum_name, e.enumsortorder;

-- 2) Tablas y columnas (con nullabilidad)
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 3) Claves foráneas
select
  tc.table_name,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
  and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.constraint_type = 'FOREIGN KEY'
order by tc.table_name, kcu.column_name;

-- 4) Políticas RLS
select polname, tablename as table_name, polcmd as cmd, qual as using_expr, withcheck as check_expr
from pg_policies
where schemaname = 'public'
order by table_name, polname;
