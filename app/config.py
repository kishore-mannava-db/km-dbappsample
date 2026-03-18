"""Centralized configuration — auto-detects Databricks Apps environment."""
import os
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

LAKEBASE_INSTANCE = os.getenv("LAKEBASE_INSTANCE", "ep-sweet-tooth-e9jitiad")
# Databricks Apps SP credentials (PG native login)
_SP_PG_USER = "ced0e5d0-51a7-49ae-aed1-ba7e5d66ed05"
_SP_PG_PASSWORD = ""
_SP_PG_HOST = "ep-sweet-tooth-e9jitiad.database.eastus.azuredatabricks.net"


def resolve_lakebase_creds():
    """Resolve Lakebase credentials — use SDK on Databricks Apps, env vars locally."""
    host = os.getenv("LAKEBASE_HOST")
    user = os.getenv("LAKEBASE_USER")
    password = os.getenv("LAKEBASE_PASSWORD")

    if host and password:
        logger.info(f"Using env var credentials for Lakebase (host={host})")
        return host, user or "postgres", password

    # Auto-detect: running on Databricks Apps (SDK auth available)
    try:
        from databricks.sdk import WorkspaceClient
        w = WorkspaceClient()
        instance = w.database.get_database_instance(name=LAKEBASE_INSTANCE)
        cred = w.database.generate_database_credential(
            request_id="lakebase-track-init",
            instance_names=[LAKEBASE_INSTANCE],
        )
        me = w.current_user.me()
        host = instance.read_write_dns
        user = me.user_name  # SP UUID — must have a matching PG role
        password = cred.token
        logger.info(f"Auto-resolved Lakebase credentials via SDK (host={host}, user={user})")
        return host, user, password
    except Exception as e:
        logger.warning(f"Could not auto-resolve Lakebase credentials: {e}")
        return None, None, None


@dataclass
class LakebaseConfig:
    host: str = os.getenv("LAKEBASE_HOST", _SP_PG_HOST)
    port: int = int(os.getenv("LAKEBASE_PORT", "5432"))
    database: str = os.getenv("LAKEBASE_DATABASE", "databricks_postgres")
    user: str = os.getenv("LAKEBASE_USER", _SP_PG_USER)
    password: str = os.getenv("LAKEBASE_PASSWORD", _SP_PG_PASSWORD)
    ssl_mode: str = os.getenv("LAKEBASE_SSL_MODE", "require")
    pool_min: int = int(os.getenv("POOL_MIN", "20"))
    pool_max: int = int(os.getenv("POOL_MAX", "200"))
    dev_user_email: str = os.getenv("DEV_USER_EMAIL", "")

    def resolve(self):
        """Resolve credentials — always prefer SDK auto-detection on Databricks Apps."""
        # If env vars were explicitly set, use those
        if os.getenv("LAKEBASE_HOST") and os.getenv("LAKEBASE_PASSWORD"):
            return
        # Try SDK auto-detection (Databricks Apps environment)
        host, user, password = resolve_lakebase_creds()
        if host and password:
            self.host = host
            self.user = user
            self.password = password
            self.dev_user_email = self.dev_user_email or user


config = LakebaseConfig()
