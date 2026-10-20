"""Secret-protected outbox drain. Configure a scheduler to POST once per minute."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException

from app.services.brevo import send_brevo_email
from app.services.repair_emails import MissingEmailData, render_email
from app.settings import get_settings
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/internal/repair-emails", tags=["internal"])


def data(response):
    if getattr(response, "error", None):
        raise RuntimeError("Notification database operation failed")
    return getattr(response, "data", None)


def finish(sb, event, state, *, message_id=None, error_code=None):
    data(
        sb.table("repair_email_outbox")
        .update(
            {
                "status": state,
                "finished_at": datetime.now(UTC).isoformat(),
                "message_id": message_id,
                "error_code": error_code,
            }
        )
        .eq("id", event["id"])
        .eq("status", "sending")
        .execute()
    )


@router.post("/run")
async def run(authorization: Annotated[str | None, Header()] = None):
    settings = get_settings()
    secret = settings.repair_email_worker_secret
    if not secret or not secrets.compare_digest(authorization or "", f"Bearer {secret}"):
        raise HTTPException(401, "Worker authorization required")
    if not settings.repair_emails_enabled:
        return {"enabled": False, "processed": 0}
    sb = get_supabase_admin()
    data(sb.rpc("queue_repair_reminders").execute())
    events = data(sb.rpc("claim_repair_emails", {"batch_size": 20}).execute()) or []
    counts = dict(sent=0, blocked=0, suppressed=0, uncertain=0)
    for event in events:
        try:
            table = "assessments" if event["entity_type"] == "assessment" else "orders"
            row = data(
                sb.table(table).select("*").eq("id", event["entity_id"]).maybe_single().execute()
            )
            if not row:
                finish(sb, event, "suppressed")
                counts["suppressed"] += 1
                continue
            profile = {}
            if row.get("user_id"):
                profile = (
                    data(
                        sb.table("profiles")
                        .select("first_name,email")
                        .eq("user_id", row["user_id"])
                        .maybe_single()
                        .execute()
                    )
                    or {}
                )
            bags = (
                row.get("pairs")
                if table == "assessments"
                else data(sb.table("order_pairs").select("id").eq("order_id", row["id"]).execute())
            )
            context = (
                data(
                    sb.table("repair_email_context")
                    .select("data")
                    .eq("entity_type", event["entity_type"])
                    .eq("entity_id", row["id"])
                    .maybe_single()
                    .execute()
                )
                or {}
            )
            payload = render_email(
                event,
                row,
                profile,
                bags or [],
                context.get("data") or {},
                settings.site_url,
                datetime.now(UTC),
            )
            if payload is None:
                finish(sb, event, "suppressed")
                counts["suppressed"] += 1
                continue
        except MissingEmailData as exc:
            finish(sb, event, "blocked", error_code=str(exc))
            counts["blocked"] += 1
            continue
        except Exception:
            finish(sb, event, "blocked", error_code="data_lookup_failed")
            counts["blocked"] += 1
            continue
        try:
            result = await send_brevo_email(**payload)
        except Exception:
            # A timeout may mean Brevo accepted the message. Do not blindly retry
            # and duplicate a customer email. Reconcile in Brevo before requeueing.
            finish(sb, event, "uncertain", error_code="provider_result_unconfirmed")
            counts["uncertain"] += 1
            continue
        # If this write fails, the row remains 'sending' for operator review;
        # it is never automatically reclaimed and resent.
        finish(sb, event, "sent", message_id=result.get("messageId"))
        counts["sent"] += 1
    return {"enabled": True, "processed": len(events), **counts}
