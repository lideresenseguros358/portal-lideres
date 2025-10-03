-- scripts/sql/03_fix_target_check.sql
------------------------------------------------------------
do $$
begin
  -- insurer_mapping_rules
  if exists (
    select 1 from information_schema.tables 
    where table_schema='public' and table_name='insurer_mapping_rules'
  ) then
    if exists (select 1 from pg_constraint where conname='insurer_mapping_rules_target_field_check') then
      alter table public.insurer_mapping_rules
        drop constraint insurer_mapping_rules_target_field_check;
    end if;

    alter table public.insurer_mapping_rules
      add constraint insurer_mapping_rules_target_field_check
      check (lower(target_field) in ('policy','insured','commission','amount','status','days'));
  end if;

  -- insurer_delinquency_rules (mismo criterio)
  if exists (
    select 1 from information_schema.tables 
    where table_schema='public' and table_name='insurer_delinquency_rules'
  ) then
    if exists (select 1 from pg_constraint where conname='insurer_delinquency_rules_target_field_check') then
      alter table public.insurer_delinquency_rules
        drop constraint insurer_delinquency_rules_target_field_check;
    end if;

    alter table public.insurer_delinquency_rules
      add constraint insurer_delinquency_rules_target_field_check
      check (lower(target_field) in ('policy','insured','commission','amount','status','days'));
  end if;
end $$;
------------------------------------------------------------
