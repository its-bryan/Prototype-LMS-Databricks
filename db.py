import os, time, threading
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool
from databricks.sdk import WorkspaceClient
from databricks.sdk.core import Config

app_config = Config()
_ws = WorkspaceClient()

_DB_HOST = os.getenv("PGHOST")
_DB_USER = app_config.client_id
_DB_NAME = os.getenv("PGDATABASE", "databricks_postgres")
_DB_PORT = os.getenv("PGPORT", "5432")

# ---------------------------------------------------------------------------
# Connection pool with OAuth token refresh
# ---------------------------------------------------------------------------
# Databricks Lakebase uses short-lived OAuth tokens as the Postgres password.
# Once a TCP connection is authenticated, the token is no longer checked, so
# pooled connections stay valid.  We recreate the pool every _POOL_MAX_AGE
# seconds so that *new* connections always use a fresh token.
# ---------------------------------------------------------------------------

_POOL_MAX_AGE = 1800          # recreate pool every 30 min
_POOL_MIN = 2                 # pre-warmed connections
_POOL_MAX = 12                # concurrent limit

_lock = threading.Lock()
_pool: ConnectionPool | None = None
_pool_created_at: float = 0


def _make_conninfo() -> str:
    token = _ws.config.oauth_token().access_token
    return (
        f"host={_DB_HOST} dbname={_DB_NAME} user={_DB_USER} "
        f"password={token} port={_DB_PORT} sslmode=require"
    )


def _ensure_pool() -> ConnectionPool:
    global _pool, _pool_created_at
    now = time.monotonic()
    if _pool is not None and (now - _pool_created_at) < _POOL_MAX_AGE:
        return _pool

    with _lock:
        now = time.monotonic()
        if _pool is not None and (now - _pool_created_at) < _POOL_MAX_AGE:
            return _pool

        old = _pool
        conninfo = _make_conninfo()
        _pool = ConnectionPool(
            conninfo=conninfo,
            min_size=_POOL_MIN,
            max_size=_POOL_MAX,
            max_lifetime=3600,
            max_idle=600,
            kwargs={"row_factory": dict_row},
            open=True,
            timeout=30,
        )
        _pool_created_at = now

        if old is not None:
            try:
                old.close(timeout=5)
            except Exception:
                pass

    return _pool


def get_connection():
    """Get a connection from the pool (context-manager compatible)."""
    return _ensure_pool().connection()


def query(sql: str, params: tuple = None) -> list[dict]:
    with _ensure_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()


def execute(sql: str, params: tuple = None):
    with _ensure_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
        conn.commit()


@contextmanager
def with_connection():
    """Context manager: one connection for multiple operations. Caller must commit."""
    with _ensure_pool().connection() as conn:
        yield conn
        conn.commit()


def multi_query(queries: list[tuple[str, tuple | None]]) -> list[list[dict]]:
    """Run multiple SELECT queries on a single pooled connection.
    Returns a list of result-sets (one per query)."""
    results = []
    with _ensure_pool().connection() as conn:
        with conn.cursor() as cur:
            for sql, params in queries:
                cur.execute(sql, params)
                results.append(cur.fetchall())
    return results
