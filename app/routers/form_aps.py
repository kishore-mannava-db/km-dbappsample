"""Form AP CRUD endpoints."""
import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Header

from services.connection_pool import ConnectionPool
from models.schemas import FormAPCreate, FormAPUpdate, FormAPResponse, PaginatedResponse

router = APIRouter()


def _get_email(x_user_email: Optional[str] = Header(None)) -> Optional[str]:
    return x_user_email


@router.get("")
async def list_form_aps(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    country: Optional[str] = None,
    status: Optional[str] = None,
    fiscal_year: Optional[int] = None,
    search: Optional[str] = None,
    x_user_email: Optional[str] = Header(None),
):
    pool = ConnectionPool.get_instance()
    conditions = ["deleted_at IS NULL"]
    params = []

    if country:
        conditions.append("location_country = %s")
        params.append(country)
    if status:
        conditions.append("status = %s")
        params.append(status)
    if fiscal_year:
        conditions.append("fiscal_year = %s")
        params.append(fiscal_year)
    if search:
        conditions.append("issuer_id ILIKE %s")
        params.append(f"%{search}%")

    where = " AND ".join(conditions)
    offset = (page - 1) * page_size

    count_result, _ = pool.execute_query(
        f"SELECT COUNT(*) as total FROM form_ap_active WHERE {where}",
        tuple(params), user_email=x_user_email, fetch="one",
    )
    total = count_result["total"]

    rows, latency = pool.execute_query(
        f"SELECT * FROM form_ap_active WHERE {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
        tuple(params + [page_size, offset]), user_email=x_user_email,
    )
    return PaginatedResponse(
        items=[dict(r) for r in rows], total=total,
        page=page, page_size=page_size, query_latency_ms=round(latency, 2),
    )


@router.get("/{form_ap_id}")
async def get_form_ap(form_ap_id: UUID, x_user_email: Optional[str] = Header(None)):
    pool = ConnectionPool.get_instance()
    result, latency = pool.execute_query(
        "SELECT * FROM form_ap_active WHERE form_ap_id = %s AND deleted_at IS NULL",
        (str(form_ap_id),), user_email=x_user_email, fetch="one",
    )
    if not result:
        raise HTTPException(404, "Form AP not found")
    return {**dict(result), "query_latency_ms": round(latency, 2)}


@router.post("", status_code=201)
async def create_form_ap(data: FormAPCreate, x_user_email: Optional[str] = Header(None)):
    pool = ConnectionPool.get_instance()
    # Get a user_id for created_by
    user_row, _ = pool.execute_query(
        "SELECT user_id FROM users LIMIT 1", fetch="one",
    )
    created_by = user_row["user_id"] if user_row else None

    result, latency = pool.execute_insert(
        """INSERT INTO form_ap_active (issuer_id, fiscal_year, status, location_country, submission_date, created_by)
           VALUES (%s, %s, %s, %s, %s, %s) RETURNING *""",
        (data.issuer_id, data.fiscal_year, data.status.value, data.location_country,
         data.submission_date, str(created_by)),
        user_email=x_user_email,
    )
    return {**result, "query_latency_ms": round(latency, 2)}


@router.put("/{form_ap_id}")
async def update_form_ap(form_ap_id: UUID, data: FormAPUpdate, x_user_email: Optional[str] = Header(None)):
    fields = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if not fields:
        raise HTTPException(400, "No fields to update")

    set_clause = ", ".join(f"{k} = %s" for k in fields)
    values = [v.value if hasattr(v, 'value') else v for v in fields.values()]
    values.append(str(form_ap_id))

    pool = ConnectionPool.get_instance()
    result, latency = pool.execute_query(
        f"UPDATE form_ap_active SET {set_clause} WHERE form_ap_id = %s AND deleted_at IS NULL RETURNING *",
        tuple(values), user_email=x_user_email, fetch="one",
    )
    if not result:
        raise HTTPException(404, "Form AP not found")
    return {**dict(result), "query_latency_ms": round(latency, 2)}


@router.delete("/{form_ap_id}")
async def delete_form_ap(form_ap_id: UUID, x_user_email: Optional[str] = Header(None)):
    pool = ConnectionPool.get_instance()
    result, latency = pool.execute_query(
        "UPDATE form_ap_active SET deleted_at = NOW() WHERE form_ap_id = %s AND deleted_at IS NULL",
        (str(form_ap_id),), user_email=x_user_email, fetch="none",
    )
    if result == 0:
        raise HTTPException(404, "Form AP not found")
    return {"deleted": True, "query_latency_ms": round(latency, 2)}
