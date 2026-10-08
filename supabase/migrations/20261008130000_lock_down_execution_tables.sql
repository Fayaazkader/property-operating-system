-- Restrict execution records to trusted server-side operations.
-- Public signing must use separately authorised server endpoints.
BEGIN;

ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.executions FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.executions TO service_role;

ALTER TABLE public.execution_participants ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.execution_participants FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.execution_participants TO service_role;

ALTER TABLE public.execution_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.execution_events FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.execution_events TO service_role;

ALTER TABLE public.execution_document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.execution_document_versions FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.execution_document_versions TO service_role;

ALTER TABLE public.execution_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.execution_policies FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.execution_policies TO service_role;

ALTER TABLE public.execution_artifacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.execution_artifacts FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.execution_artifacts TO service_role;

ALTER TABLE public.execution_checklists ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.execution_checklists FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.execution_checklists TO service_role;

ALTER TABLE public.execution_certificates ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.execution_certificates FROM anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.execution_certificates TO service_role;

-- Remove permissive policies, including any added after the baseline.
DO $migration$
DECLARE policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'executions',
        'execution_participants',
        'execution_events',
        'execution_document_versions',
        'execution_policies',
        'execution_artifacts',
        'execution_checklists',
        'execution_certificates'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$migration$;

COMMIT;
