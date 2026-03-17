import os
import base64
from urllib.parse import urlparse
import psycopg2
from psycopg2.extras import RealDictCursor
from databricks.sdk import WorkspaceClient

# Shared WorkspaceClient for token generation
_ws = WorkspaceClient()

# Parse host/database/user from the stored connection string (once at startup)
_raw_url = os.environ.get("DATABASE_URL", "")
if not _raw_url:
    resp = _ws.secrets.get_secret(scope="lms", key="database-url")
    _raw_url = base64.b64decode(resp.value).decode("utf-8")

_parsed = urlparse(_raw_url)
_DB_HOST = _parsed.hostname
_DB_NAME = _parsed.path.lstrip("/")
_DB_USER = _parsed.username


def get_connection():
    # Generate a fresh OAuth token for every connection (tokens expire)
    headers = _ws.config.authenticate()
    token = headers.get("Authorization", "").replace("Bearer ", "")
    return psycopg2.connect(
        host=_DB_HOST,
        database=_DB_NAME,
        user=_DB_USER,
        password=token,
        sslmode="require",
    )

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
