import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Databricks Apps injects secrets as env vars via app.yaml valueFrom
DATABASE_URL = os.environ.get("DATABASE_URL", "")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is not set. Check app.yaml env config and the 'lms' secret scope."
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
