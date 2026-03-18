"""Audit logging within the same transaction."""
import json
import logging
from typing import Dict, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class AuditService:
    @staticmethod
    def log_action(cursor, user_email: str, action: str, table_name: str,
                   record_id: Optional[UUID] = None,
                   old_value: Optional[Dict] = None,
                   new_value: Optional[Dict] = None):
        """Insert audit log entry using the provided cursor (same transaction)."""
        cursor.execute(
            """INSERT INTO audit_log_recent (user_email, action, table_name, record_id, old_value, new_value)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (user_email, action, table_name,
             str(record_id) if record_id else None,
             json.dumps(old_value) if old_value else None,
             json.dumps(new_value) if new_value else None),
        )
