from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.auth import StaffUser
from app.supabase_client import get_supabase_for_user

router = APIRouter(prefix="/ops/assessments", tags=["ops", "assessments"])

# Fixed 2026-09-02: this allowlist previously used a status vocabulary
# ("in_review", "proposed", "accepted", "declined", "expired") that no
# frontend code has ever written. AssessmentUpload.tsx inserts "pending"
# (was "submitted" until the same fix), and Admin.tsx's staff queue reads/
# writes "pending", "proposal_sent", "booked", "service_unavailable" — so
# PATCH requests from Admin.tsx (e.g. saveProposal setting status:
# "proposal_sent") were being rejected outright by this allowlist. Aligned
# to what the frontend actually uses.
_ALLOWED_STATUSES = {"pending", "proposal_sent", "booked", "service_unavailable"}

# Added proposed_services, description, guest_email, requested_conditions
# 2026-09-02 — Admin.tsx's saveProposal already sends proposed_services and
# reads description/guest_email, but this SELECT/model never included them,
# so proposals silently failed to persist and staff had no visibility into
# what the customer wrote or which checklist conditions they'd already
# selected before jumping to the photo-assessment flow.
_SELECT = (
    "id, user_id, pairs, status, proposal_token, created_at, updated_at, "
    "proposed_services, description, guest_email, requested_conditions"
)


class AssessmentUpdate(BaseModel):
    """Staff-editable fields on an assessment. All optional; at least one required."""

    status: str | None = None
    pairs: list[dict[str, Any]] | None = None
    proposed_services: list[dict[str, Any]] | None = None


def _raise_if_error(resp: Any) -> None:
    err = getattr(resp, "error", None)
    if err:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(err))


@router.get("/")
async def list_assessments(user: StaffUser, status_filter: str | None = None) -> Any:
    """List assessments. Optional ?status= filter. RLS-scoped to staff/admin."""
    sb = get_supabase_for_user(user.access_token)
    query = sb.table("assessments").select(_SELECT)
    if status_filter is not None:
        query = query.eq("status", status_filter)
    resp = query.order("created_at", desc=True).execute()
    _raise_if_error(resp)
    return {"data": getattr(resp, "data", None) or []}


@router.get("/{assessment_id}")
async def get_assessment(assessment_id: str, user: StaffUser) -> Any:
    sb = get_supabase_for_user(user.access_token)
    resp = (
        sb.table("assessments")
        .select(_SELECT)
        .eq("id", assessment_id)
        .maybe_single()
        .execute()
    )
    _raise_if_error(resp)
    row = getattr(resp, "data", None)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    return {"data": row}


@router.patch("/{assessment_id}")
async def update_assessment(
    assessment_id: str, body: AssessmentUpdate, user: StaffUser
) -> Any:
    updates: dict[str, Any] = {}
    if body.status is not None:
        if body.status not in _ALLOWED_STATUSES:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid status")
        updates["status"] = body.status
    if body.pairs is not None:
        updates["pairs"] = body.pairs
    if body.proposed_services is not None:
        updates["proposed_services"] = body.proposed_services
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    sb = get_supabase_for_user(user.access_token)
    resp = (
        sb.table("assessments")
        .update(updates)
        .eq("id", assessment_id)
        .execute()
    )
    _raise_if_error(resp)
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    return {"data": rows[0]}
