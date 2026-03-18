"""Pydantic request/response models for all entities + evaluation results."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field
from models.enums import FormStatus, ParticipantRole, UserRole, AuditAction


# --- Form AP ---
class FormAPCreate(BaseModel):
    issuer_id: str = Field(..., max_length=50)
    fiscal_year: int = Field(..., ge=2000, le=2100)
    status: FormStatus = FormStatus.draft
    location_country: str = Field(..., max_length=3)
    submission_date: Optional[datetime] = None

class FormAPUpdate(BaseModel):
    issuer_id: Optional[str] = Field(None, max_length=50)
    fiscal_year: Optional[int] = Field(None, ge=2000, le=2100)
    status: Optional[FormStatus] = None
    location_country: Optional[str] = Field(None, max_length=3)

class FormAPResponse(BaseModel):
    form_ap_id: UUID
    issuer_id: str
    fiscal_year: int
    status: FormStatus
    location_country: str
    submission_date: Optional[datetime] = None
    created_by: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    query_latency_ms: Optional[float] = None

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    query_latency_ms: Optional[float] = None


# --- Participant ---
class ParticipantCreate(BaseModel):
    form_ap_id: UUID
    firm_name: str = Field(..., max_length=255)
    firm_id: str = Field(..., max_length=50)
    role: ParticipantRole
    country: str = Field(..., max_length=3)

class ParticipantResponse(BaseModel):
    participant_id: UUID
    form_ap_id: UUID
    firm_name: str
    firm_id: str
    role: ParticipantRole
    country: str
    added_by: UUID
    added_at: datetime
    query_latency_ms: Optional[float] = None


# --- User ---
class UserCreate(BaseModel):
    email: str = Field(..., max_length=255)
    name: str = Field(..., max_length=255)
    role: UserRole = UserRole.viewer
    country_access: List[str] = Field(default_factory=list)

class UserResponse(BaseModel):
    user_id: UUID
    email: str
    name: str
    role: UserRole
    country_access: List[str]
    last_login: Optional[datetime] = None
    created_at: datetime
    query_latency_ms: Optional[float] = None


# --- Session ---
class SessionCreate(BaseModel):
    user_id: UUID
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class SessionResponse(BaseModel):
    session_id: UUID
    user_id: UUID
    login_time: datetime
    last_activity: datetime
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    query_latency_ms: Optional[float] = None


# --- Audit ---
class AuditLogResponse(BaseModel):
    audit_id: int
    user_email: str
    action: AuditAction
    table_name: str
    record_id: Optional[UUID] = None
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    timestamp: datetime
    query_latency_ms: Optional[float] = None


# --- Evaluation ---
class EvalResult(BaseModel):
    item_number: int
    category: str
    description: str
    passed: bool
    measured_value: Any = None
    target_value: Any = None
    latency_ms: Optional[float] = None

class EvalReport(BaseModel):
    total_items: int
    passed: int
    failed: int
    pass_rate: float
    categories: Dict[str, List[EvalResult]]
    timestamp: datetime
