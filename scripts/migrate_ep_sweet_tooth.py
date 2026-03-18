"""One-shot migration: apply optimizations to ep-sweet-tooth autoscaling endpoint.

Usage:
  export LAKEBASE_HOST=ep-sweet-tooth-e9jitiad.database.eastus.azuredatabricks.net
  export LAKEBASE_USER=<your-email-or-sp-uuid>
  export LAKEBASE_PASSWORD=<oauth-token>
  python scripts/migrate_ep_sweet_tooth.py
"""
import os
import sys
import psycopg2

HOST = os.getenv("LAKEBASE_HOST", "ep-sweet-tooth-e9jitiad.database.eastus.azuredatabricks.net")
PORT = int(os.getenv("LAKEBASE_PORT", "5432"))
DB = os.getenv("LAKEBASE_DATABASE", "databricks_postgres")
USER = os.getenv("LAKEBASE_USER")
PASSWORD = os.getenv("LAKEBASE_PASSWORD")

if not USER or not PASSWORD:
    print("ERROR: Set LAKEBASE_USER and LAKEBASE_PASSWORD env vars")
    sys.exit(1)

STEPS = [
    # --- Covering indexes ---
    ("Drop old idx_participant_form",
     "DROP INDEX IF EXISTS idx_participant_form;"),

    ("Create covering index on participants_active(form_ap_id)",
     """CREATE INDEX IF NOT EXISTS idx_participant_form_covering
        ON participants_active(form_ap_id)
        INCLUDE (participant_id, firm_name, firm_id, role, country, added_by, added_at);"""),

    ("Create covering index for RLS helper (users.email)",
     """CREATE INDEX IF NOT EXISTS idx_user_email_access
        ON users(email) INCLUDE (country_access, role);"""),

    ("Create pagination index on form_ap_active(created_at DESC)",
     """CREATE INDEX IF NOT EXISTS idx_form_ap_created_at_desc
        ON form_ap_active(created_at DESC) WHERE deleted_at IS NULL;"""),

    # --- Drop redundant indexes ---
    ("Drop idx_user_email (redundant with users_email_key)",
     "DROP INDEX IF EXISTS idx_user_email;"),
    ("Drop idx_audit_action (0 usage)",
     "DROP INDEX IF EXISTS idx_audit_action;"),
    ("Drop idx_audit_table (0 usage)",
     "DROP INDEX IF EXISTS idx_audit_table;"),
    ("Drop idx_audit_record (0 usage)",
     "DROP INDEX IF EXISTS idx_audit_record;"),
    ("Drop idx_audit_user_email (redundant with composite)",
     "DROP INDEX IF EXISTS idx_audit_user_email;"),

    # --- Cluster for heap locality ---
    ("CLUSTER participants_active using covering index",
     "CLUSTER participants_active USING idx_participant_form_covering;"),

    # --- SP role + security label ---
    ("Create SP role",
     """DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '227d9a03-e7d3-44e5-bd17-c67ab0e52dc9') THEN
         CREATE ROLE "227d9a03-e7d3-44e5-bd17-c67ab0e52dc9" LOGIN;
       END IF;
     END $$;"""),

    ("Grant privileges on tables",
     'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "227d9a03-e7d3-44e5-bd17-c67ab0e52dc9";'),

    ("Grant privileges on sequences",
     'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "227d9a03-e7d3-44e5-bd17-c67ab0e52dc9";'),

    ("Grant USAGE on schema public",
     'GRANT USAGE ON SCHEMA public TO "227d9a03-e7d3-44e5-bd17-c67ab0e52dc9";'),

    ("Grant BYPASSRLS",
     'ALTER ROLE "227d9a03-e7d3-44e5-bd17-c67ab0e52dc9" BYPASSRLS;'),

    ("Set security label for Databricks auth",
     """SECURITY LABEL FOR databricks_auth ON ROLE "227d9a03-e7d3-44e5-bd17-c67ab0e52dc9"
        IS 'id=141965117306646,type=SERVICE_PRINCIPAL';"""),

    # --- VACUUM ANALYZE ---
    ("VACUUM ANALYZE form_ap_active", "VACUUM ANALYZE form_ap_active;"),
    ("VACUUM ANALYZE participants_active", "VACUUM ANALYZE participants_active;"),
    ("VACUUM ANALYZE users", "VACUUM ANALYZE users;"),
    ("VACUUM ANALYZE user_sessions", "VACUUM ANALYZE user_sessions;"),
    ("VACUUM ANALYZE audit_log_recent", "VACUUM ANALYZE audit_log_recent;"),
]


def main():
    print(f"Connecting to {HOST}:{PORT}/{DB} as {USER} ...")
    conn = psycopg2.connect(host=HOST, port=PORT, database=DB, user=USER, password=PASSWORD, sslmode="require")
    conn.autocommit = True

    passed, failed = 0, 0
    for desc, sql in STEPS:
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
            print(f"  OK  {desc}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {desc}: {e}")
            failed += 1
            conn.rollback()

    conn.close()
    print(f"\nDone: {passed} passed, {failed} failed out of {len(STEPS)} steps.")


if __name__ == "__main__":
    main()
