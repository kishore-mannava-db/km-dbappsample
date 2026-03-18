# Lakebase OLTP Evaluation Report

**Instance**: `lakebase-autoscale-eval` (CU_1, Postgres 16)
**Workspace**: `adb-7405611631912143` (pii-demo)
**Dataset**: 165,500 records across 5 tables
**Date**: 2026-03-17

---

## Evaluation Summary

| Category | Passed | Total | Rate |
|----------|--------|-------|------|
| Read Performance | 6 | 6 | 100% |
| Write Performance | 4 | 5 | 80% |
| Connection Pool | 7 | 7 | 100% |
| Row-Level Security | 8 | 8 | 100% |
| Data Integrity | 9 | 9 | 100% |
| Index Coverage | 10 | 10 | 100% |
| **Overall** | **44** | **45** | **97.8%** |

---

## Database Configuration

### Server Parameters (Retrieved from Lakebase)

| Parameter | Value | Recommendation |
|-----------|-------|----------------|
| `shared_buffers` | 230 MB | Sufficient for 165K rows (~43 MB total) |
| `effective_cache_size` | 10 GB | Good — allows planner to assume OS caching |
| `work_mem` | 4 MB | Adequate for OLTP queries |
| `maintenance_work_mem` | 64 MB | Fine for VACUUM/CREATE INDEX |
| `random_page_cost` | 4.0 (default) | **Override to 1.1** — cloud/SSD storage |
| `seq_page_cost` | 1.0 | Default, correct |
| `effective_io_concurrency` | 20 | **Override to 200** for cloud storage |
| `jit` | on | **Override to off** for OLTP (short queries) |
| `max_connections` | 1000 | Ample headroom |
| `synchronous_commit` | on | Durability guaranteed |
| `fsync` | off | Lakebase manages durability at storage layer |
| `autovacuum` | on | Running every 60s with 3 workers |

### Critical Finding: `random_page_cost = 4.0`

The default `random_page_cost=4.0` was the **primary performance bottleneck**. This parameter tells the query planner that random I/O is 4x more expensive than sequential I/O — true for spinning disks, but wrong for cloud/SSD storage where random reads cost roughly the same as sequential.

**Impact**: The planner avoided index scans and preferred sequential or bitmap heap scans, even for PK lookups and indexed filters.

**Fix**: Set `random_page_cost = 1.1` at the session level. Results:

| Query | Before (4.0) | After (1.1) | Improvement |
|-------|-------------|-------------|-------------|
| PK lookup | 28.03 ms | 8.78 ms | **-69%** |
| FK index lookup | 28.99 ms | 5.54 ms | **-81%** |
| Composite filter | 14.52 ms | 7.00 ms | **-52%** |
| Single UPDATE | 48.91 ms | 29.34 ms | **-40%** |
| Paginated list | 12.56 ms | 9.64 ms | **-23%** |

---

## Performance Results (50 Concurrent Users)

### Read Performance — 6/6 Passed

| # | Query | p50 | p95 | p99 | Target |
|---|-------|-----|-----|-----|--------|
| 1 | Single-row PK lookup | 4.24 ms | 8.78 ms | 21.60 ms | < 10 ms |
| 2 | Paginated list (20 rows) | 4.73 ms | 9.64 ms | 15.22 ms | < 200 ms |
| 3 | Country filter (indexed) | 4.96 ms | 10.37 ms | 10.96 ms | < 200 ms |
| 4 | Country + status (composite) | 4.68 ms | 7.00 ms | 11.76 ms | < 200 ms |
| 5 | ILIKE search | 4.73 ms | 11.20 ms | 24.61 ms | < 300 ms |
| 6 | FK join (participants) | 3.97 ms | 5.54 ms | 6.80 ms | < 200 ms |

### Write Performance — 4/5 Passed

| # | Operation | p50 | p95 | p99 | Target | Status |
|---|-----------|-----|-----|-----|--------|--------|
| 7 | Single INSERT | 5.28 ms | 26.75 ms | 42.60 ms | < 50 ms | PASS |
| 8 | Single UPDATE | 11.23 ms | 29.34 ms | 36.91 ms | < 50 ms | PASS |
| 9 | Soft DELETE | 7.62 ms | 19.50 ms | 33.96 ms | < 50 ms | PASS |
| 10 | INSERT with FK validation | 39.00 ms | 68.36 ms | 81.90 ms | < 50 ms | **FAIL** |
| 11 | Write + audit (same txn) | 9.02 ms | 28.20 ms | 29.23 ms | < 100 ms | PASS |

**Item 10 Root Cause**: Each INSERT into `participants_active` validates FKs against both `form_ap_active` and `users`. Under 50 concurrent inserts, FK index lookups on both parent tables create lock contention. The p50 of 39ms shows this is inherently expensive.

---

## Connection Pool Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| `pool_min` | 20 | Warm connections ready at startup |
| `pool_max` | 200 | Headroom for burst traffic |
| SSL mode | `require` | Enforced for all connections |
| Keepalives | 30s idle / 10s interval / 3 retries | Prevents stale connections |
| Auth | OAuth token (938 bytes) | Auto-generated via Databricks SDK |

### Connection Warmup

Each pooled connection is initialized with:
1. Session planner overrides (`random_page_cost=1.1`, `jit=off`)
2. Prepared statements for hot queries
3. Catalog cache priming via `SELECT 1`

---

## Best Practices for Lakebase OLTP

### 1. Session-Level Planner Overrides (Critical)

Always set these on every connection for cloud/SSD storage:

```sql
SET random_page_cost = 1.1;        -- Cloud storage: random ≈ sequential
SET effective_io_concurrency = 200; -- Cloud storage supports high parallelism
SET jit = off;                      -- Disable JIT for short OLTP queries
```

Apply via connection pool warmup or `options` parameter:
```python
psycopg2.connect(..., options="-c random_page_cost=1.1 -c jit=off")
```

### 2. Connection Pooling

- **Use `ThreadedConnectionPool`** with `minconn` set to expected concurrency
- **Warm connections at startup** — prepare statements, set session vars
- **Keep `pool_min` ≤ 20** — Databricks Apps MEDIUM compute can't sustain 50+ warm connections
- **Set keepalives** to prevent cloud load balancers from dropping idle connections:
  ```python
  keepalives=1, keepalives_idle=30, keepalives_interval=10, keepalives_count=3
  ```

### 3. Index Strategy

- **Always create indexes for FK columns** — Postgres doesn't auto-index FKs
- **Use composite indexes** for common filter combinations (`country + status`)
- **Use partial indexes** for soft-delete patterns: `WHERE deleted_at IS NULL`
- **Add covering indexes** with `INCLUDE` to enable index-only scans:
  ```sql
  CREATE INDEX idx_participant_form_covering
    ON participants_active(form_ap_id)
    INCLUDE (participant_id, firm_name, firm_id, role, country, added_by, added_at);
  ```
- **CLUSTER tables** by the most common lookup key to colocate rows on disk:
  ```sql
  CLUSTER participants_active USING idx_participant_form;
  ```

### 4. RLS (Row-Level Security)

- Use `SECURITY DEFINER` functions for RLS helper lookups (avoids permission issues)
- Grant `BYPASSRLS` to service principals that don't need row filtering
- RLS policies add ~0.5ms planning overhead per query — acceptable for OLTP
- Test with `SET app.current_user_email = 'user@example.com'` before queries

### 5. Service Principal Setup for Databricks Apps

Lakebase requires a PG role + security label for the app's SP to connect:

```sql
-- Create PG role for the service principal
CREATE ROLE "sp-client-id-uuid" LOGIN;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "sp-client-id-uuid";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "sp-client-id-uuid";
GRANT USAGE ON SCHEMA public TO "sp-client-id-uuid";
ALTER ROLE "sp-client-id-uuid" BYPASSRLS;

-- Map PG role to Databricks identity
SECURITY LABEL FOR databricks_auth ON ROLE "sp-client-id-uuid"
  IS 'id=<sp-numeric-id>,type=SERVICE_PRINCIPAL';
```

The app then uses `WorkspaceClient().database.generate_database_credential()` for OAuth tokens.

### 6. Write Performance

- **Avoid concurrent updates to the same row** — use unique row selection, not `LIMIT 1`
- **FK validation adds latency** — ~40ms p50 under 50 concurrent inserts
- **Batch inserts** with `execute_values()` for bulk operations (10x faster than individual INSERTs)
- **Use `synchronous_commit = off`** for non-critical writes to reduce WAL flush latency

### 7. Monitoring

Use `pg_stat_statements` to identify slow queries:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT LEFT(query, 100) as query, calls,
       round(mean_exec_time::numeric, 2) as avg_ms,
       round(max_exec_time::numeric, 2) as max_ms,
       rows
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
ORDER BY total_exec_time DESC
LIMIT 20;
```

Check table bloat:
```sql
SELECT relname, n_live_tup, n_dead_tup,
       CASE WHEN n_live_tup > 0
            THEN round(100.0 * n_dead_tup / n_live_tup, 1) ELSE 0 END as dead_pct
FROM pg_stat_user_tables ORDER BY dead_pct DESC;
```

---

## Optimization Timeline

| Phase | Change | Pass Rate | Key Improvement |
|-------|--------|-----------|-----------------|
| Baseline | Default config | 23.1% | Pool not initialized |
| SP Auth Fix | PG role + security label | 95.6% | Connection established |
| CLUSTER + Indexes | Covering index, pagination index | 95.6% | Item 6 p95: 11→5ms |
| Pool min=20 | Increased warm connections | 95.6% | Soft DELETE p95: -37% |
| random_page_cost=1.1 | Session planner override | **97.8%** | All reads -23% to -81% |
| JIT=off | Disable JIT for OLTP | **97.8%** | Eliminates JIT compile overhead |
