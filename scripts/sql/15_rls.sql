-- Step 15: row level security policies for operational tables (híbrido Biblia)

ALTER TABLE public.advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comm_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_doc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fortnight_broker_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fortnights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurer_assa_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'master'::public.role_enum
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advances' AND policyname = 'advances_access'
  ) THEN
    CREATE POLICY advances_access ON public.advances
      FOR SELECT
      TO public
      USING (public.is_master() OR (broker_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advances' AND policyname = 'advances_cud'
  ) THEN
    CREATE POLICY advances_cud ON public.advances
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'advances' AND policyname = 'advances_read'
  ) THEN
    CREATE POLICY advances_read ON public.advances
      FOR SELECT
      TO authenticated
      USING (public.is_master() OR public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'settings_cud'
  ) THEN
    CREATE POLICY settings_cud ON public.app_settings
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'settings_read'
  ) THEN
    CREATE POLICY settings_read ON public.app_settings
      FOR SELECT
      TO authenticated
      USING (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'audit_cud'
  ) THEN
    CREATE POLICY audit_cud ON public.audit_logs
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'audit_read'
  ) THEN
    CREATE POLICY audit_read ON public.audit_logs
      FOR SELECT
      TO authenticated
      USING (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'brokers' AND policyname = 'brokers_cud_master'
  ) THEN
    CREATE POLICY brokers_cud_master ON public.brokers
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'brokers' AND policyname = 'brokers_read_own'
  ) THEN
    CREATE POLICY brokers_read_own ON public.brokers
      FOR SELECT
      TO authenticated
      USING ((p_id = auth.uid()) OR public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'case_checklist' AND policyname = 'case_checklist_access'
  ) THEN
    CREATE POLICY case_checklist_access ON public.case_checklist
      FOR SELECT
      TO public
      USING (
        public.is_master()
        OR EXISTS (
          SELECT 1
          FROM public.cases c
          WHERE c.id = public.case_checklist.case_id
            AND ((c.broker_id = auth.uid()) OR (c.created_by = auth.uid()))
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'case_checklist' AND policyname = 'case_checklist_rw'
  ) THEN
    CREATE POLICY case_checklist_rw ON public.case_checklist
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.cases c
          WHERE c.id = public.case_checklist.case_id
            AND (
              public.is_master()
              OR (c.broker_id IS NOT NULL AND public.is_self(c.broker_id))
              OR (c.created_by = auth.uid())
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.cases c
          WHERE c.id = public.case_checklist.case_id
            AND (
              public.is_master()
              OR (c.broker_id IS NOT NULL AND public.is_self(c.broker_id))
              OR (c.created_by = auth.uid())
            )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'case_files' AND policyname = 'case_files_access'
  ) THEN
    CREATE POLICY case_files_access ON public.case_files
      FOR SELECT
      TO public
      USING (
        public.is_master()
        OR EXISTS (
          SELECT 1
          FROM public.cases c
          WHERE c.id = public.case_files.case_id
            AND ((c.broker_id = auth.uid()) OR (c.created_by = auth.uid()))
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'case_files' AND policyname = 'case_files_rw'
  ) THEN
    CREATE POLICY case_files_rw ON public.case_files
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.cases c
          WHERE c.id = public.case_files.case_id
            AND (
              public.is_master()
              OR (c.broker_id IS NOT NULL AND public.is_self(c.broker_id))
              OR (c.created_by = auth.uid())
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.cases c
          WHERE c.id = public.case_files.case_id
            AND (
              public.is_master()
              OR (c.broker_id IS NOT NULL AND public.is_self(c.broker_id))
              OR (c.created_by = auth.uid())
            )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'cases_access'
  ) THEN
    CREATE POLICY cases_access ON public.cases
      FOR SELECT
      TO public
      USING (public.is_master() OR (broker_id = auth.uid()) OR (created_by = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'cases_cud'
  ) THEN
    CREATE POLICY cases_cud ON public.cases
      FOR ALL
      TO authenticated
      USING (
        public.is_master()
        OR (broker_id IS NOT NULL AND public.is_self(broker_id))
        OR (created_by = auth.uid())
      )
      WITH CHECK (
        public.is_master()
        OR (broker_id IS NOT NULL AND public.is_self(broker_id))
        OR (created_by = auth.uid())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cases' AND policyname = 'cases_read'
  ) THEN
    CREATE POLICY cases_read ON public.cases
      FOR SELECT
      TO authenticated
      USING (
        public.is_master()
        OR (broker_id IS NOT NULL AND public.is_self(broker_id))
        OR (created_by = auth.uid())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_batches' AND policyname = 'check_batches_master'
  ) THEN
    CREATE POLICY check_batches_master ON public.check_batches
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_items' AND policyname = 'check_items_access'
  ) THEN
    CREATE POLICY check_items_access ON public.check_items
      FOR SELECT
      TO public
      USING (public.is_master() OR (broker_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_items' AND policyname = 'check_items_master'
  ) THEN
    CREATE POLICY check_items_master ON public.check_items
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_items' AND policyname = 'check_items_read'
  ) THEN
    CREATE POLICY check_items_read ON public.check_items
      FOR SELECT
      TO authenticated
      USING (public.is_master() OR public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'clients_cud_master'
  ) THEN
    CREATE POLICY clients_cud_master ON public.clients
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'clients_cud_own'
  ) THEN
    CREATE POLICY clients_cud_own ON public.clients
      FOR ALL
      TO authenticated
      USING (public.is_self(broker_id))
      WITH CHECK (public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'clients_read_master'
  ) THEN
    CREATE POLICY clients_read_master ON public.clients
      FOR SELECT
      TO authenticated
      USING (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'clients_read_own'
  ) THEN
    CREATE POLICY clients_read_own ON public.clients
      FOR SELECT
      TO authenticated
      USING (public.is_master() OR public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comm_imports' AND policyname = 'comm_imports_master'
  ) THEN
    CREATE POLICY comm_imports_master ON public.comm_imports
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comm_items' AND policyname = 'comm_items_access'
  ) THEN
    CREATE POLICY comm_items_access ON public.comm_items
      FOR SELECT
      TO public
      USING (public.is_master() OR (broker_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comm_items' AND policyname = 'comm_items_master'
  ) THEN
    CREATE POLICY comm_items_master ON public.comm_items
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comm_items' AND policyname = 'comm_items_read'
  ) THEN
    CREATE POLICY comm_items_read ON public.comm_items
      FOR SELECT
      TO authenticated
      USING (public.is_master() OR (broker_id IS NOT NULL AND public.is_self(broker_id)));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_tags' AND policyname = 'doctags_cud'
  ) THEN
    CREATE POLICY doctags_cud ON public.doc_tags
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'doc_tags' AND policyname = 'doctags_read'
  ) THEN
    CREATE POLICY doctags_read ON public.doc_tags
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'download_doc_tags' AND policyname = 'doctagmap_rw'
  ) THEN
    CREATE POLICY doctagmap_rw ON public.download_doc_tags
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'download_docs' AND policyname = 'downloads_cud'
  ) THEN
    CREATE POLICY downloads_cud ON public.download_docs
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'download_docs' AND policyname = 'downloads_read'
  ) THEN
    CREATE POLICY downloads_read ON public.download_docs
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_attendees' AND policyname = 'attendees_cud'
  ) THEN
    CREATE POLICY attendees_cud ON public.event_attendees
      FOR ALL
      TO authenticated
      USING (public.is_master() OR public.is_self(broker_id))
      WITH CHECK (public.is_master() OR public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'event_attendees' AND policyname = 'attendees_read'
  ) THEN
    CREATE POLICY attendees_read ON public.event_attendees
      FOR SELECT
      TO authenticated
      USING (public.is_master() OR public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_cud'
  ) THEN
    CREATE POLICY events_cud ON public.events
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'events_read'
  ) THEN
    CREATE POLICY events_read ON public.events
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fortnight_broker_totals' AND policyname = 'fbt_master'
  ) THEN
    CREATE POLICY fbt_master ON public.fortnight_broker_totals
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fortnight_broker_totals' AND policyname = 'fbt_read'
  ) THEN
    CREATE POLICY fbt_read ON public.fortnight_broker_totals
      FOR SELECT
      TO authenticated
      USING (public.is_master() OR public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fortnight_broker_totals' AND policyname = 'fortnight_totals_access'
  ) THEN
    CREATE POLICY fortnight_totals_access ON public.fortnight_broker_totals
      FOR SELECT
      TO public
      USING (public.is_master() OR (broker_id = auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fortnights' AND policyname = 'fortnights_master'
  ) THEN
    CREATE POLICY fortnights_master ON public.fortnights
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'insurer_assa_codes' AND policyname = 'assa_codes_cud_master'
  ) THEN
    CREATE POLICY assa_codes_cud_master ON public.insurer_assa_codes
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'insurer_assa_codes' AND policyname = 'assa_codes_read_all_auth'
  ) THEN
    CREATE POLICY assa_codes_read_all_auth ON public.insurer_assa_codes
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'insurers' AND policyname = 'insurers_cud_master'
  ) THEN
    CREATE POLICY insurers_cud_master ON public.insurers
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'insurers' AND policyname = 'insurers_read_all_auth'
  ) THEN
    CREATE POLICY insurers_read_all_auth ON public.insurers
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notification_reads' AND policyname = 'notifreads_rw'
  ) THEN
    CREATE POLICY notifreads_rw ON public.notification_reads
      FOR ALL
      TO authenticated
      USING ((profile_id = auth.uid()) OR public.is_master())
      WITH CHECK ((profile_id = auth.uid()) OR public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_cud'
  ) THEN
    CREATE POLICY notifications_cud ON public.notifications
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'notifications_read'
  ) THEN
    CREATE POLICY notifications_read ON public.notifications
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'policies' AND policyname = 'policies_cud_master'
  ) THEN
    CREATE POLICY policies_cud_master ON public.policies
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'policies' AND policyname = 'policies_cud_own'
  ) THEN
    CREATE POLICY policies_cud_own ON public.policies
      FOR ALL
      TO authenticated
      USING (public.is_self(broker_id))
      WITH CHECK (public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'policies' AND policyname = 'policies_read_master'
  ) THEN
    CREATE POLICY policies_read_master ON public.policies
      FOR SELECT
      TO authenticated
      USING (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'policies' AND policyname = 'policies_read_own'
  ) THEN
    CREATE POLICY policies_read_own ON public.policies
      FOR SELECT
      TO authenticated
      USING (public.is_master() OR public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'production' AND policyname = 'production_cud'
  ) THEN
    CREATE POLICY production_cud ON public.production
      FOR ALL
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'production' AND policyname = 'production_read'
  ) THEN
    CREATE POLICY production_read ON public.production
      FOR SELECT
      TO authenticated
      USING (public.is_master() OR public.is_self(broker_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_read_own'
  ) THEN
    CREATE POLICY profiles_read_own ON public.profiles
      FOR SELECT
      TO authenticated
      USING ((id = auth.uid()) OR public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_master'
  ) THEN
    CREATE POLICY profiles_update_master ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (public.is_master())
      WITH CHECK (public.is_master());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;
