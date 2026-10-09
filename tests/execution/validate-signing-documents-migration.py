"""Rollback-only validation of AssetFlow signing-document migrations.

Uses native PostgreSQL psql against the existing Supabase project.
Never commits test records or migration changes.
"""

from __future__ import annotations

import getpass
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

PSQL = Path(
    r"C:\Program Files\PostgreSQL\18\bin\psql.exe"
)

HOST = "aws-0-eu-west-1.pooler.supabase.com"
PORT = "5432"
DATABASE = "postgres"
USERNAME = "postgres.syuamqnefexvvridkdjf"

MIGRATIONS = [
    "20261009150000_create_execution_signing_documents.sql",
    "20261009151000_require_prepared_execution_pdf.sql",
    "20261009152000_preserve_nonlease_execution_snapshots.sql",
]

TESTS = [
    "signing-documents-negative.sql",
    "signing-documents-positive.sql",
    "signing-pdf-gate-negative.sql",
    "execution-snapshot-compatibility.sql",
]


def load_sql(path: Path) -> str:
    if not path.is_file():
        raise RuntimeError(f"Missing required file: {path}")

    return path.read_text(encoding="utf-8")


def strip_transaction_controls(sql: str) -> str:
    return re.sub(
        r"(?im)^[ \t]*(?:BEGIN|COMMIT|ROLLBACK)[ \t]*;[ \t]*$",
        "",
        sql,
    )


def main() -> int:
    if not PSQL.is_file():
        print(f"STOP: PostgreSQL client missing: {PSQL}")
        return 1

    parts = [
        r"\set ON_ERROR_STOP on",
        "BEGIN;",
    ]

    for filename in MIGRATIONS:
        path = ROOT / "supabase" / "migrations" / filename
        parts.append(f"-- MIGRATION: {filename}")
        parts.append(strip_transaction_controls(load_sql(path)))

    parts.extend(
        [
            """
DO $check$
BEGIN
  IF NOT has_function_privilege(
    'service_role',
    'public.stage_execution_signing_document(uuid,uuid,uuid,uuid,text,text,text,integer,bigint,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Stage RPC permission missing';
  END IF;

  IF NOT has_function_privilege(
    'service_role',
    'public.commit_execution_signing_document(uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Commit RPC permission missing';
  END IF;

  RAISE NOTICE 'PASS: Registration and commit RPC permissions';
END
$check$;
""",
            "SET LOCAL ROLE service_role;",
        ]
    )

    for filename in TESTS:
        path = ROOT / "tests" / "execution" / filename
        parts.append(f"-- TEST: {filename}")
        parts.append(load_sql(path))

    parts.extend(
        [
            "RESET ROLE;",
            "ROLLBACK;",
        ]
    )

    sql = "\n\n".join(parts) + "\n"

    # Prevent accidentally submitting a script with a top-level
    # COMMIT introduced by a future migration edit.
    if re.search(
        r"(?im)^[ \t]*COMMIT[ \t]*;",
        sql,
    ):
        print("STOP: Combined script contains COMMIT")
        return 1

    if sql.count("ROLLBACK;") != 1:
        print("STOP: Expected exactly one final ROLLBACK")
        return 1

    print("=== COMBINED ROLLBACK-ONLY DATABASE TEST ===")
    print("Migrations:", ", ".join(MIGRATIONS))
    print("Tests:", ", ".join(TESTS))

    password = getpass.getpass(
        "Supabase PostgreSQL database password: "
    )

    env = os.environ.copy()
    env["PGPASSWORD"] = password
    env["PGSSLMODE"] = "require"

    try:
        result = subprocess.run(
            [
                str(PSQL),
                "-X",
                "-v",
                "ON_ERROR_STOP=1",
                "-h",
                HOST,
                "-p",
                PORT,
                "-U",
                USERNAME,
                "-d",
                DATABASE,
                "-f",
                "-",
            ],
            input=sql,
            text=True,
            env=env,
            check=False,
        )
    finally:
        env.pop("PGPASSWORD", None)
        password = ""

    if result.returncode != 0:
        print(
            "FAIL: Combined PostgreSQL validation failed. "
            "Do not deploy."
        )
        return result.returncode

    print("PASS: Combined validation completed with ROLLBACK.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
