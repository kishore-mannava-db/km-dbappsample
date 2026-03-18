"""Enum types matching Lakebase Postgres ENUM definitions."""
from enum import Enum


class FormStatus(str, Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    rejected = "rejected"
    archived = "archived"


class ParticipantRole(str, Enum):
    lead_auditor = "lead_auditor"
    engagement_partner = "engagement_partner"
    review_partner = "review_partner"
    team_member = "team_member"
    specialist = "specialist"
    observer = "observer"


class UserRole(str, Enum):
    admin = "admin"
    global_reviewer = "global_reviewer"
    country_manager = "country_manager"
    auditor = "auditor"
    viewer = "viewer"


class AuditAction(str, Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    VIEW = "VIEW"
    EXPORT = "EXPORT"
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    SUBMIT = "SUBMIT"
