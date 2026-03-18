"""Participant CRUD endpoints."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Header

from services.connection_pool import ConnectionPool
from models.schemas import ParticipantCreate, PaginatedResponse

router = APIRouter()


@router.get("")
async def list_participants(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    form_ap_id: Optional[UUID] = None,
    country: Optional[str] = None,
    role: Optional[str] = None,
    x_user_email: Optional[str] = Header(None),
):
    pool = ConnectionPool.get_instance()
    conditions = []
    params = []
    if form_ap_id:
        conditions.append("form_ap_id = %s")
        params.append(str(form_ap_id))
    if country:
        conditions.append("country = %s")
        params.append(country)
    if role:
        conditions.append("role = %s")
        params.append(role)

    where = " AND ".join(conditions) if conditions else "TRUE"
    offset = (page - 1) * page_size

    count_result, _ = pool.execute_query(
        f"SELECT COUNT(*) as total FROM participants_active WHERE {where}",
        tuple(params), user_email=x_user_email, fetch="one",
    )
    rows, latency = pool.execute_query(
        f"SELECT * FROM participants_active WHERE {where} ORDER BY added_at DESC LIMIT %s OFFSET %s",
        tuple(params + [page_size, offset]), user_email=x_user_email,
    )
    return PaginatedResponse(
        items=[dict(r) for r in rows], total=count_result["total"],
        page=page, page_size=page_size, query_latency_ms=round(latency, 2),
    )


@router.get("/{participant_id}")
async def get_participant(participant_id: UUID, x_user_email: Optional[str] = Header(None)):
    pool = ConnectionPool.get_instance()
    result, latency = pool.execute_query(
        "SELECT * FROM participants_active WHERE participant_id = %s",
        (str(participant_id),), user_email=x_user_email, fetch="one",
    )
    if not result:
        raise HTTPException(404, "Participant not found")
    return {**dict(result), "query_latency_ms": round(latency, 2)}


@router.post("", status_code=201)
async def create_participant(data: ParticipantCreate, x_user_email: Optional[str] = Header(None)):
    pool = ConnectionPool.get_instance()
    user_row, _ = pool.execute_query("SELECT user_id FROM users LIMIT 1", fetch="one")
    added_by = user_row["user_id"] if user_row else None

    result, latency = pool.execute_insert(
        """INSERT INTO participants_active (form_ap_id, firm_name, firm_id, role, country, added_by)
           VALUES (%s, %s, %s, %s, %s, %s) RETURNING *""",
        (str(data.form_ap_id), data.firm_name, data.firm_id, data.role.value, data.country, str(added_by)),
        user_email=x_user_email,
    )
    return {**result, "query_latency_ms": round(latency, 2)}


@router.delete("/{participant_id}")
async def delete_participant(participant_id: UUID, x_user_email: Optional[str] = Header(None)):
    pool = ConnectionPool.get_instance()
    result, latency = pool.execute_query(
        "DELETE FROM participants_active WHERE participant_id = %s",
        (str(participant_id),), user_email=x_user_email, fetch="none",
    )
    if result == 0:
        raise HTTPException(404, "Participant not found")
    return {"deleted": True, "query_latency_ms": round(latency, 2)}
