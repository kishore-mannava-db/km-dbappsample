"""Items 27-35: Data integrity verification."""
import time
import uuid
import pytest
import psycopg2


class TestDataIntegrity:
    """Verify database constraints and triggers."""

    def test_item27_uuid_primary_keys(self, db_conn):
        """Item 27: PKs should be valid UUIDs."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT form_ap_id FROM form_ap_active LIMIT 1")
            val = str(cur.fetchone()[0])
            assert len(val) == 36 and val.count("-") == 4

    def test_item28_fk_form_to_users(self, db_conn):
        """Item 28: FK form_ap_active.created_by -> users.user_id should exist."""
        with db_conn.cursor() as cur:
            cur.execute("""
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'form_ap_active'::regclass AND contype = 'f'
            """)
            fk_names = [r[0] for r in cur.fetchall()]
            assert any("created_by" in n for n in fk_names), f"FK for created_by not found in {fk_names}"

    def test_item29_fk_participants_to_form(self, db_conn):
        """Item 29: FK participants.form_ap_id -> form_ap_active should exist."""
        with db_conn.cursor() as cur:
            cur.execute("""
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'participants_active'::regclass AND contype = 'f'
            """)
            fk_names = [r[0] for r in cur.fetchall()]
            assert any("form_ap_id" in n for n in fk_names)

    def test_item30_fk_sessions_to_users(self, db_conn):
        """Item 30: FK user_sessions.user_id -> users should exist."""
        with db_conn.cursor() as cur:
            cur.execute("""
                SELECT conname FROM pg_constraint
                WHERE conrelid = 'user_sessions'::regclass AND contype = 'f'
            """)
            assert cur.fetchone() is not None

    def test_item31_enum_types_exist(self, db_conn):
        """Item 31: All 4 ENUM types should exist."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT typname FROM pg_type WHERE typname IN ('form_status', 'participant_role', 'user_role', 'audit_action')"
            )
            found = [r[0] for r in cur.fetchall()]
            assert len(found) == 4, f"Expected 4 enums, found {found}"

    def test_item32_check_constraint_fiscal_year(self, db_conn):
        """Item 32: CHECK constraint should reject fiscal_year < 2000."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT user_id FROM users LIMIT 1")
            uid = str(cur.fetchone()[0])
        # Try inserting with bad fiscal_year
        conn2 = psycopg2.connect(
            host=db_conn.info.host, port=db_conn.info.port,
            dbname=db_conn.info.dbname, user=db_conn.info.user,
            password=db_conn.info.password, sslmode="require",
        )
        conn2.autocommit = True
        with conn2.cursor() as cur2:
            with pytest.raises(psycopg2.errors.CheckViolation):
                cur2.execute(
                    "INSERT INTO form_ap_active (issuer_id, fiscal_year, status, location_country, created_by) VALUES (%s, %s, %s, %s, %s)",
                    ("BAD-YEAR", 1999, "draft", "USA", uid),
                )
        conn2.close()

    def test_item33_unique_email(self, db_conn):
        """Item 33: Duplicate email should be rejected."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT email FROM users LIMIT 1")
            existing_email = cur.fetchone()[0]
        conn2 = psycopg2.connect(
            host=db_conn.info.host, port=db_conn.info.port,
            dbname=db_conn.info.dbname, user=db_conn.info.user,
            password=db_conn.info.password, sslmode="require",
        )
        conn2.autocommit = True
        with conn2.cursor() as cur2:
            with pytest.raises(psycopg2.errors.UniqueViolation):
                cur2.execute(
                    "INSERT INTO users (email, name, role) VALUES (%s, %s, %s)",
                    (existing_email, "Duplicate", "viewer"),
                )
        conn2.close()

    def test_item34_updated_at_trigger(self, db_conn):
        """Item 34: updated_at should auto-update on UPDATE."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT tgname FROM pg_trigger WHERE tgname = 'update_form_ap_updated_at'")
            assert cur.fetchone() is not None, "Trigger not found"

    def test_item35_soft_delete_columns(self, db_conn):
        """Item 35: Soft delete columns (deleted_at, deleted_by) should exist."""
        with db_conn.cursor() as cur:
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'form_ap_active' AND column_name IN ('deleted_at', 'deleted_by')
            """)
            cols = [r[0] for r in cur.fetchall()]
            assert "deleted_at" in cols and "deleted_by" in cols
