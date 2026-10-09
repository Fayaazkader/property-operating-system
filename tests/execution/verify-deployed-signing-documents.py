from pathlib import Path
import getpass
import os
import subprocess
import sys

psql = Path("C:/Program Files/PostgreSQL/18/bin/psql.exe")

if not psql.is_file():
    raise SystemExit("STOP: PostgreSQL 18 psql not found")

sql = r"""
\set ON_ERROR_STOP on
BEGIN READ ONLY;

SELECT version
FROM supabase_migrations.schema_migrations
WHERE version IN (
  '20261009150000',
  '20261009151000',
  '20261009152000'
)
ORDER BY version;

SELECT
  to_regclass('public.execution_signing_documents')
    IS NOT NULL AS signing_documents_table_exists,
  to_regclass('public.execution_signing_invitations')
    IS NOT NULL AS signing_invitations_table_exists;

SELECT
  id,
  name,
  public
FROM storage.buckets
WHERE id IN (
  'execution-documents',
  'execution-evidence'
)
ORDER BY id;

SELECT
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  has_function_privilege(
    'anon',
    p.oid,
    'EXECUTE'
  ) AS anon_execute,
  has_function_privilege(
    'authenticated',
    p.oid,
    'EXECUTE'
  ) AS authenticated_execute,
  has_function_privilege(
    'service_role',
    p.oid,
    'EXECUTE'
  ) AS service_execute
FROM pg_proc p
JOIN pg_namespace n
  ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'stage_execution_signing_document',
    'commit_execution_signing_document',
    'issue_execution_signing_invitation',
    'validate_execution_signing_invitation',
    'record_execution_participant_signature'
  )
ORDER BY p.proname;

SELECT
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'execution_signing_documents',
    'execution_signature_evidence'
  )
ORDER BY tablename;

ROLLBACK;
"""

password = getpass.getpass(
    "Supabase PostgreSQL database password: "
)

env = os.environ.copy()
env["PGPASSWORD"] = password

command = [
    str(psql),
    "-X",
    "-v", "ON_ERROR_STOP=1",
    "-h", "aws-0-eu-west-1.pooler.supabase.com",
    "-p", "5432",
    "-U", "postgres.syuamqnefexvvridkdjf",
    "-d", "postgres",
    "-f", "-"
]

result = subprocess.run(
    command,
    input=sql,
    text=True,
    env=env,
    check=False
)

if result.returncode:
    sys.exit("STOP: Production verification failed")

print("PASS: Read-only production verification completed.")
