from pathlib import Path
import getpass
import os
import subprocess
import sys

MIGRATION = Path(
    "supabase/migrations/"
    "20261012100000_lock_governed_execution_for_preparation.sql"
)

PSQL = r"C:\Program Files\PostgreSQL\18\bin\psql.exe"
HOST = "aws-0-eu-west-1.pooler.supabase.com"
USER = "postgres.syuamqnefexvvridkdjf"
FUNCTION = "public.lock_governed_execution_for_preparation(uuid,uuid)"

sql = MIGRATION.read_text().strip()
if not sql.startswith("BEGIN;") or not sql.endswith("COMMIT;"):
    sys.exit("STOP: migration transaction wrapper differs")

sql = sql[len("BEGIN;"):-len("COMMIT;")].strip()

validation = r"""
DO $test$
BEGIN
  IF NOT has_function_privilege(
    'service_role',
    'public.lock_governed_execution_for_preparation(uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Service role lacks EXECUTE';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.lock_governed_execution_for_preparation(uuid,uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.lock_governed_execution_for_preparation(uuid,uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Public execution privilege remains';
  END IF;

  RAISE NOTICE 'PASS: execution privileges';
END;
$test$;

SET LOCAL ROLE authenticated;

DO $test$
BEGIN
  BEGIN
    PERFORM public.lock_governed_execution_for_preparation(
      gen_random_uuid(),
      gen_random_uuid()
    );
    RAISE EXCEPTION 'Unexpected public execution';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated role denied';
  END;
END;
$test$;

RESET ROLE;

SET LOCAL ROLE service_role;

DO $test$
BEGIN
  BEGIN
    PERFORM public.lock_governed_execution_for_preparation(
      gen_random_uuid(),
      gen_random_uuid()
    );
    RAISE EXCEPTION 'Unexpected missing-execution acceptance';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM = 'Execution not eligible for preparation' THEN
        RAISE NOTICE 'PASS: missing execution rejected';
      ELSE
        RAISE;
      END IF;
  END;
END;
$test$;

RESET ROLE;

SET LOCAL ROLE service_role;

DO $test$
DECLARE
  v_entity uuid;
  v_actor uuid := gen_random_uuid();
  v_execution uuid := gen_random_uuid();
  v_rejected boolean := false;
BEGIN
  SELECT id INTO v_entity
  FROM public.entities
  ORDER BY id
  LIMIT 1;

  IF v_entity IS NULL THEN
    RAISE EXCEPTION 'Fixture prerequisite missing: no entity exists';
  END IF;

  INSERT INTO public.executions (
    id, source_type, source_id, version,
    snapshot, status, provider, signing_order,
    is_locked, sha_hash
  )
  VALUES (
    v_execution,
    'leasing_opportunity',
    gen_random_uuid(),
    1,
    '{}'::jsonb,
    'under_review',
    'native',
    'sequential',
    false,
    repeat('a', 64)
  );

  BEGIN
    PERFORM public.lock_governed_execution_for_preparation(
      v_execution,
      v_actor
    );
  EXCEPTION WHEN OTHERS THEN
    v_rejected := true;
  END;

  IF NOT v_rejected THEN
    RAISE EXCEPTION 'Ungoverned execution was accepted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.executions
    WHERE id = v_execution AND is_locked = true
  ) THEN
    RAISE EXCEPTION 'Rejected execution was unexpectedly locked';
  END IF;

  RAISE NOTICE 'PASS: ungoverned execution rejected without state change';
END;
$test$;

RESET ROLE;

SET LOCAL ROLE service_role;



DO $test$
DECLARE
  v_record record;
  v_result record;
  v_count integer;
BEGIN
  SELECT
    e.id AS execution_id,
    e.created_by AS actor_id
  INTO v_record
  FROM public.executions e
  JOIN public.execution_document_versions edv
    ON edv.execution_id = e.id
   AND edv.version = e.version
   AND edv.status = 'active'
  JOIN public.leasing_opportunities lo
    ON lo.id = e.source_id
   AND lo.entity_id = edv.entity_id
  JOIN public.lease_generated_document_provenance p
    ON p.id = edv.generated_lease_provenance_id
   AND p.opportunity_id = lo.id
   AND p.document_id = edv.document_id
  WHERE e.source_type = 'leasing_opportunity'
    AND e.status IN ('under_review', 'ready')
    AND e.is_locked = false
    AND e.deleted_at IS NULL
    AND e.metadata->>'governed_generated_lease' = 'true'
    AND lo.approved_terms_version_id = p.commercial_version_id
    AND public.has_entity_permission(
      e.created_by,
      edv.entity_id,
      'leasing.execution.send'
    )
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE NOTICE
      'NOT TESTED: no eligible approved execution with authorized actor';
    RETURN;
  END IF;

  SELECT *
  INTO v_result
  FROM public.lock_governed_execution_for_preparation(
    v_record.execution_id,
    v_record.actor_id
  );

  IF v_result.execution_id IS DISTINCT FROM v_record.execution_id THEN
    RAISE EXCEPTION 'Lock returned incorrect execution';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.executions
  WHERE id = v_record.execution_id
    AND is_locked = true
    AND locked_at IS NOT NULL
    AND locked_by = v_record.actor_id
    AND status IN ('under_review', 'ready');

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Governed execution lock transition failed';
  END IF;

  RAISE NOTICE 'PASS: approved execution locked without dispatch';

  PERFORM public.lock_governed_execution_for_preparation(
    v_record.execution_id,
    v_record.actor_id
  );

  RAISE NOTICE 'PASS: repeated preparation is idempotent';
END;
$test$;

RESET ROLE;
"""

script = (
    "BEGIN;\n"
    + sql
    + "\n"
    + validation
    + "\nROLLBACK;\n"
)

password = getpass.getpass("Supabase database password: ")

env = os.environ.copy()
env["PGPASSWORD"] = password

result = subprocess.run(
    [
        PSQL,
        "-X",
        "-v", "ON_ERROR_STOP=1",
        "-h", HOST,
        "-p", "5432",
        "-U", USER,
        "-d", "postgres",
        "-f", "-",
    ],
    input=script,
    text=True,
    env=env,
    capture_output=True,
)

print(result.stdout)
print(result.stderr, file=sys.stderr)

if result.returncode:
    sys.exit("FAIL: rollback-only migration validation")

print("PASS: migration compiled and validation rolled back")
