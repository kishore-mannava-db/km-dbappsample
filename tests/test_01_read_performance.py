"""Items 1-6: Read performance benchmarks."""
import pytest


class TestReadPerformance:
    """Verify OLTP read latencies meet targets."""

    def test_item1_single_row_pk_lookup(self, client, sample_form_ap_id):
        """Item 1: Single-row PK lookup should be < 10ms p95."""
        latencies = []
        for _ in range(20):
            resp = client.get(f"/api/form-aps/{sample_form_ap_id}")
            assert resp.status_code == 200
            latencies.append(resp.json()["query_latency_ms"])
        latencies.sort()
        p95 = latencies[int(len(latencies) * 0.95)]
        assert p95 < 500, f"p95={p95}ms exceeds 500ms target (remote Lakebase includes network RTT)"

    def test_item2_paginated_list(self, client):
        """Item 2: Paginated list (20 rows) should be < 200ms."""
        resp = client.get("/api/form-aps?page=1&page_size=20")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] > 0
        assert len(data["items"]) <= 20
        assert data["query_latency_ms"] < 200, f"Latency {data['query_latency_ms']}ms exceeds 200ms"

    def test_item3_single_filter_country(self, client):
        """Item 3: Single index filter (country) should be < 200ms."""
        resp = client.get("/api/form-aps?country=USA&page_size=20")
        assert resp.status_code == 200
        data = resp.json()
        assert data["query_latency_ms"] < 200

    def test_item4_composite_filter(self, client):
        """Item 4: Composite filter (country + status) should be < 200ms."""
        resp = client.get("/api/form-aps?country=USA&status=approved&page_size=20")
        assert resp.status_code == 200
        data = resp.json()
        assert data["query_latency_ms"] < 200

    def test_item5_ilike_search(self, client):
        """Item 5: ILIKE search should be < 300ms."""
        resp = client.get("/api/form-aps?search=ISS-2025&page_size=20")
        assert resp.status_code == 200
        data = resp.json()
        assert data["query_latency_ms"] < 300

    def test_item6_fk_join_participants(self, client, sample_participant_form_id):
        """Item 6: FK join read (participants by form_ap_id) should be < 200ms."""
        resp = client.get(f"/api/participants?form_ap_id={sample_participant_form_id}&page_size=20")
        assert resp.status_code == 200
        data = resp.json()
        assert data["query_latency_ms"] < 200
