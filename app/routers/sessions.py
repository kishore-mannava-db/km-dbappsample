"""Session endpoints."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from services.connection_pool import ConnectionPool
from models.schemas import SessionCreate, PaginatedResponse

router = APIRouter()


@router.get("")
async def list_sessions(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)):
    pool = ConnectionPool.get_instance()
    offset = (page - 1) * page_size
    count_result, _ = pool.execute_query("SELECT COUNT(*) as total FROM user_sessions", fetch="one")
    active_result, _ = pool.execute_query(
        "SELECT COUNT(*) as active FROM user_sessions WHERE last_activity > NOW() - INTERVAL '30 minutes'",
        fetch="one",
    )
    rows, latency = pool.execute_query(
        "SELECT * FROM user_sessions ORDER BY login_time DESC LIMIT %s OFFSET %s",
        (page_size, offset),
    )
    return {
        "items": [dict(r) for r in rows], "total": count_result["total"],
        "active_count": active_result["active"], "page": page, "page_size": page_size,
        "query_latency_ms": round(latency, 2),
    }


@router.post("", status_code=201)
async def create_session(data: SessionCreate):
    pool = ConnectionPool.get_instance()
    result, latency = pool.execute_insert(
        """INSERT INTO user_sessions (user_id, ip_address, user_agent)
           VALUES (%s, %s, %s) RETURNING *""",
        (str(data.user_id), data.ip_address, data.user_agent),
    )
    return {**result, "query_latency_ms": round(latency, 2)}


@router.delete("/{session_id}")
async def delete_session(session_id: UUID):
    pool = ConnectionPool.get_instance()
    result, latency = pool.execute_query(
        "DELETE FROM user_sessions WHERE session_id = %s",
        (str(session_id),), fetch="none",
    )
    if result == 0:
        raise HTTPException(404, "Session not found")
    return {"deleted": True, "query_latency_ms": round(latency, 2)}
