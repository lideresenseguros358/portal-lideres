-- ============================================================================
-- FIX insurer_mapping_rules: constraint target_field_valid + RLS policies
-- Ejecutar directamente en el SQL Editor de Supabase
-- ============================================================================

BEGIN;

-- ── 1. Eliminar TODOS los constraints de target_field que puedan existir ────
--    El constraint "target_field_valid" fue creado directamente en la BD
--    (no aparece en ninguna migración del repo). Lo eliminamos junto con
--    cualquier versión previa que hayamos intentado crear.
ALTER TABLE public.insurer_mapping_rules
  DROP CONSTRAINT IF EXISTS target_field_valid;

ALTER TABLE public.insurer_mapping_rules
  DROP CONSTRAINT IF EXISTS insurer_mapping_rules_target_field_check;

-- ── 2. Constraint consolidado con todos los valores válidos ─────────────────
ALTER TABLE public.insurer_mapping_rules
  ADD CONSTRAINT insurer_mapping_rules_target_field_check
  CHECK (lower(target_field) IN (
    -- Comisiones / mapping general
    'policy', 'insured', 'commission', 'amount', 'status', 'days',
    -- Morosidad
    'delinquency_policy_number',
    'delinquency_due_soon',
    'delinquency_current',
    'delinquency_bucket_1_30',
    'delinquency_bucket_31_60',
    'delinquency_bucket_61_90',
    'delinquency_bucket_90_plus'
  ));

-- ── 3. RLS: agregar policies que faltaban ───────────────────────────────────
--    RLS estaba activo pero sin policies → authenticated quedaba bloqueado.
--    service_role siempre bypasea RLS, por eso el admin fallback funciona.

DROP POLICY IF EXISTS "Authenticated can read insurer_mapping_rules" ON public.insurer_mapping_rules;
CREATE POLICY "Authenticated can read insurer_mapping_rules"
  ON public.insurer_mapping_rules FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Master can manage insurer_mapping_rules" ON public.insurer_mapping_rules;
CREATE POLICY "Master can manage insurer_mapping_rules"
  ON public.insurer_mapping_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'master'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'master'
    )
  );

COMMIT;

-- ── Verificación ─────────────────────────────────────────────────────────────
-- Confirma que el constraint quedó bien y que las policies existen:
SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
 WHERE conrelid = 'public.insurer_mapping_rules'::regclass
   AND contype = 'c';

SELECT policyname, cmd, roles
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename = 'insurer_mapping_rules';
