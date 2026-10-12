from pathlib import Path
import getpass
import os
import subprocess
import sys

migrations = [
    Path("supabase/migrations/20261012120000_fix_execution_bridge_ambiguous_columns.sql"),
    Path("supabase/migrations/20261012121000_fix_execution_preparation_column_ambiguity.sql"),
]

parts = []

for path in migrations:
    sql = path.read_text().strip()
    if not sql.startswith("BEGIN;") or not sql.endswith("COMMIT;"):
        sys.exit(f"STOP: unexpected migration structure: {path}")
    parts.append(sql[len("BEGIN;"):-len("COMMIT;")].strip())

test = Path("tests/execution/positive-governed-preparation.sql").read_text()

script = (
    "BEGIN;\n"
    + "\n".join(parts)
    + "\n"
    + test
    + "\nROLLBACK;\n"
)

env = os.environ.copy()
env["PGPASSWORD"] = getpass.getpass("Supabase database password: ")

result = subprocess.run(
    [
        r"C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "-X",
        "-v", "ON_ERROR_STOP=1",
        "-h", "aws-0-eu-west-1.pooler.supabase.com",
        "-p", "5432",
        "-U", "postgres.syuamqnefexvvridkdjf",
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
    sys.exit("FAIL: governed preparation integration test")

if result.stdout.splitlines()[-1:] != ["ROLLBACK"]:
    sys.exit("STOP: rollback confirmation missing")

required = [
    "PASS: governed approval bridge",
    "PASS: frozen document and commercial authority",
    "PASS: preparation idempotency",
]

if not all(item in result.stderr for item in required):
    sys.exit("FAIL: expected test assertions missing")

print("PASS: governed preparation integration test; transaction rolled back")
