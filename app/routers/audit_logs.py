"""Audit log list endpoint."""
from typing import Optional

from fastapi import APIRouter, Query

from services.connection_pool import ConnectionPool
from models.schemas import PaginatedResponse

router = APIRouter()


@router.get("")
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user_email: Optional[str] = None,
    action: Optional[str] = None,
    table_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    pool = ConnectionPool.get_instance()
    conditions = []
    params = []

    if user_email:
        conditions.append("user_email = %s")
        params.append(user_email)
    if action:
        conditions.append("action = %s")
        params.append(action)
    if table_name:
        conditions.append("table_name = %s")
        params.append(table_name)
    if start_date:
        conditions.append("timestamp >= %s")
        params.append(start_date)
    if end_date:
        conditions.append("timestamp <= %s")
        params.append(end_date)

    where = " AND ".join(conditions) if conditions else "TRUE"
    offset = (page - 1) * page_size

    count_result, _ = pool.execute_query(
        f"SELECT COUNT(*) as total FROM audit_log_recent WHERE {where}",
        tuple(params), fetch="one",
    )
    rows, latency = pool.execute_query(
        f"SELECT * FROM audit_log_recent WHERE {where} ORDER BY timestamp DESC LIMIT %s OFFSET %s",
        tuple(params + [page_size, offset]),
    )
    return PaginatedResponse(
        items=[dict(r) for r in rows], total=count_result["total"],
        page=page, page_size=page_size, query_latency_ms=round(latency, 2),
    )
