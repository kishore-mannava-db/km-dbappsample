# Lakebase OLTP Evaluation Track

Standalone FastAPI application for evaluating Databricks Lakebase Autoscaling as an OLTP database. Tests 50 evaluation items across 7 categories: read performance, write performance, connection management, row-level security, data integrity, index coverage, and concurrency.

## Architecture

- **Database**: Lakebase (Postgres 16) instance `lakebase-poc-instance` on Azure Databricks
- **Data**: Reuses tables and ~165K records seeded by the FACT POC (`fact-poc/`)
- **Framework**: FastAPI with psycopg2 connection pooling
- **Tests**: pytest with 7 test files covering 50 evaluation items

## Tables (created by fact-poc, reused here)

| Table | Records | Purpose |
|-------|---------|---------|
| form_ap_active | 10,000 | Audit engagement forms |
| participants_active | 40,000 | Engagement participants |
| users | 15,000 | User accounts with JSONB country_access |
| user_sessions | 500 | Session tracking |
| audit_log_recent | 100,000 | Compliance audit trail |

## Quick Start

```bash
# 1. Install deps
cd lakebase-track
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Set environment variables
export LAKEBASE_HOST=instance-0c618cac-89c2-4bbe-aa0e-35f71ca18489.database.azuredatabricks.net
export LAKEBASE_USER=<your-email>
export LAKEBASE_PASSWORD=<oauth-token>
export LAKEBASE_DATABASE=databricks_postgres
export DEV_USER_EMAIL=<your-email>

# 3. Run the app
uvicorn app:app --host 127.0.0.1 --port 8003

# 4. Run all tests
pytest tests/ -v

# 5. Run specific test category
pytest tests/test_01_read_performance.py -v
pytest tests/test_04_rls_policies.py -v

# 6. Get full evaluation report
curl http://localhost:8003/api/eval/full-report | python3 -m json.tool
```

## Evaluation Categories

1. **Read Performance** (Items 1-6): PK lookup, pagination, filtered queries, FK joins
2. **Write Performance** (Items 7-11): INSERT, UPDATE, soft DELETE, FK validation, audit logging
3. **Connection Pool** (Items 12-18): Pool init, OAuth/SSL, RLS context, lifecycle
4. **Row-Level Security** (Items 19-26): Country-based filtering, admin bypass, policy enforcement
5. **Data Integrity** (Items 27-35): UUIDs, FKs, enums, CHECK, UNIQUE, triggers, soft delete
6. **Index Coverage** (Items 36-45): EXPLAIN plans, index scan verification, all 21 indexes
7. **Concurrency** (Items 46-50): 50/100/200 concurrent users, p95 latency, error rate

## Key Endpoints

- `GET /health` — Health check
- `GET /api/form-aps` — CRUD with pagination and filters
- `GET /api/eval/full-report` — Complete evaluation scorecard
- `GET /api/eval/read-performance` — Read latency benchmarks
- `GET /api/eval/rls-check` — RLS policy verification
- `GET /api/eval/index-check` — Index usage verification
- `POST /api/eval/concurrency-test` — Concurrent load test
- `GET /docs` — Swagger UI
