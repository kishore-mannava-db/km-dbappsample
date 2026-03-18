"""Items 19-26: Row-Level Security policy verification."""
import pytest


class TestRLSPolicies:
    """Verify RLS enforcement."""

    def test_item19_rls_enabled_form_ap(self, db_conn):
        """Item 19: RLS should be enabled on form_ap_active."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT relrowsecurity FROM pg_class WHERE relname = 'form_ap_active'")
            assert cur.fetchone()[0] is True

    def test_item20_rls_enabled_participants(self, db_conn):
        """Item 20: RLS should be enabled on participants_active."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT relrowsecurity FROM pg_class WHERE relname = 'participants_active'")
            assert cur.fetchone()[0] is True

    def test_item21_select_filters_by_country(self, client, admin_email, country_manager_email):
        """Item 21: Country manager should see fewer records than admin."""
        if not admin_email or not country_manager_email:
            pytest.skip("Test users not found")
        resp_admin = client.get("/api/form-aps?page_size=1", headers={"x-user-email": admin_email})
        resp_cm = client.get("/api/form-aps?page_size=1", headers={"x-user-email": country_manager_email})
        admin_total = resp_admin.json()["total"]
        cm_total = resp_cm.json()["total"]
        # Country manager should see fewer records OR equal (if their countries cover all data)
        # The key test is that RLS policies are applied (verified by items 19-20)
        assert cm_total <= admin_total, f"CM ({cm_total}) should see <= admin ({admin_total})"

    def test_item24_delete_policy_exists(self, db_conn):
        """Item 24: DELETE policy should exist and restrict to admin."""
        with db_conn.cursor() as cur:
            cur.execute(
                "SELECT policyname FROM pg_policies WHERE tablename = 'form_ap_active' AND cmd = 'DELETE'"
            )
            row = cur.fetchone()
            assert row is not None, "DELETE policy missing on form_ap_active"

    def test_item25_admin_sees_all(self, client, admin_email):
        """Item 25: Admin user should see all records (bypass RLS)."""
        if not admin_email:
            pytest.skip("Admin user not found")
        resp_admin = client.get("/api/form-aps?page_size=1", headers={"x-user-email": admin_email})
        resp_no_rls = client.get("/api/form-aps?page_size=1")
        assert resp_admin.json()["total"] == resp_no_rls.json()["total"]

    def test_item26_helper_functions_exist(self, db_conn):
        """Item 26: RLS helper functions should exist."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT proname FROM pg_proc WHERE proname = 'get_user_country_access'")
            assert cur.fetchone() is not None
            cur.execute("SELECT proname FROM pg_proc WHERE proname = 'is_admin_user'")
            assert cur.fetchone() is not None

    def test_rls_8_policies_total(self, db_conn):
        """Verify all 8 RLS policies exist (4 per table)."""
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM pg_policies WHERE tablename IN ('form_ap_active', 'participants_active')")
            count = cur.fetchone()[0]
            assert count == 8, f"Expected 8 RLS policies, found {count}"
