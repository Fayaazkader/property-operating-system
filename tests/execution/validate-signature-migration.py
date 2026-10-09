import getpass
import os
import re
import subprocess
import sys
from pathlib import Path

migration_path = Path(
    "supabase/migrations/"
    "20261009140000_correct_execution_signature_authority.sql"
)
test_path = Path("tests/execution/signature-transaction.sql")

for path in (migration_path, test_path):
    if not path.is_file():
        sys.exit(f"STOP: Required file missing: {path}")

migration = migration_path.read_text(encoding="utf-8")
test = test_path.read_text(encoding="utf-8")

# Strip transaction-control statements from the migration.
# Only the outer test harness may control COMMIT or ROLLBACK.
def strip_transaction_control(sql):
    return re.sub(
        r"(?im)^\s*(BEGIN|COMMIT|ROLLBACK)\s*;\s*$",
        "",
        sql,
    )

migration = strip_transaction_control(migration)
test = strip_transaction_control(test)

# Prevent unexpected transaction termination inside the SQL body.
for name, body in (("migration", migration), ("test", test)):
    if re.search(r"(?im)^\s*(COMMIT|ROLLBACK)\s*;", body):
        sys.exit(f"STOP: Transaction control found in {name}")

sql = "\n".join([
    r"\set ON_ERROR_STOP on",
    "BEGIN;",
    migration,
    """
DO $check$
BEGIN
  IF NOT has_function_privilege(
    'service_role',
    'public.record_execution_participant_signature(text,uuid,uuid,text,text,text,text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'service_role EXECUTE permission missing';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.record_execution_participant_signature(text,uuid,uuid,text,text,text,text,text,text)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.record_execution_participant_signature(text,uuid,uuid,text,text,text,text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Public execution privilege detected';
  END IF;
END
$check$;
""",
    "SET LOCAL ROLE service_role;",
    test,
    "RESET ROLE;",
    "ROLLBACK;",
    r"\echo PASS: Migration and signing transaction test rolled back.",
])

password = getpass.getpass(
    "Supabase PostgreSQL database password: "
)

env = os.environ.copy()
env["PGPASSWORD"] = password

try:
    result = subprocess.run(
        [
            "C:/Program Files/PostgreSQL/18/bin/psql.exe",
            "-X",
            "-v", "ON_ERROR_STOP=1",
            "-h", "aws-0-eu-west-1.pooler.supabase.com",
            "-p", "5432",
            "-U", "postgres.syuamqnefexvvridkdjf",
            "-d", "postgres",
            "-f", "-",
        ],
        input=sql,
        text=True,
        env=env,
        timeout=120,
    )
finally:
    env.pop("PGPASSWORD", None)
    del password

if result.returncode:
    sys.exit(
        "FAIL: Validation stopped. The database connection "
        "closes and rolls back its transaction."
    )

print("PASS: Rollback-only validation completed.")
