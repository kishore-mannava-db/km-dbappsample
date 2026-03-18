# Lakebase OLTP Evaluation Track

A full-stack application for evaluating [Databricks Lakebase Autoscaling](https://docs.databricks.com/en/database/lakebase/index.html) as an OLTP database. Runs **50 evaluation items** across 7 categories and presents results through both a REST API and a React dashboard.

## What This Does

Lakebase is Databricks' managed PostgreSQL offering. This project provides a structured, repeatable evaluation framework to answer: **"Is Lakebase ready for my OLTP workload?"**

It tests real queries against ~165K rows across 5 tables, measuring latency, correctness, concurrency limits, and Postgres-native features like row-level security and index coverage.

## Evaluation Categories

| # | Category | Items | What's Tested |
|---|----------|-------|---------------|
| 1 | **Read Performance** | 1-6 | PK lookup, pagination, filtered queries, FK joins |
| 2 | **Write Performance** | 7-11 | INSERT, UPDATE, soft DELETE, FK validation, audit logging |
| 3 | **Connection Pool** | 12-18 | Pool init, OAuth/SSL, RLS context, lifecycle |
| 4 | **Row-Level Security** | 19-26 | Country-based filtering, admin bypass, policy enforcement |
| 5 | **Data Integrity** | 27-35 | UUIDs, FKs, enums, CHECK, UNIQUE, triggers, soft delete |
| 6 | **Index Coverage** | 36-45 | EXPLAIN plans, index scan verification across 21 indexes |
| 7 | **Concurrency** | 46-50 | 50/100/200 concurrent users, p95 latency, error rate |

## Tech Stack

- **Backend**: Python 3.10+, FastAPI, psycopg2 connection pooling
- **Frontend**: React + TypeScript
- **Database**: Lakebase (Postgres 16) on Azure Databricks
- **Tests**: pytest (7 test files, 50 evaluation items)
- **Deployment**: Databricks Apps via Asset Bundles

## Project Structure

```
lakebase-track/
├── app/
│   ├── config.py              # Credentials auto-detection (SDK / env vars)
│   ├── main.py                # FastAPI app with lifespan and middleware
│   ├── middleware/             # Request timing
│   ├── models/                # Pydantic schemas and enums
│   ├── routers/               # API endpoints (form-aps, users, eval, etc.)
│   └── services/              # Connection pool, audit service
├── frontend/
│   └── src/components/        # React dashboard (eval runner, data viewers)
├── tests/
│   ├── test_01_read_performance.py
│   ├── test_02_write_performance.py
│   ├── test_03_connection_pool.py
│   ├── test_04_rls_policies.py
│   ├── test_05_data_integrity.py
│   ├── test_06_index_coverage.py
│   └── test_07_concurrency.py
├── scripts/
│   └── migrate_ep_sweet_tooth.py   # Lakebase instance migration helper
├── resources/
│   └── app_deployment.yml          # Databricks Apps deployment config
├── databricks.yml                  # Asset Bundle definition
├── requirements.txt
└── app.yml                         # App entrypoint
```

## Prerequisites

- Python 3.10+
- A Databricks workspace with a Lakebase instance provisioned
- Tables seeded with data (see [Database Tables](#database-tables) below)

## Quick Start

### 1. Install dependencies

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Set environment variables

```bash
export LAKEBASE_HOST=<your-lakebase-instance>.database.azuredatabricks.net
export LAKEBASE_USER=<your-email-or-sp-uuid>
export LAKEBASE_PASSWORD=<oauth-token>
export LAKEBASE_DATABASE=databricks_postgres
export DEV_USER_EMAIL=<your-email>
```

> **Note:** When deployed as a Databricks App, credentials are resolved automatically via the Databricks SDK — no env vars needed.

### 3. Run the API server

```bash
uvicorn app:app --host 127.0.0.1 --port 8003
```

### 4. Open the Swagger UI

Visit [http://localhost:8003/docs](http://localhost:8003/docs) to explore all endpoints interactively.

### 5. Build the frontend (optional)

```bash
cd frontend && npm install && npm run build && cd ..
```

## Running the Evaluation

### Via API

```bash
# Full scorecard
curl http://localhost:8003/api/eval/full-report | python3 -m json.tool

# Individual categories
curl http://localhost:8003/api/eval/read-performance
curl http://localhost:8003/api/eval/rls-check
curl http://localhost:8003/api/eval/index-check
```

### Via pytest

```bash
# All 50 items
pytest tests/ -v

# Single category
pytest tests/test_01_read_performance.py -v
pytest tests/test_04_rls_policies.py -v
pytest tests/test_07_concurrency.py -v
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check and pool status |
| GET | `/api/form-aps` | CRUD with pagination and filters |
| GET | `/api/participants` | Participant records |
| GET | `/api/users` | User accounts |
| GET | `/api/sessions` | Session tracking |
| GET | `/api/audit` | Audit log entries |
| GET | `/api/eval/full-report` | Complete evaluation scorecard |
| GET | `/api/eval/read-performance` | Read latency benchmarks |
| GET | `/api/eval/rls-check` | RLS policy verification |
| GET | `/api/eval/index-check` | Index usage verification |
| POST | `/api/eval/concurrency-test` | Concurrent load test |

## Database Tables

The evaluation runs against these tables (~165K total rows):

| Table | Records | Purpose |
|-------|---------|---------|
| `form_ap_active` | 10,000 | Audit engagement forms |
| `participants_active` | 40,000 | Engagement participants |
| `users` | 15,000 | User accounts with JSONB `country_access` |
| `user_sessions` | 500 | Session tracking |
| `audit_log_recent` | 100,000 | Compliance audit trail |

## Deploying to Databricks Apps

This project includes a [Databricks Asset Bundle](https://docs.databricks.com/en/dev-tools/bundles/index.html) configuration for deployment:

```bash
# Validate the bundle
databricks bundle validate

# Deploy to the dev target
databricks bundle deploy

# Run the app
databricks bundle run
```

The `app.yml` entrypoint starts uvicorn on port 8000 for the Databricks Apps runtime.

## Configuration

All configuration is managed through environment variables with sensible defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `LAKEBASE_HOST` | SP host | Lakebase instance hostname |
| `LAKEBASE_PORT` | `5432` | PostgreSQL port |
| `LAKEBASE_DATABASE` | `databricks_postgres` | Database name |
| `LAKEBASE_USER` | SP UUID | PostgreSQL user |
| `LAKEBASE_PASSWORD` | *(empty)* | OAuth token or password |
| `LAKEBASE_SSL_MODE` | `require` | SSL mode |
| `POOL_MIN` | `20` | Min connection pool size |
| `POOL_MAX` | `200` | Max connection pool size |
| `DEV_USER_EMAIL` | *(empty)* | Email for local RLS context |
