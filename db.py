import os
import threading
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

APP_ENV = os.getenv("APP_ENV", "databricks").strip().lower()
APP_TIER = os.getenv("APP_TIER", "prod").strip().lower()

_DB_HOST = (os.getenv("PGHOST") or "").strip()
_DB_PORT = (os.getenv("PGPORT") or "5432").strip()
_DB_NAME = (os.getenv("PGDATABASE") or "databricks_postgres").strip()
_ENDPOINT_NAME = (os.getenv("ENDPOINT_NAME") or "").strip()

_DB_USER = (os.getenv("PGUSER") or "").strip()
_DB_PASSWORD = os.getenv("PGPASSWORD") or ""

_DBX_APP_CONFIG = None
_DBX_WORKSPACE = None


def _is_databricks_host(host: str) -> bool:
    return ".databricks.com" in (host or "").lower()


def _validate_runtime() -> None:
    if APP_ENV not in {"local", "databricks"}:
        raise RuntimeError(f"Invalid APP_ENV={APP_ENV!r}. Expected one of: local, databricks.")
    if APP_TIER not in {"local", "staging", "prod"}:
        raise RuntimeError(f"Invalid APP_TIER={APP_TIER!r}. Expected one of: local, staging, prod.")

    if not _DB_HOST:
        raise RuntimeError("PGHOST is required.")

    if APP_ENV == "local":
        if _is_databricks_host(_DB_HOST):
            raise RuntimeError(
                "Refusing to start: APP_ENV=local but PGHOST points to Databricks. "
                "This prevents accidental remote writes from local mode."
            )
        if not _DB_USER or not _DB_PASSWORD:
            raise RuntimeError("APP_ENV=local requires PGUSER and PGPASSWORD.")
        if APP_TIER != "local":
            raise RuntimeError("APP_ENV=local requires APP_TIER=local.")
    else:
        if APP_TIER == "local":
            raise RuntimeError("APP_ENV=databricks cannot be used with APP_TIER=local.")
        if not _ENDPOINT_NAME:
            raise RuntimeError("ENDPOINT_NAME is required for Databricks credential generation.")
        # Same-endpoint isolation guard: staging must never point at production database.
        if APP_TIER == "staging" and _DB_NAME in {"", "databricks_postgres"}:
            raise RuntimeError(
                "FATAL: APP_TIER=staging but PGDATABASE is unset or points to "
                "production database databricks_postgres. Set PGDATABASE=lms_staging."
            )


def _init_databricks_clients_if_needed() -> None:
    global _DBX_APP_CONFIG, _DBX_WORKSPACE, _DB_USER
    if APP_ENV != "databricks":
        return
    try:
        from databricks.sdk import WorkspaceClient
        from databricks.sdk.core import Config
    except Exception as exc:
        raise RuntimeError(
            "APP_ENV=databricks requires databricks-sdk and Databricks auth context."
        ) from exc
    _DBX_APP_CONFIG = Config()
    _DBX_WORKSPACE = WorkspaceClient()
    _DB_USER = _DBX_APP_CONFIG.client_id


def get_runtime_context() -> dict:
    return {
        "env": APP_ENV,
        "tier": APP_TIER,
        "host": _DB_HOST,
        "db": _DB_NAME,
        "port": _DB_PORT,
        "endpoint": _ENDPOINT_NAME if APP_ENV == "databricks" else None,
    }

# ---------------------------------------------------------------------------
# Connection pool with fresh DB credential per new connection
# ---------------------------------------------------------------------------
# Databricks Lakebase uses short-lived credentials. The pool should not bake
# a token into conninfo. Instead, we inject a fresh credential in the custom
# connection class whenever psycopg opens a new socket.
# ---------------------------------------------------------------------------

_POOL_MIN = 2                 # pre-warmed connections
_POOL_MAX = 12                # concurrent limit

_lock = threading.Lock()
_pool: ConnectionPool | None = None


class OAuthConnection(psycopg.Connection):
    @classmethod
    def connect(cls, conninfo: str = "", **kwargs):
        if APP_ENV != "databricks":
            raise RuntimeError("OAuthConnection should only be used in APP_ENV=databricks.")
        endpoint_name = _ENDPOINT_NAME
        credential = _DBX_WORKSPACE.postgres.generate_database_credential(endpoint=endpoint_name)
        kwargs["password"] = credential.token
        return super().connect(conninfo, **kwargs)


def _ensure_pool() -> ConnectionPool:
    global _pool
    if _pool is not None:
        return _pool

    with _lock:
        if _pool is not None:
            return _pool

        if APP_ENV == "local":
            _ssl = os.getenv("PGSSLMODE", "").strip()
            conninfo = (
                f"host={_DB_HOST} dbname={_DB_NAME} user={_DB_USER} "
                f"port={_DB_PORT} password={_DB_PASSWORD}"
                + (f" sslmode={_ssl}" if _ssl else "")
            )
            _pool = ConnectionPool(
                conninfo=conninfo,
                min_size=_POOL_MIN,
                max_size=_POOL_MAX,
                max_lifetime=300,   # 5 min — Neon drops idle SSL connections ~5 min
                max_idle=60,        # recycle idle connections every 60s for Neon
                reconnect_timeout=10,
                kwargs={"row_factory": dict_row},
                open=True,
                timeout=30,
            )
        else:
            conninfo = (
                f"host={_DB_HOST} dbname={_DB_NAME} user={_DB_USER} "
                f"port={_DB_PORT} sslmode=require"
            )
            _pool = ConnectionPool(
                conninfo=conninfo,
                connection_class=OAuthConnection,
                min_size=_POOL_MIN,
                max_size=_POOL_MAX,
                max_lifetime=3600,
                max_idle=600,
                kwargs={"row_factory": dict_row},
                open=True,
                timeout=30,
            )

    return _pool


def get_connection():
    """Get a connection from the pool (context-manager compatible)."""
    return _ensure_pool().connection()


def query(sql: str, params: tuple = None) -> list[dict]:
    with _ensure_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if cur.description is None:
                conn.commit()
                return []
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
                if cur.description is None:
                    conn.commit()
                    results.append([])
                else:
                    results.append(cur.fetchall())
    return results


_validate_runtime()
_init_databricks_clients_if_needed()
print(
    f"[env] APP_ENV={APP_ENV} APP_TIER={APP_TIER} PGHOST={_DB_HOST} PGDATABASE={_DB_NAME}",
    flush=True,
)
