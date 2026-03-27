-- ============================================================================
-- FIX SUPABASE SECURITY LINTER ERRORS
-- Fecha: 2026-03-10
-- ============================================================================
-- EJECUTAR EN SUPABASE SQL EDITOR (como superadmin)
--
-- Corrige 3 tipos de errores:
--   1. policy_exists_rls_disabled — 4 tablas con policies pero sin RLS activo
--   2. rls_disabled_in_public     — 22 tablas públicas sin RLS
--   3. security_definer_view      — 9 vistas con SECURITY DEFINER
--
-- ESTRATEGIA RLS:
--   - service_role SIEMPRE bypasea RLS automáticamente en Supabase (no necesita policy)
--   - Para tablas solo usadas desde el backend (service_role), basta con ENABLE RLS
--     y NO crear policies para anon/authenticated → quedan bloqueadas para el público
--   - Para tablas que SÍ se leen desde el frontend (authenticated), agregar SELECT policy
--   - Para catálogos de solo lectura, agregar SELECT para authenticated
--
-- ⚠️ IMPORTANTE: service_role bypasea RLS automáticamente en Supabase.
--    No necesitamos crear policies para service_role.
--    Al activar RLS sin policies, la tabla queda BLOQUEADA para anon y authenticated,
--    pero service_role sigue funcionando normalmente.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PARTE 1: TABLAS CON POLICIES CREADAS PERO RLS NO ACTIVADO (4 tablas)
-- Solo necesitan ENABLE ROW LEVEL SECURITY — las policies ya existen
-- ============================================================================

ALTER TABLE public.bank_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 2: TABLAS PÚBLICAS SIN RLS (18 tablas restantes)
-- Activar RLS. Sin policies = bloqueadas para anon/authenticated.
-- service_role sigue funcionando (bypasea RLS).
-- ============================================================================

-- Tablas internas del backend (solo accedidas via service_role/admin)
ALTER TABLE public.advance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_uniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_item_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurer_delinquency_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurer_mapping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurer_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_backup_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unclassified_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imap_debug_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broker_metadata ENABLE ROW LEVEL SECURITY;

-- Tablas de catálogos — accedidas desde getSupabaseServer() (authenticated)
-- Necesitan policy SELECT para authenticated
ALTER TABLE public.tramites_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ramos_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aseguradoras_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 3: POLICIES PARA TABLAS DE CATÁLOGOS
-- Estas tablas se acceden desde getSupabaseServer() con el token del usuario
-- autenticado. Necesitan SELECT para authenticated y ALL para master.
-- ============================================================================

-- ── tramites_catalog ──
DROP POLICY IF EXISTS "Authenticated can read tramites_catalog" ON public.tramites_catalog;
CREATE POLICY "Authenticated can read tramites_catalog"
  ON public.tramites_catalog FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Master can manage tramites_catalog" ON public.tramites_catalog;
CREATE POLICY "Master can manage tramites_catalog"
  ON public.tramites_catalog FOR ALL
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

-- ── ramos_catalog ──
DROP POLICY IF EXISTS "Authenticated can read ramos_catalog" ON public.ramos_catalog;
CREATE POLICY "Authenticated can read ramos_catalog"
  ON public.ramos_catalog FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Master can manage ramos_catalog" ON public.ramos_catalog;
CREATE POLICY "Master can manage ramos_catalog"
  ON public.ramos_catalog FOR ALL
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

-- ── aseguradoras_catalog ──
DROP POLICY IF EXISTS "Authenticated can read aseguradoras_catalog" ON public.aseguradoras_catalog;
CREATE POLICY "Authenticated can read aseguradoras_catalog"
  ON public.aseguradoras_catalog FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Master can manage aseguradoras_catalog" ON public.aseguradoras_catalog;
CREATE POLICY "Master can manage aseguradoras_catalog"
  ON public.aseguradoras_catalog FOR ALL
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

-- ── vacation_config ──
DROP POLICY IF EXISTS "Authenticated can read vacation_config" ON public.vacation_config;
CREATE POLICY "Authenticated can read vacation_config"
  ON public.vacation_config FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Master can manage vacation_config" ON public.vacation_config;
CREATE POLICY "Master can manage vacation_config"
  ON public.vacation_config FOR ALL
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

-- ============================================================================
-- PARTE 4: POLICIES PARA TABLAS DE PAGOS/CHEQUES
-- Estas tablas tienen policies existentes. Verificar que las policies
-- cubran los accesos necesarios. bank_transfers se lee desde el frontend
-- (PendingPaymentsTab, PayAdvanceModal) vía supabaseClient (authenticated).
-- ============================================================================

-- bank_transfers: el frontend lee con authenticated (PayAdvanceModal, PendingPaymentsTab)
-- Ya tiene policies de "master", agregar SELECT para authenticated
DROP POLICY IF EXISTS "Authenticated can read bank_transfers" ON public.bank_transfers;
CREATE POLICY "Authenticated can read bank_transfers"
  ON public.bank_transfers FOR SELECT
  TO authenticated
  USING (true);

-- pending_payments: se lee desde frontend vía getSupabaseServer (authenticated)
-- Ya tiene policies de "master" + "Users pueden ver sus pending_payments"
-- No necesita policy adicional — las existentes deben cubrir el acceso

-- payment_references: se lee desde frontend (EditPaymentModal) vía supabaseClient
-- Ya tiene "Users pueden ver payment_references de sus pagos"
-- No necesita policy adicional

-- payment_details: se accede via service_role mayormente
-- Ya tiene policies de master — no necesita más

-- ============================================================================
-- PARTE 5: VISTAS CON SECURITY DEFINER → SECURITY INVOKER
-- Cambiar a SECURITY INVOKER para que respeten RLS del usuario que consulta.
--
-- ⚠️ NOTA: Si las vistas acceden tablas con RLS, los usuarios necesitan
-- las policies correctas en las tablas subyacentes. Si alguna vista deja
-- de funcionar, es porque la tabla subyacente no tiene policy para el rol.
-- En ese caso, la vista necesita quedarse como SECURITY DEFINER o agregar
-- policies a las tablas subyacentes.
--
-- Para vistas que SOLO se acceden vía service_role (que bypasea RLS),
-- cambiar a INVOKER es seguro porque service_role siempre tiene acceso.
-- ============================================================================

-- Vistas de brokers/ACH — usadas en el backend
ALTER VIEW public.brokers_with_bank_info SET (security_invoker = on);
ALTER VIEW public.brokers_ach_validation SET (security_invoker = on);
ALTER VIEW public.brokers_with_ach_info SET (security_invoker = on);
ALTER VIEW public.ach_account_types_active SET (security_invoker = on);
ALTER VIEW public.ach_banks_active SET (security_invoker = on);

-- Vista de casos — usada en el backend
ALTER VIEW public.cases_with_catalogs SET (security_invoker = on);

-- Vista de claims — usada en el backend
ALTER VIEW public.v_claims_full SET (security_invoker = on);

-- Vista de morosidad — usada en API routes (server-side)
ALTER VIEW public.ops_morosidad_view SET (security_invoker = on);

-- Vista de cron — usada en el backend
ALTER VIEW public.cron_runs_summary SET (security_invoker = on);

COMMIT;

-- ============================================================================
-- VERIFICACIÓN: Ejecutar después del script para confirmar que todo está OK
-- ============================================================================

-- 1. Verificar que todas las tablas tienen RLS activado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'bank_transfers', 'payment_details', 'payment_references', 'pending_payments',
    'advance_logs', 'notification_uniques', 'comm_metadata', 'comm_item_claims',
    'insurer_delinquency_rules', 'insurer_mapping_rules', 'insurer_mappings',
    'clients_backup_names', 'ticket_sequences', 'case_security_logs',
    'case_ticket_history', 'unclassified_emails', 'imap_debug_logs',
    'broker_metadata', 'tramites_catalog', 'ramos_catalog',
    'aseguradoras_catalog', 'vacation_config'
  )
ORDER BY tablename;

-- 2. Verificar policies creadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'tramites_catalog', 'ramos_catalog', 'aseguradoras_catalog',
    'vacation_config', 'bank_transfers'
  )
ORDER BY tablename, policyname;

-- 3. Verificar que las vistas ya no son SECURITY DEFINER
SELECT
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN (
    'brokers_with_bank_info', 'brokers_ach_validation', 'cases_with_catalogs',
    'brokers_with_ach_info', 'ach_account_types_active', 'v_claims_full',
    'ach_banks_active', 'ops_morosidad_view', 'cron_runs_summary'
  )
ORDER BY viewname;
