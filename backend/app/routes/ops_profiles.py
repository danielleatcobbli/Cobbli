from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.auth import StaffUser
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/ops", tags=["ops", "profiles"])

_MAX_IDS = 200


def _parse_ids(ids: str) -> list[str]:
    """Split a comma-separated list and validate each entry is a UUID."""
    raw = [part.strip() for part in ids.split(",") if part.strip()]
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No ids provided")
    if len(raw) > _MAX_IDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Too many ids")
    validated: list[str] = []
    for value in raw:
        try:
            validated.append(str(UUID(value)))
        except (ValueError, AttributeError, TypeError) as e:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, f"Invalid id: {value}"
            ) from e
    return validated


@router.get("/profiles")
async def get_profiles(ids: str, user: StaffUser) -> Any:
    """Cross-user PII lookup (name/phone) for the ops dashboard.

    This join has no RLS policy for cross-user reads, so it legitimately uses
    the service-role client. Access is gated to staff/admin by the dependency,
    and ids are validated as UUIDs before the query runs.
    """
    user_ids = _parse_ids(ids)
    sb = get_supabase_admin()
    resp = (
        sb.table("profiles")
        .select("user_id, first_name, last_name, phone")
        .in_("user_id", user_ids)
        .execute()
    )
    err = getattr(resp, "error", None)
    if err:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(err))
    return {"data": getattr(resp, "data", None) or []}
