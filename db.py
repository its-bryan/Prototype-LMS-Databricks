import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Try Databricks secrets first, fall back to env var
try:
    from databricks.sdk import WorkspaceClient
    w = WorkspaceClient()
    DATABASE_URL = w.dbutils.secrets.get(scope="lms", key="database-url")
except Exception:
    DATABASE_URL = os.environ.get("DATABASE_URL", "")

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
