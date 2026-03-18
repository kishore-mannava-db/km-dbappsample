"""User CRUD endpoints."""
import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Header

from services.connection_pool import ConnectionPool
from models.schemas import UserCreate, PaginatedResponse

router = APIRouter()


@router.get("")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    search: Optional[str] = None,
):
    pool = ConnectionPool.get_instance()
    conditions = []
    params = []
    if role:
        conditions.append("role = %s")
        params.append(role)
    if search:
        conditions.append("(email ILIKE %s OR name ILIKE %s)")
        params.extend([f"%{search}%", f"%{search}%"])

    where = " AND ".join(conditions) if conditions else "TRUE"
    offset = (page - 1) * page_size

    count_result, _ = pool.execute_query(
        f"SELECT COUNT(*) as total FROM users WHERE {where}", tuple(params), fetch="one",
    )
    rows, latency = pool.execute_query(
        f"SELECT * FROM users WHERE {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        tuple(params + [page_size, offset]),
    )
    return PaginatedResponse(
        items=[dict(r) for r in rows], total=count_result["total"],
        page=page, page_size=page_size, query_latency_ms=round(latency, 2),
    )


@router.get("/{user_id}")
async def get_user(user_id: UUID):
    pool = ConnectionPool.get_instance()
    result, latency = pool.execute_query(
        "SELECT * FROM users WHERE user_id = %s", (str(user_id),), fetch="one",
    )
    if not result:
        raise HTTPException(404, "User not found")
    return {**dict(result), "query_latency_ms": round(latency, 2)}


@router.post("", status_code=201)
async def create_user(data: UserCreate):
    pool = ConnectionPool.get_instance()
    result, latency = pool.execute_insert(
        """INSERT INTO users (email, name, role, country_access)
           VALUES (%s, %s, %s, %s::jsonb) RETURNING *""",
        (data.email, data.name, data.role.value, json.dumps(data.country_access)),
    )
    return {**result, "query_latency_ms": round(latency, 2)}
