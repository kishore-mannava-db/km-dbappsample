"""Shared fixtures for Lakebase OLTP evaluation tests."""
import os
import sys
import json
import pytest
import psycopg2
from psycopg2 import extras

# Add app to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def env_setup():
    """Load environment from /tmp/fact_poc_env.json if available."""
    env_file = "/tmp/fact_poc_env.json"
    if os.path.exists(env_file):
        with open(env_file) as f:
            env = json.load(f)
        for k, v in env.items():
            os.environ.setdefault(k, v)


@pytest.fixture(scope="session")
def client(env_setup):
    """FastAPI TestClient."""
    # Import the root app.py (not the app/ package)
    import importlib.util
    root_app_path = os.path.join(os.path.dirname(__file__), "..", "server.py")
    spec = importlib.util.spec_from_file_location("root_app", root_app_path)
    root_app_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(root_app_mod)
    with TestClient(root_app_mod.app) as c:
        yield c


@pytest.fixture(scope="session")
def db_conn(env_setup):
    """Direct psycopg2 connection for low-level assertions."""
    conn = psycopg2.connect(
        host=os.getenv("LAKEBASE_HOST", "localhost"),
        port=int(os.getenv("LAKEBASE_PORT", "5432")),
        database=os.getenv("LAKEBASE_DATABASE", "databricks_postgres"),
        user=os.getenv("LAKEBASE_USER", "postgres"),
        password=os.getenv("LAKEBASE_PASSWORD", ""),
        sslmode=os.getenv("LAKEBASE_SSL_MODE", "require"),
    )
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture(scope="session")
def sample_form_ap_id(db_conn):
    """Get a sample form_ap_id for read tests."""
    with db_conn.cursor() as cur:
        cur.execute("SELECT form_ap_id FROM form_ap_active WHERE deleted_at IS NULL LIMIT 1")
        row = cur.fetchone()
        return str(row[0]) if row else None


@pytest.fixture(scope="session")
def sample_user_id(db_conn):
    """Get a sample user_id."""
    with db_conn.cursor() as cur:
        cur.execute("SELECT user_id FROM users LIMIT 1")
        row = cur.fetchone()
        return str(row[0]) if row else None


@pytest.fixture(scope="session")
def sample_participant_form_id(db_conn):
    """Get a form_ap_id that has participants."""
    with db_conn.cursor() as cur:
        cur.execute("SELECT form_ap_id FROM participants_active LIMIT 1")
        row = cur.fetchone()
        return str(row[0]) if row else None


@pytest.fixture(scope="session")
def admin_email(db_conn):
    """Get an admin user's email."""
    with db_conn.cursor() as cur:
        cur.execute("SELECT email FROM users WHERE role = 'admin' LIMIT 1")
        row = cur.fetchone()
        return row[0] if row else None


@pytest.fixture(scope="session")
def country_manager_email(db_conn):
    """Get a country_manager user's email."""
    with db_conn.cursor() as cur:
        cur.execute("SELECT email FROM users WHERE role = 'country_manager' LIMIT 1")
        row = cur.fetchone()
        return row[0] if row else None


@pytest.fixture(scope="session")
def viewer_email(db_conn):
    """Get a viewer user's email."""
    with db_conn.cursor() as cur:
        cur.execute("SELECT email FROM users WHERE role = 'viewer' LIMIT 1")
        row = cur.fetchone()
        return row[0] if row else None
