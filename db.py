import os
from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row
from databricks.sdk import WorkspaceClient
from databricks.sdk.core import Config

# Databricks Apps auto-sets PGHOST, PGUSER, DATABRICKS_CLIENT_ID
# when you add a Database resource
app_config = Config()
_ws = WorkspaceClient()

_DB_HOST = os.getenv("PGHOST")
_DB_USER = app_config.client_id
_DB_NAME = os.getenv("PGDATABASE", "databricks_postgres")
_DB_PORT = os.getenv("PGPORT", "5432")


def get_connection():
    token = _ws.config.oauth_token().access_token
    return psycopg.connect(
        host=_DB_HOST,
        dbname=_DB_NAME,
        user=_DB_USER,
        password=token,
        port=_DB_PORT,
        sslmode="require",
        row_factory=dict_row,
    )


def query(sql: str, params: tuple = None) -> list[dict]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()


def execute(sql: str, params: tuple = None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()


@contextmanager
def with_connection():
    """Context manager: one connection for multiple operations. Caller must commit."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
