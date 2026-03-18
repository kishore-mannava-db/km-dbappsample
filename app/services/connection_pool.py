"""Lakebase connection pool with RLS context and latency measurement."""
import time
import json
import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID
from contextlib import contextmanager

import psycopg2
from psycopg2 import pool, extras

from config import config

logger = logging.getLogger(__name__)

# Session-level planner overrides for cloud/SSD storage
_SESSION_SETTINGS = [
    "SET random_page_cost = 1.1",          # SSD/cloud storage — random reads are cheap
    "SET effective_io_concurrency = 200",   # Cloud storage supports high parallelism
    "SET jit = off",                        # Disable JIT for OLTP (short queries)
]

# Prepared statements for hot queries
_PREPARED_STMTS = {
    "get_participants_by_form": "SELECT * FROM participants_active WHERE form_ap_id = $1",
    "get_form_by_id": "SELECT * FROM form_ap_active WHERE form_ap_id = $1",
    "count_forms": "SELECT COUNT(*) as total FROM form_ap_active WHERE deleted_at IS NULL",
}


def _warmup_connection(conn):
    """Warm up a connection: set planner overrides, prepare hot queries, prime caches."""
    with conn.cursor() as cur:
        # Apply session-level planner settings
        for setting in _SESSION_SETTINGS:
            cur.execute(setting)
        # Prepare hot queries
        for name, sql in _PREPARED_STMTS.items():
            try:
                cur.execute(f"DEALLOCATE {name}")
            except Exception:
                conn.rollback()
                for s in _SESSION_SETTINGS:
                    cur.execute(s)
            cur.execute(f"PREPARE {name} AS {sql}")
        # Prime catalog cache
        cur.execute("SELECT 1")
    conn.commit()


class ConnectionPool:
    """Singleton connection pool for Lakebase."""

    _instance = None
    _pool: Optional[pool.ThreadedConnectionPool] = None

    @classmethod
    def get_instance(cls) -> "ConnectionPool":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def initialize(self):
        """Create the connection pool from config."""
        if not config.password or not config.user:
            logger.warning(f"Incomplete Lakebase credentials (user={config.user}, password_len={len(config.password) if config.password else 0}) — will try lazy init on first request.")
            return
        self._pool = pool.ThreadedConnectionPool(
            minconn=config.pool_min,
            maxconn=config.pool_max,
            host=config.host,
            port=config.port,
            database=config.database,
            user=config.user,
            password=config.password,
            sslmode=config.ssl_mode,
            options="-c search_path=public -c random_page_cost=1.1 -c jit=off",
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=3,
        )
        logger.info(f"Connection pool initialized (min={config.pool_min}, max={config.pool_max})")
        # Warm up pool connections with prepared statements
        for _ in range(config.pool_min):
            conn = self._pool.getconn()
            try:
                _warmup_connection(conn)
            finally:
                self._pool.putconn(conn)
        logger.info(f"Warmed up {config.pool_min} connections with {len(_PREPARED_STMTS)} prepared statements")

    def lazy_init_with_email(self, forwarded_email: str):
        """Initialize pool using forwarded user's identity for PG connection."""
        if self._pool is not None:
            return
        try:
            from databricks.sdk import WorkspaceClient
            from config import LAKEBASE_INSTANCE
            w = WorkspaceClient()
            instance = w.database.get_database_instance(name=LAKEBASE_INSTANCE)

            # Generate credential via SP — use SP UUID as PG user (role created in Lakebase)
            me = w.current_user.me()
            cred = w.database.generate_database_credential(
                request_id="lazy-init",
                instance_names=[LAKEBASE_INSTANCE],
            )
            pg_user = me.user_name  # SP UUID — must have a matching PG role
            pg_password = cred.token
            logger.info(f"Using SP identity for PG connection (user={pg_user})")

            config.host = instance.read_write_dns
            config.user = pg_user
            config.password = pg_password
            config.dev_user_email = forwarded_email
            self._pool = pool.ThreadedConnectionPool(
                minconn=config.pool_min, maxconn=config.pool_max,
                host=config.host, port=config.port, database=config.database,
                user=config.user, password=config.password,
                sslmode=config.ssl_mode, options="-c search_path=public -c random_page_cost=1.1 -c jit=off",
                keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=3,
            )
            logger.info(f"Lazy-initialized pool (host={config.host}, user={config.user})")
            for _ in range(config.pool_min):
                conn = self._pool.getconn()
                try:
                    _warmup_connection(conn)
                finally:
                    self._pool.putconn(conn)
            logger.info(f"Warmed up {config.pool_min} connections with {len(_PREPARED_STMTS)} prepared statements")
        except Exception as e:
            logger.error(f"Lazy init failed: {e}")
            raise

    @contextmanager
    def get_connection(self, user_email: Optional[str] = None):
        """Get connection with optional RLS context and planner overrides."""
        if self._pool is None:
            raise RuntimeError("Pool not initialized")
        conn = self._pool.getconn()
        try:
            conn.autocommit = False
            if user_email:
                with conn.cursor() as cur:
                    cur.execute("SET app.current_user_email = %s", (user_email,))
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self._pool.putconn(conn)

    @staticmethod
    def measure(func):
        """Execute function and return (result, latency_ms)."""
        start = time.perf_counter()
        result = func()
        latency = (time.perf_counter() - start) * 1000
        return result, latency

    def get_pool_stats(self) -> Dict[str, Any]:
        """Return pool utilization stats."""
        if self._pool is None:
            return {"initialized": False}
        return {
            "initialized": True,
            "min_connections": config.pool_min,
            "max_connections": config.pool_max,
            "ssl_mode": config.ssl_mode,
        }

    def execute_query(
        self,
        query: str,
        params: Optional[tuple] = None,
        user_email: Optional[str] = None,
        fetch: str = "all",
    ) -> Tuple[Any, float]:
        """Execute a query and return (result, latency_ms)."""
        with self.get_connection(user_email) as conn:
            with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
                def run():
                    cur.execute(query, params)
                    if fetch == "all":
                        return cur.fetchall()
                    elif fetch == "one":
                        return cur.fetchone()
                    elif fetch == "none":
                        return cur.rowcount
                    return None
                result, latency = self.measure(run)
        return result, latency

    def execute_prepared(
        self,
        stmt_name: str,
        params: Optional[tuple] = None,
        user_email: Optional[str] = None,
        fetch: str = "all",
    ) -> Tuple[Any, float]:
        """Execute a prepared statement by name and return (result, latency_ms).
        Falls back to preparing the statement if it doesn't exist on this connection."""
        with self.get_connection(user_email) as conn:
            with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
                def run():
                    param_str = ", ".join(["%s"] * len(params)) if params else ""
                    try:
                        cur.execute(f"EXECUTE {stmt_name}({param_str})", params)
                    except psycopg2.errors.InvalidSqlStatementName:
                        conn.rollback()
                        # Prepare on this connection and retry
                        if stmt_name in _PREPARED_STMTS:
                            cur.execute(f"PREPARE {stmt_name} AS {_PREPARED_STMTS[stmt_name]}")
                            cur.execute(f"EXECUTE {stmt_name}({param_str})", params)
                        else:
                            raise
                    if fetch == "all":
                        return cur.fetchall()
                    elif fetch == "one":
                        return cur.fetchone()
                    elif fetch == "none":
                        return cur.rowcount
                    return None
                result, latency = self.measure(run)
        return result, latency

    def execute_insert(
        self,
        query: str,
        params: Optional[tuple] = None,
        user_email: Optional[str] = None,
    ) -> Tuple[Dict, float]:
        """Execute INSERT ... RETURNING * and return (row, latency_ms)."""
        with self.get_connection(user_email) as conn:
            with conn.cursor(cursor_factory=extras.RealDictCursor) as cur:
                def run():
                    cur.execute(query, params)
                    return cur.fetchone()
                result, latency = self.measure(run)
        return dict(result) if result else {}, latency

    def close(self):
        if self._pool:
            self._pool.closeall()
            logger.info("Connection pool closed")
