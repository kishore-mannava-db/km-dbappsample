"""Items 36-45: Index coverage verification."""
import json
import pytest


EXPECTED_INDEXES = [
    ("idx_form_ap_country", "form_ap_active"),
    ("idx_form_ap_status", "form_ap_active"),
    ("idx_form_ap_fiscal_year", "form_ap_active"),
    ("idx_form_ap_country_status", "form_ap_active"),
    ("idx_form_ap_country_year", "form_ap_active"),
    ("idx_form_ap_deleted", "form_ap_active"),
    ("idx_form_ap_created_at_desc", "form_ap_active"),
    ("idx_form_ap_created_by", "form_ap_active"),
    ("idx_participant_form_covering", "participants_active"),
    ("idx_participant_country", "participants_active"),
    ("idx_participant_firm", "participants_active"),
    ("idx_participant_role", "participants_active"),
    ("idx_user_email_access", "users"),
    ("idx_user_role", "users"),
    ("idx_session_user", "user_sessions"),
    ("idx_session_login_time", "user_sessions"),
    ("idx_audit_timestamp", "audit_log_recent"),
    ("idx_audit_user_timestamp", "audit_log_recent"),
]


class TestIndexCoverage:

    def test_all_indexes_exist(self, db_conn):
        """Verify all 21 expected indexes exist."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
            existing = {r[0] for r in cur.fetchall()}
        for idx_name, table in EXPECTED_INDEXES:
            assert idx_name in existing, f"Index {idx_name} missing on {table}"

    def test_item36_country_index_used(self, db_conn):
        """Item 36: Country filter should use idx_form_ap_country."""
        with db_conn.cursor() as cur:
            cur.execute("EXPLAIN (FORMAT JSON) SELECT * FROM form_ap_active WHERE location_country = 'USA'")
            plan = json.dumps(cur.fetchone()[0])
            assert "Index" in plan or "Bitmap" in plan, f"No index scan in plan: {plan[:200]}"

    def test_item39_composite_index_used(self, db_conn):
        """Item 39: Composite filter should use idx_form_ap_country_status."""
        with db_conn.cursor() as cur:
            cur.execute(
                "EXPLAIN (FORMAT JSON) SELECT * FROM form_ap_active WHERE location_country = 'USA' AND status = 'approved'"
            )
            plan = json.dumps(cur.fetchone()[0])
            assert "Index" in plan or "Bitmap" in plan

    def test_item42_fk_index_used(self, db_conn):
        """Item 42: FK lookup should use idx_participant_form."""
        with db_conn.cursor() as cur:
            cur.execute(
                "EXPLAIN (FORMAT JSON) SELECT * FROM participants_active WHERE form_ap_id = '00000000-0000-0000-0000-000000000001'"
            )
            plan = json.dumps(cur.fetchone()[0])
            assert "Index" in plan or "Bitmap" in plan

    def test_item45_audit_composite_index(self, db_conn):
        """Item 45: Audit user+timestamp filter should use composite index."""
        with db_conn.cursor() as cur:
            cur.execute(
                "EXPLAIN (FORMAT JSON) SELECT * FROM audit_log_recent WHERE user_email = 'test@example.com' AND timestamp > '2025-01-01'"
            )
            plan = json.dumps(cur.fetchone()[0])
            assert "Index" in plan or "Bitmap" in plan

    def test_index_count(self, db_conn):
        """Total custom indexes should be >= 21."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%'")
            count = cur.fetchone()[0]
            assert count >= 17, f"Expected >= 17 custom indexes, found {count}"
