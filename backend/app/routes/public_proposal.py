from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException, status

from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/public", tags=["public"])
logger = logging.getLogger(__name__)


def _extract_signed_url(result: Any) -> str | None:
    """Matches analyze_shoe_photos.py's helper of the same name — supabase-py
    has returned this either as a dict or an object across versions, so both
    shapes are handled rather than assumed."""
    if isinstance(result, dict):
        if result.get("error"):
            return None
        if result.get("signedURL") or result.get("signedUrl") or result.get("signed_url"):
            return result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
        if not result.get("data"):
            return None
        data = result["data"]
        if isinstance(data, dict):
            return data.get("signedUrl") or data.get("signed_url")
    return getattr(result, "signed_url", None) or getattr(result, "signedUrl", None)


@router.get("/proposal/{token}")
def get_public_proposal(token: str) -> dict[str, Any]:
    """Guest-access fix (2026-10-02, Item 3 follow-up).

    AssessmentProposal.tsx's /proposal/t/:token route used to query the
    `assessments` table directly from the browser (supabase.from("assessments")
    .eq("proposal_token", token)) and then call storage.createSignedUrl() for
    each photo, both as the anon/authenticated client. Tracing the live RLS
    policies found this was never actually reachable for anyone who isn't
    already signed in as the assessment's own owner or staff:
      - `assessments` has no SELECT policy at all for the `anon` role, and no
        policy that matches on proposal_token for ANY role — "Users view own
        assessments" requires auth.uid() = user_id. So a guest, or a signed-
        in customer opening their proposal link on a device/browser with no
        matching session, got zero rows back (RLS blocks it silently) and
        saw "Proposal not found" — not a guest-specific bug, this is broken
        for everyone who follows the link outside their original session.
      - Even if that query somehow succeeded, `assessment-uploads` storage
        policies only grant SELECT when auth.uid() matches the upload
        folder's owner — a different browser/device has no way to hold that
        same identity, so createSignedUrl() would 403 even if the row came
        through.

    This endpoint is the fix: it looks up the assessment by its own
    long random (gen_random_uuid) proposal_token using the service-role
    client — bypassing RLS deliberately, the same way a password-reset or
    email-unsubscribe link legitimately bypasses auth — and returns the
    proposal's own data plus pre-signed photo URLs. No row other than the
    one matching that exact token is ever returned. The token is the only
    credential; nothing here accepts or trusts an email address as proof of
    ownership.

    The signed-in path (/proposal/:id) is UNCHANGED — it still queries
    Supabase directly from the browser under "Users view own assessments",
    which is correctly scoped already.
    """
    if not token:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proposal not found")

    sb = get_supabase_admin()
    resp = (
        sb.table("assessments")
        .select("id, user_id, pairs, status, proposed_services, complimentary, updated_at, guest_email, guest_zip")
        .eq("proposal_token", token)
        .maybe_single()
        .execute()
    )
    row = getattr(resp, "data", None)
    if getattr(resp, "error", None) or not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proposal not found")

    pairs = row.get("pairs") or []
    photo_urls: dict[str, str] = {}
    for pair in pairs:
        if not isinstance(pair, dict):
            continue
        for path in (pair.get("photoPaths") or [])[:4]:
            if not isinstance(path, str) or path in photo_urls:
                continue
            # Paths originate in customer-editable JSON. Never sign an arbitrary
            # private object using the privileged client, even with a valid token.
            owner = row.get("user_id")
            if not owner or not path.startswith(f"{owner}/") or ".." in path.split("/"):
                continue
            try:
                result = sb.storage.from_("assessment-uploads").create_signed_url(path, 3600)
            except Exception:
                logger.exception("failed to sign photo %s for public proposal", path)
                continue
            signed = _extract_signed_url(result)
            if signed:
                photo_urls[path] = signed

    confirmed_order = None
    if row.get("status") == "booked":
        confirmed = sb.table("orders").select("id,order_number,status,contact_email,contact_phone,delivery_address,repairs_subtotal_cents,courier_fee_cents,total_cents,pickup_date,pickup_time_label,return_date,return_time_label,pickup_calendly_event_uri,return_calendly_event_uri,order_items(id,price_cents,service_snapshot,pair_snapshot)").eq("assessment_id", row["id"]).maybe_single().execute()
        if getattr(confirmed, "error", None):
            raise HTTPException(503, "Could not load confirmation")
        confirmed_order = getattr(confirmed, "data", None)
    return {
        "id": row["id"],
        "guest_email": row.get("guest_email"),
        "guest_zip": row.get("guest_zip"),
        "complimentary": bool(row.get("complimentary")),
        "updated_at": row.get("updated_at"),
        "confirmed_order": confirmed_order,
        "pairs": pairs,
        "status": row.get("status"),
        "proposed_services": row.get("proposed_services") or [],
        "photo_urls": photo_urls,
    }
