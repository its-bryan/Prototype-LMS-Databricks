#!/usr/bin/env python
"""
Replacement for: psql -d lms_leo -f scripts/setup_local_db.sql
Works without a local psql install by using psycopg3 directly.

Usage (from repo root, with .venv active):
    python scripts/run_setup_db.py
"""
import os
import re
import sys
from pathlib import Path
# ---------------------------------------------------------------------------
# Load .env.local
# ---------------------------------------------------------------------------
ROOT = Path(__file__).parent.parent
ENV_FILE = ROOT / ".env.local"

if not ENV_FILE.exists():
    sys.exit(f"ERROR: {ENV_FILE} not found.")

for line in ENV_FILE.read_text().splitlines():
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    if "=" in line:
        key, _, val = line.partition("=")
        os.environ.setdefault(key.strip(), val.strip())

# ---------------------------------------------------------------------------
# Build connection kwargs from env
# ---------------------------------------------------------------------------
conn_kwargs = dict(
    host=os.environ["PGHOST"],
    dbname=os.environ["PGDATABASE"],
    user=os.environ["PGUSER"],
    password=os.environ["PGPASSWORD"],
    port=os.environ.get("PGPORT", "5432"),
)
if os.environ.get("PGSSLMODE"):
    conn_kwargs["sslmode"] = os.environ["PGSSLMODE"]

# ---------------------------------------------------------------------------
# SQL executor
# ---------------------------------------------------------------------------
import psycopg


def _strip_leading_comments(sql: str) -> str:
    """Remove leading blank lines and -- comment lines, return the remainder."""
    lines = sql.splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped and not stripped.startswith("--"):
            return "\n".join(lines[i:])
    return ""


def _split_statements(sql: str) -> list[str]:
    """
    Split SQL text into individual statements on semicolons, correctly
    ignoring semicolons inside single-quoted string literals.
    Handles PostgreSQL '' (escaped quote) and standard -- line comments.
    """
    statements: list[str] = []
    current: list[str] = []
    in_string = False
    i = 0
    while i < len(sql):
        ch = sql[i]
        if in_string:
            current.append(ch)
            if ch == "'":
                # check for escaped quote ''
                if i + 1 < len(sql) and sql[i + 1] == "'":
                    current.append("'")
                    i += 2
                    continue
                in_string = False
        elif ch == "'":
            in_string = True
            current.append(ch)
        elif ch == "-" and i + 1 < len(sql) and sql[i + 1] == "-":
            # line comment: consume to end of line
            while i < len(sql) and sql[i] != "\n":
                current.append(sql[i])
                i += 1
            continue
        elif ch == ";":
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
        else:
            current.append(ch)
        i += 1
    # trailing content without a semicolon
    stmt = "".join(current).strip()
    if stmt:
        statements.append(stmt)
    return statements


def execute_sql_text(conn: psycopg.Connection, sql: str, source: str) -> None:
    """Split sql on semicolons (respecting string literals) and execute each statement."""
    for stmt in _split_statements(sql):
        effective = _strip_leading_comments(stmt)
        if not effective:
            continue
        try:
            conn.execute(effective)
        except Exception as exc:
            conn.rollback()
            sys.exit(f"\nERROR in {source}:\n  {exc}\n\nStatement:\n  {effective[:300]}")


def run_file(conn: psycopg.Connection, path: Path) -> None:
    """Execute a plain SQL file (no psql meta-commands expected)."""
    sql = path.read_text()
    execute_sql_text(conn, sql, str(path))


def run_setup(conn: psycopg.Connection, setup_file: Path) -> None:
    """
    Parse setup_local_db.sql, handling:
      \\i <file>   -> include and execute that file
      \\echo ...   -> print the message
      \\set ...    -> ignored (psql option, not needed)
      SQL text     -> executed directly
    """
    lines = setup_file.read_text().splitlines()
    inline_sql_lines: list[str] = []

    def flush_inline(label: str = "setup_local_db.sql inline") -> None:
        sql = "\n".join(inline_sql_lines).strip()
        inline_sql_lines.clear()
        if sql:
            execute_sql_text(conn, sql, label)

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("\\echo"):
            flush_inline()
            print("[setup]", stripped[5:].strip())

        elif stripped.startswith("\\i "):
            flush_inline()
            include_path = ROOT / stripped[3:].strip()
            print(f"[setup] Running {include_path.name} ...", end=" ", flush=True)
            run_file(conn, include_path)
            print("ok")

        elif stripped.startswith("\\set") or stripped.startswith("\\"):
            # Ignore other psql meta-commands
            pass

        elif stripped.startswith("--") or not stripped:
            pass  # comment or blank

        else:
            inline_sql_lines.append(line)

    flush_inline()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    print(f"[setup] Connecting to {conn_kwargs['host']} / {conn_kwargs['dbname']} ...")
    try:
        conn = psycopg.connect(**conn_kwargs, autocommit=False)
    except Exception as exc:
        sys.exit(f"ERROR: Could not connect to database.\n  {exc}")

    print("[setup] Connected. Running setup_local_db.sql ...")
    setup_file = ROOT / "scripts" / "setup_local_db.sql"

    with conn:
        run_setup(conn, setup_file)
        conn.commit()

    conn.close()
    print("[setup] setup_local_db.sql complete.")


if __name__ == "__main__":
    main()
