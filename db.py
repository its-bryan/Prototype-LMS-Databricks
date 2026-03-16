import os
import base64
import psycopg2
from psycopg2.extras import RealDictCursor

# 1. Try env var first (local dev or app.yaml value)
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# 2. Fall back to Databricks workspace secrets via REST API
if not DATABASE_URL:
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        resp = w.secrets.get_secret(scope="lms", key="database-url")
        # Secrets API returns base64-encoded bytes
        DATABASE_URL = base64.b64decode(resp.value).decode("utf-8")
    except Exception as e:
        raise RuntimeError(
            f"DATABASE_URL not set and could not read from Databricks secrets: {e}"
        )

def get_connection():
    return psycopg2.connect(DATABASE_URL)

def query(sql: str, params: tuple = None) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()

def execute(sql: str, params: tuple = None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()
