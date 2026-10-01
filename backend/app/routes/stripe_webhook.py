from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any

import stripe
from fastapi import APIRouter, HTTPException, Request, Response

from app.settings import get_settings
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/stripe", tags=["stripe"])

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _reassemble_cart(meta: dict[str, str]) -> dict[str, Any] | None:
    chunks: list[str] = []
    for i in range(50):
        c = meta.get(f"cart_{i}")
        if c is None:
            break
        chunks.append(c)
    if not chunks:
        return None
    try:
        return json.loads("".join(chunks))
    except json.JSONDecodeError as e:
        logger.error("Failed to parse cart payload from metadata: %s", e)
        return None


def _resolve_payment_intent_id(pi: Any) -> str | None:
    if isinstance(pi, str):
        return pi
    if isinstance(pi, dict):
        return pi.get("id")
    return None


def _is_unique_violation(res: Any) -> bool:
    """supabase-py surfaces a Postgres error as an exception on most client
    versions, but older/sync paths can return it as `.error` on the response
    instead — check both rather than assume one. Code 23505 is Postgres'
    unique_violation; that's the only thing orders_assessment_id_unique (see
    2026-10-01 migration) can raise here."""
    err = getattr(res, "error", None)
    if not err:
        return False
    code = err.get("code") if isinstance(err, dict) else getattr(err, "code", None)
    return code == "23505"


def _clear_pending_session(sb: Any, assessment_id: str | None) -> None:
    """Pairs with create_checkout.py's _record_pending_session — once this
    request's checkout attempt has resolved (an order now exists for it, or
    this delivery confirmed one already did), the pointer to that attempt's
    Stripe session no longer needs to block new ones. Best-effort: a failure
    here just means a slightly stale pointer, which _reuse_open_session_
    client_secret already self-heals (it checks the session's live Stripe
    status, not just presence of the pointer)."""
    if not assessment_id:
        return
    res = (
        sb.table("assessments")
        .update({"pending_stripe_session_id": None, "pending_stripe_session_fingerprint": None})
        .eq("id", assessment_id)
        .execute()
    )
    if getattr(res, "error", None):
        logger.error(
            "failed to clear pending_stripe_session_id for assessment %s: %s",
            assessment_id,
            res.error,
        )


def _create_order_from_cart(
    meta: dict[str, str],
    session: dict[str, Any],
    payment_intent_id: str | None,
) -> None:
    user_id = meta.get("userId")
    if not user_id:
        logger.error("cart webhook missing userId metadata")
        return

    sb = get_supabase_admin()
    session_id = session.get("id")

    # Resumable idempotency check (2026-10-01 fix) — the previous version
    # only checked whether a row existed for this session_id at all, so a
    # retried webhook delivery arriving after a partial failure (order
    # inserted as "pending_payment", then the later status-flip-to-"placed"
    # failed) would see "a row exists" and bail out, leaving that order
    # stuck forever with no automatic recovery. This now only short-circuits
    # once the order has actually reached "placed" — otherwise it falls
    # through and resumes from wherever it left off.
    existing = (
        sb.table("orders")
        .select("id, status, assessment_id")
        .eq("stripe_session_id", session_id)
        .maybe_single()
        .execute()
    )
    existing_row = getattr(existing, "data", None)
    if existing_row and existing_row.get("status") == "placed":
        logger.info("order already placed for session %s", session_id)
        return

    payload = _reassemble_cart(meta)
    if not payload:
        logger.error("cart webhook missing/invalid payload metadata")
        return
    canonical_total = payload.get("total_cents")
    paid_total = session.get("amount_total")
    if (
        not isinstance(canonical_total, int)
        or not isinstance(paid_total, int)
        or canonical_total != paid_total
    ):
        logger.error(
            "cart amount mismatch for session %s: metadata=%r stripe=%r",
            session_id,
            canonical_total,
            paid_total,
        )
        return

    now_iso = _now_iso()
    # Carried through from create_checkout.py's cart payload (set from
    # Checkout.tsx's ?assessment_id= query param) — the one request this
    # order resulted from, if any. Historical/legacy orders and anything
    # that didn't originate from a request simply have this as None; nothing
    # here backfills or guesses a link for those (2026-10-01 fix).
    assessment_id = payload.get("assessment_id")

    if existing_row:
        order_id = existing_row["id"]
    else:
        insert_res = (
            sb.table("orders")
            .insert(
                {
                    "user_id": user_id,
                    "status": "pending_payment",
                    "delivery_method": "door-to-door",
                    "delivery_address": payload.get("delivery_address"),
                    "contact_email": payload.get("contact_email"),
                    "contact_phone": payload.get("contact_phone"),
                    "payment_method_snapshot": None,
                    "repairs_subtotal_cents": payload.get("repairs_subtotal_cents", 0),
                    "courier_fee_cents": payload.get("courier_fee_cents", 0),
                    "tax_cents": payload.get("tax_cents", 0),
                    "total_cents": payload.get("total_cents", 0),
                    "payment_status": "paid",
                    "paid_at": now_iso,
                    "stripe_session_id": session_id,
                    "stripe_payment_intent_id": payment_intent_id,
                    "assessment_id": assessment_id,
                }
            )
            .select("id")
            .single()
            .execute()
        )
        if _is_unique_violation(insert_res):
            # Another checkout session for this same assessment already
            # produced the canonical order (a double-click, a race between
            # two tabs, or this exact webhook delivered twice under
            # different session ids). This is the DB-level guarantee that no
            # approval is ever charged/fulfilled twice — not an error to
            # retry, just confirmation the real order already exists.
            logger.info(
                "order already exists for assessment %s (duplicate checkout session %s) — not creating a second one",
                assessment_id,
                session_id,
            )
            _clear_pending_session(sb, assessment_id)
            return
        order_row = getattr(insert_res, "data", None)
        if not order_row:
            logger.error("failed to insert order from cart")
            return
        order_id = order_row["id"]

    items = payload.get("items") or []
    if items:
        # Resuming an order that already has its items (a retry after the
        # status flip failed last time) would duplicate every line — only
        # insert if this order doesn't have items yet.
        existing_items = (
            sb.table("order_items").select("id").eq("order_id", order_id).limit(1).execute()
        )
        if not getattr(existing_items, "data", None):
            item_rows = [
                {
                    "order_id": order_id,
                    "pair_snapshot": it.get("pair_snapshot"),
                    "service_snapshot": it.get("service_snapshot"),
                    "price_cents": it.get("price_cents", 0),
                }
                for it in items
            ]
            items_res = sb.table("order_items").insert(item_rows).execute()
            if getattr(items_res, "error", None):
                logger.error("failed to insert order_items: %s", items_res.error)

    status_res = (
        sb.table("orders")
        .update({"status": "placed"})
        .eq("id", order_id)
        .execute()
    )
    if getattr(status_res, "error", None):
        logger.error("failed to flip order to placed: %s", status_res.error)

    # The request only transitions once the order it produced is confirmed
    # paid and created — never at "accept" click, never at pending_payment —
    # so an abandoned or failed checkout leaves the request exactly as it
    # was, available to resume (2026-10-01 fix: this status value existed
    # everywhere it was READ — Admin.tsx, Account.tsx's My Repairs
    # exclusion, the proposal/repair-details pages' `alreadyBooked` — but
    # nothing ever WROTE it). Setting it again on a resumed/retried delivery
    # is harmless; it's already true by then.
    if assessment_id:
        booked_res = (
            sb.table("assessments").update({"status": "booked"}).eq("id", assessment_id).execute()
        )
        if getattr(booked_res, "error", None):
            logger.error(
                "failed to mark assessment %s booked after order %s: %s",
                assessment_id,
                order_id,
                booked_res.error,
            )
    _clear_pending_session(sb, assessment_id)


def _mark_paid(
    meta: dict[str, str],
    session: dict[str, Any] | None,
    payment_intent_id: str | None,
) -> None:
    kind = meta.get("kind")
    if kind == "cart":
        if not session:
            logger.error("cart webhook requires session context")
            return
        _create_order_from_cart(meta, session, payment_intent_id)
        return

    if kind == "deposit" and meta.get("assessmentId"):
        sb = get_supabase_admin()
        sb.table("assessments").update(
            {
                "deposit_status": "paid",
                "deposit_paid_at": _now_iso(),
                "stripe_payment_intent_id": payment_intent_id,
            }
        ).eq("id", meta["assessmentId"]).execute()
        return

    if kind == "order" and meta.get("orderId"):
        sb = get_supabase_admin()
        sb.table("orders").update(
            {
                "payment_status": "paid",
                "paid_at": _now_iso(),
                "stripe_payment_intent_id": payment_intent_id,
                "status": "placed",
            }
        ).eq("id", meta["orderId"]).execute()


def _mark_failed(meta: dict[str, str]) -> None:
    kind = meta.get("kind")
    if kind == "deposit" and meta.get("assessmentId"):
        sb = get_supabase_admin()
        sb.table("assessments").update({"deposit_status": "failed"}).eq(
            "id", meta["assessmentId"]
        ).execute()
        return

    if kind == "order" and meta.get("orderId"):
        sb = get_supabase_admin()
        sb.table("orders").update({"payment_status": "failed"}).eq(
            "id", meta["orderId"]
        ).execute()


@router.post("/webhook")
async def stripe_webhook(request: Request) -> Response:
    signature = request.headers.get("stripe-signature")
    body = await request.body()
    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature")

    settings = get_settings()
    try:
        event = stripe.Webhook.construct_event(
            body, signature, settings.stripe_webhook_secret
        )
    except Exception as e:
        logger.error("Signature verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid signature") from e

    try:
        event_type = getattr(event, "type", None)
        data_object = event.data.object if hasattr(event, "data") else None
        logger.info("stripe-webhook event: %s", event_type)

        if event_type == "checkout.session.completed":
            session = data_object if isinstance(data_object, dict) else {}
            meta = session.get("metadata") or {}
            payment_intent_id = _resolve_payment_intent_id(session.get("payment_intent"))
            if session.get("payment_status") == "paid":
                _mark_paid(meta, session, payment_intent_id)
        elif event_type == "payment_intent.succeeded":
            pi = data_object if isinstance(data_object, dict) else {}
            meta = pi.get("metadata") or {}
            if meta.get("kind") != "cart":
                _mark_paid(meta, None, pi.get("id"))
        elif event_type == "payment_intent.payment_failed":
            pi = data_object if isinstance(data_object, dict) else {}
            meta = pi.get("metadata") or {}
            _mark_failed(meta)
        else:
            logger.info("Unhandled event: %s", event_type)

        return Response(
            content=json.dumps({"received": True}),
            status_code=200,
            media_type="application/json",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Webhook handler error: %s", e)
        raise HTTPException(status_code=500, detail="Webhook error") from e

