-- scripts/sql/03_verify_seed_step3.sql
------------------------------------------------------------
-- 1) Comprobar que el CHECK acepta 'days'
select 'has_days_rule' as check, count(*) as n
from public.insurer_mapping_rules
where lower(target_field) = 'days';

-- 2) Conteo por target_field en mappings
select lower(target_field) as target_field, count(*) as n
from public.insurer_mapping_rules
group by 1 order by 1;

-- 3) Conteo por target_field en delinquency
select lower(target_field) as target_field, count(*) as n
from public.insurer_delinquency_rules
group by 1 order by 1;

-- 4) Confirma que insurer_mappings usa columna 'options'
select 'insurer_mappings_options_is_jsonb' as check,
       (select pg_typeof(options)::text from public.insurer_mappings limit 1) as type_sample,
       count(*) as rows_total
from public.insurer_mappings;
------------------------------------------------------------
