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

    existing = (
        sb.table("orders")
        .select("id")
        .eq("stripe_session_id", session_id)
        .maybe_single()
        .execute()
    )
    if getattr(existing, "data", None):
        logger.info("order already exists for session %s", session_id)
        return

    payload = _reassemble_cart(meta)
    if not payload:
        logger.error("cart webhook missing/invalid payload metadata")
        return

    now_iso = _now_iso()

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
                "tax_cents": 0,
                "total_cents": payload.get("total_cents", 0),
                "payment_status": "paid",
                "paid_at": now_iso,
                "stripe_session_id": session_id,
                "stripe_payment_intent_id": payment_intent_id,
            }
        )
        .select("id")
        .single()
        .execute()
    )
    order_row = getattr(insert_res, "data", None)
    if not order_row:
        logger.error("failed to insert order from cart")
        return

    order_id = order_row["id"]

    items = payload.get("items") or []
    if items:
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

