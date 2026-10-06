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
_ALLOWED_STATUSES = {"pending", "proposal_sent", "quote_ready", "waitlisted", "service_unavailable", "needs_more_info", "declined"}

# Added proposed_services, description, guest_email, requested_conditions
# 2026-09-02 — Admin.tsx's saveProposal already sends proposed_services and
# reads description/guest_email, but this SELECT/model never included them,
# so proposals silently failed to persist and staff had no visibility into
# what the customer wrote or which checklist conditions they'd already
# selected before jumping to the photo-assessment flow.
_SELECT = (
    "id, user_id, pairs, status, proposal_token, created_at, updated_at, "
    "proposed_services, description, guest_email, guest_zip, requested_conditions, complimentary"
)


class AssessmentUpdate(BaseModel):
    """Staff-editable fields on an assessment. All optional; at least one required."""

    status: str | None = None
    pairs: list[dict[str, Any]] | None = None
    proposed_services: list[dict[str, Any]] | None = None
    # Deliberate complimentary-confirmation path (2026-10-01) — explicit
    # staff flag, never inferred from price. See the assessments.complimentary
    # column comment.
    complimentary: bool | None = None


def _raise_if_error(resp: Any) -> None:
    err = getattr(resp, "error", None)
    if err:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(err))


@router.get("/")
async def list_assessments(user: StaffUser, status_filter: str | None = None) -> Any:
    """List assessments. Optional ?status_filter= filter. RLS-scoped to staff/admin."""
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
    if body.complimentary is not None:
        updates["complimentary"] = body.complimentary
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    if body.status == "quote_ready":
        # Publishing must identify every bag and every selectable line.
        bags = body.pairs or []
        lines = body.proposed_services or []
        bag_ids = [bag.get("id") for bag in bags]
        line_ids = [line.get("recommendation_id") for line in lines]
        if not bags or not lines or not all(bag_ids) or len(set(bag_ids)) != len(bag_ids):
            raise HTTPException(400, "Assign each bag a unique ID before publishing recommendations.")
        if not all(line_ids) or len(set(line_ids)) != len(line_ids) or any(line.get("pair_id") not in bag_ids or not line.get("name") for line in lines):
            raise HTTPException(400, "Assign every recommendation to a bag before publishing.")

    sb = get_supabase_for_user(user.access_token)
    resp = (
        sb.table("assessments")
        .update(updates)
        .eq("id", assessment_id)
        .neq("status", "booked")
        .execute()
    )
    _raise_if_error(resp)
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
    return {"data": rows[0]}
