from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from time import perf_counter
from typing import Any
from zoneinfo import ZoneInfo

import httpx
import stripe
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from app.auth import OptionalUser
from app.pricing import CartQuote, quote_cart, quote_cart_complimentary
from app.routes.stripe_webhook import _is_unique_violation, _now_iso
from app.settings import get_settings
from app.stripe_customers import resolve_or_create_customer
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/checkout", tags=["checkout"])
logger = logging.getLogger(__name__)

DEPOSIT_AMOUNT_CENTS = 2000
META_CHUNK_SIZE = 450
MAX_META_CHUNKS = 30


class CheckoutRequest(BaseModel):
    kind: str | None = None
    returnUrl: str | None = None
    rowId: str | None = None
    cartPayload: dict[str, Any] | None = None


class CheckoutResponse(BaseModel):
    clientSecret: str | None = Field(default=None)
    repairsSubtotalCents: int | None = Field(default=None)
    courierFeeCents: int | None = Field(default=None)
    taxCents: int | None = Field(default=None)
    totalCents: int | None = Field(default=None)


def _persist_stripe_customer_id(
    *,
    user_id: str,
    app_metadata: dict[str, object],
    customer_id: str,
) -> None:
    """Backfill a trusted customer mapping after the response is sent."""
    try:
        sb = get_supabase_admin()
        sb.auth.admin.update_user_by_id(
            user_id,
            {
                "app_metadata": {
                    **app_metadata,
                    "stripe_customer_id": customer_id,
                }
            },
        )
    except Exception:
        # A failed backfill only means the next request uses the safe Stripe
        # search fallback again; it must never invalidate a created session.
        logger.exception("Failed to persist Stripe customer ID for user %s", user_id)


def _chunk_payload(payload: Any) -> dict[str, str]:
    text = json.dumps(payload, separators=(",", ":"))
    out: dict[str, str] = {}
    idx = 0
    for i in range(0, len(text), META_CHUNK_SIZE):
        if idx >= MAX_META_CHUNKS:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Cart payload exceeds metadata capacity"
            )
        out[f"cart_{idx}"] = text[i : i + META_CHUNK_SIZE]
        idx += 1
    return out


def _validate_cart(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid cart payload")
    email = payload.get("contact_email")
    if not isinstance(email, str) or "@" not in email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid contact_email")
    if not isinstance(payload.get("contact_phone"), str):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid contact_phone")
    addr = payload.get("delivery_address")
    if not isinstance(addr, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid delivery_address")
    items = payload.get("items")
    if not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart has no items")
    return payload


def _validate_cart_assessment_ownership(payload: dict[str, Any], user: Any) -> None:
    """Request-to-order continuity fix (2026-10-01). `cartPayload` can carry
    an `assessment_id` when this checkout started from accepting a repair
    recommendation (RepairDetails.tsx / AssessmentProposal.tsx's
    onAcceptAndCheckout, set from the URL's ?assessment_id= param). Nothing
    validated that claim before today — any signed-in user, or any guest,
    could put an arbitrary assessment_id in the cart and have the resulting
    order silently "linked" to someone else's private request. A missing
    assessment_id is unaffected (every existing checkout path, and every
    checkout that isn't a recommendation-acceptance, has none)."""
    assessment_id = payload.get("assessment_id")
    if not assessment_id:
        return
    sb = get_supabase_admin()
    resp = (
        sb.table("assessments")
        .select("id, user_id, status")
        .eq("id", assessment_id)
        .maybe_single()
        .execute()
    )
    row = getattr(resp, "data", None)
    if getattr(resp, "error", None) or not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    owner_id = row.get("user_id")
    if user is not None:
        # Signed-in: the request must be theirs. A guest-submitted request
        # (owner_id is None) can't be claimed by a signed-in user via this
        # path either — linking a guest's past submission to an account
        # isn't built yet (see the guest-submission section of this fix).
        if owner_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    else:
        # Guest: the request must ALSO be guest-owned (no user_id) — without
        # this check, a guest could pass any signed-in customer's
        # assessment_id (e.g. copied from a shared URL) and have an order
        # created that looks linked to that customer's private request.
        if owner_id is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    if row.get("status") == "booked":
        # Already converted by an earlier, successful checkout — creating a
        # second Stripe session for the same approval risks a second charge
        # for the same repair if both sessions were ever completed. The
        # DB-level backstop (orders_assessment_id_unique, 2026-10-01
        # migration) catches this even under a race between two requests;
        # this is just the earlier, friendlier rejection.
        raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been confirmed")


class ComplimentaryConfirmRequest(BaseModel):
    cartPayload: dict[str, Any] | None = None


class ComplimentaryConfirmResponse(BaseModel):
    orderId: str


@router.post(
    "/confirm-complimentary",
    response_model=ComplimentaryConfirmResponse,
)
def confirm_complimentary(
    body: ComplimentaryConfirmRequest,
    user: OptionalUser,
) -> ComplimentaryConfirmResponse:
    """Deliberate complimentary-confirmation path (2026-10-01, Item 4 of
    Danielle's spec). This is the ONLY way an order can be created with a
    $0 charge — it requires assessments.complimentary = true, a flag only
    staff can set (ops_assessments.py), never inferred from an unpriced
    request. Everything else about linking/dedup mirrors the paid cart path
    (same ownership check, same orders_assessment_id_unique DB guard, same
    "already booked" rejection) so a comp confirmation can't double-book or
    double-create any more than a paid one can.
    """
    payload = body.cartPayload or {}
    _validate_cart(payload)
    assessment_id = payload.get("assessment_id")
    if not assessment_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing assessment_id")

    sb = get_supabase_admin()
    resp = (
        sb.table("assessments")
        .select("id, user_id, status, complimentary")
        .eq("id", assessment_id)
        .maybe_single()
        .execute()
    )
    row = getattr(resp, "data", None)
    if getattr(resp, "error", None) or not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")

    owner_id = row.get("user_id")
    if user is not None:
        if owner_id != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    else:
        if owner_id is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")

    if not row.get("complimentary"):
        # The hard rule: an unpriced request is never treated as
        # complimentary just because its total happens to be $0 or
        # unset — only this explicit staff-set flag authorizes a free
        # order.
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "This request has not been marked complimentary"
        )
    if row.get("status") == "booked":
        raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been confirmed")

    # Pickup-before-confirmation (2026-10-02, Danielle's call): a
    # complimentary repair follows the same "select services, then choose an
    # available pickup, then confirm" order as a paid one — never "confirmed"
    # with pickup still unresolved. No staff-agreed-alternative-handoff
    # concept exists anywhere in the schema yet, so for now a pickup_window
    # is always required here; that's a known, deliberate scope limit, not
    # an oversight — see the written report for how to extend it if needed.
    pickup_window = payload.get("pickup_window")
    if (
        not isinstance(pickup_window, dict)
        or not isinstance(pickup_window.get("start"), str)
        or not isinstance(pickup_window.get("end"), str)
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing pickup_window")

    cart_quote = quote_cart_complimentary(payload)
    canonical_payload = cart_quote.payload

    user_id = user.id if user is not None else None
    now_iso = _now_iso()

    # Book the real calendar slot FIRST, synchronously, and only proceed to
    # create the order if it succeeds. If the slot is no longer available
    # (or cal-book otherwise fails), nothing is created and nothing on the
    # request is touched — the customer's selections (essential/recommended
    # services) are untouched in assessments.proposed_services, so they can
    # just try a different slot.
    contact_name = (
        canonical_payload.get("contact_name")
        or (canonical_payload.get("contact_email") or "").split("@")[0]
        or "Customer"
    )
    event_uri = _book_pickup(
        pickup_window,
        contact_name,
        canonical_payload.get("contact_email", ""),
        canonical_payload.get("contact_phone", ""),
    )
    if not event_uri:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "That pickup slot is no longer available. Please choose another time.",
        )
    pickup_date = _to_ny_date_key(pickup_window["start"])
    pickup_time_label = _format_ny_time_range(pickup_window["start"], pickup_window["end"])

    insert_res = (
        sb.table("orders")
        .insert(
            {
                "user_id": user_id,
                "status": "pending_payment",
                "delivery_method": "door-to-door",
                "delivery_address": canonical_payload.get("delivery_address"),
                "contact_email": canonical_payload.get("contact_email"),
                "contact_phone": canonical_payload.get("contact_phone"),
                "payment_method_snapshot": None,
                "repairs_subtotal_cents": 0,
                "courier_fee_cents": 0,
                "tax_cents": 0,
                "total_cents": 0,
                "payment_status": "complimentary",
                "paid_at": now_iso,
                "stripe_session_id": None,
                "stripe_payment_intent_id": None,
                "assessment_id": assessment_id,
                "pickup_date": pickup_date,
                "pickup_time_label": pickup_time_label,
                "pickup_calendly_event_uri": event_uri,
            }
        )
        .select("id")
        .single()
        .execute()
    )
    if _is_unique_violation(insert_res):
        # A duplicate confirm click/retry for the same assessment — the
        # order already exists (orders_assessment_id_unique), almost
        # certainly from this very booking already having been recorded on
        # an earlier attempt. Cancel the just-created Cal.com booking so a
        # double-click can't leave two real calendar holds for one request —
        # best-effort; a failure here is logged, not raised, since the
        # customer-facing outcome (one order, found below) is already
        # correct either way.
        try:
            httpx.post(
                f"{get_settings().supabase_url}/functions/v1/cal-cancel",
                headers={
                    "Authorization": f"Bearer {get_settings().supabase_service_role_key}",
                    "Content-Type": "application/json",
                },
                json={"event_uri": event_uri},
                timeout=10.0,
            )
        except Exception:
            logger.exception(
                "failed to cancel orphaned cal.com booking %s after duplicate order insert",
                event_uri,
            )
        existing = (
            sb.table("orders")
            .select("id")
            .eq("assessment_id", assessment_id)
            .maybe_single()
            .execute()
        )
        existing_row = getattr(existing, "data", None)
        if not existing_row:
            raise HTTPException(status.HTTP_409_CONFLICT, "This request has already been confirmed")
        return ComplimentaryConfirmResponse(orderId=existing_row["id"])

    order_row = getattr(insert_res, "data", None)
    if getattr(insert_res, "error", None) or not order_row:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Failed to create order")
    order_id = order_row["id"]

    items = canonical_payload.get("items") or []
    item_rows = [
        {
            "order_id": order_id,
            "pair_snapshot": it.get("pair_snapshot"),
            "service_snapshot": it.get("service_snapshot"),
            "price_cents": 0,
        }
        for it in items
    ]
    if item_rows:
        items_res = sb.table("order_items").insert(item_rows).execute()
        if getattr(items_res, "error", None):
            logger.error("failed to insert complimentary order_items: %s", items_res.error)

    status_res = sb.table("orders").update({"status": "placed"}).eq("id", order_id).execute()
    if getattr(status_res, "error", None):
        logger.error("failed to flip complimentary order to placed: %s", status_res.error)

    booked_res = (
        sb.table("assessments").update({"status": "booked"}).eq("id", assessment_id).execute()
    )
    if getattr(booked_res, "error", None):
        logger.error(
            "failed to mark assessment %s booked after complimentary order %s: %s",
            assessment_id,
            order_id,
            booked_res.error,
        )

    return ComplimentaryConfirmResponse(orderId=order_id)


NY_TZ = ZoneInfo("America/New_York")


def _to_ny_date_key(iso_utc: str) -> str:
    return datetime.fromisoformat(iso_utc.replace("Z", "+00:00")).astimezone(NY_TZ).strftime("%Y-%m-%d")


def _format_ny_time_range(start_iso: str, end_iso: str) -> str:
    start = datetime.fromisoformat(start_iso.replace("Z", "+00:00")).astimezone(NY_TZ)
    end = datetime.fromisoformat(end_iso.replace("Z", "+00:00")).astimezone(NY_TZ)
    fmt = lambda d: d.strftime("%I:%M %p").lstrip("0")  # noqa: E731
    start_s, end_s = fmt(start), fmt(end)
    start_period, end_period = start_s[-2:], end_s[-2:]
    if start_period == end_period:
        return f"{start_s[:-3]} – {end_s}"
    return f"{start_s} – {end_s}"


def _book_pickup(
    pickup_window: dict[str, Any], contact_name: str, contact_email: str, contact_phone: str
) -> str | None:
    """Mirrors supabase/functions/stripe-webhook/index.ts's bookPickup() —
    same cal-book edge function, same call shape — so a complimentary
    confirmation books the same real calendar as a paid one. Unlike the paid
    path (where booking happens after payment and a failure there is logged
    but never blocks an already-paid order), a failure here DOES block
    confirmation outright (see the caller): there is no payment already
    taken to protect, and Danielle's explicit call is that a repair must
    never show as confirmed while its pickup is still unresolved.
    """
    settings = get_settings()
    try:
        resp = httpx.post(
            f"{settings.supabase_url}/functions/v1/cal-book",
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": "application/json",
            },
            json={
                "start_time": pickup_window["start"],
                "name": contact_name,
                "email": contact_email,
                "phone": contact_phone,
                "address": pickup_window.get("address", ""),
            },
            timeout=20.0,
        )
    except Exception:
        logger.exception("cal-book call failed for complimentary confirmation")
        return None
    if resp.status_code >= 400:
        logger.error("cal-book failed (%s): %s", resp.status_code, resp.text)
        return None
    data = resp.json()
    if data.get("error"):
        logger.error("cal-book returned an error: %s", data["error"])
        return None
    return data.get("event_uri")


def _fingerprint_cart(canonical_payload: dict[str, Any]) -> str:
    """Stale-session-selection fix (2026-10-02, Danielle's explicit call:
    "session reuse must account for changes to selected services, prices,
    and pickup details"). A SHA-256 over exactly the fields that define what
    the customer is actually about to pay for and when they'll be picked up
    — re-priced service ids, each item's canonical price, and the selected
    pickup window. Deliberately excludes contact info/delivery address
    formatting differences that don't change what's being charged or when.
    `sort_keys=True` makes this independent of dict key ordering.
    """
    items = canonical_payload.get("items") or []
    fingerprint_payload = {
        "items": sorted(
            (
                (it.get("service_snapshot") or {}).get("id"),
                it.get("price_cents"),
                ((it.get("pair_snapshot") or {}).get("id")),
            )
            for it in items
            if isinstance(it, dict)
        ),
        "pickup_window": canonical_payload.get("pickup_window"),
        "total_cents": canonical_payload.get("total_cents"),
    }
    digest = hashlib.sha256(
        json.dumps(fingerprint_payload, sort_keys=True, default=str).encode()
    )
    return digest.hexdigest()


def _reuse_open_session_client_secret(assessment_id: str, fingerprint: str) -> str | None:
    """Duplicate-payment fix (2026-10-02, Item 1 follow-up). Before today,
    nothing stopped a customer from generating a second live Stripe Checkout
    Session for the same request — reloading Checkout.tsx, or opening it in
    two tabs, each called POST /checkout/ and got back a fresh session. The
    orders_assessment_id_unique index only catches this once BOTH sessions
    are paid and their webhooks both try to insert an order row — the first
    insert wins, the second is silently dropped as a duplicate (see
    _is_unique_violation in stripe_webhook.py) — but by then Stripe has
    already captured a real charge on the second session too, and nothing
    refunds it. That's a real gap: an order-level duplicate is prevented,
    a second successful charge is not.

    This closes the gap at its source — before a second session is ever
    created — using assessments.pending_stripe_session_id/_fingerprint (set
    by _record_pending_session right after a session is created; cleared by
    the webhook once that assessment's checkout attempt resolves, paid or
    not). If a request already has a still-open session recorded AND its
    stored fingerprint matches what's being submitted now, that session's
    client secret is returned instead of minting a new one. If the
    fingerprint differs — the customer picked a different service, a price
    changed, or they chose a different pickup window since that session was
    created — the stale session is explicitly expired via the Stripe API
    (so it can never later be completed with the old, no-longer-current
    selections) and this returns None so the caller creates a fresh one. A
    session that's simply expired/completed on Stripe's side already is
    handled the same way: cleared and treated as not reusable.

    Known residual gap: two requests arriving within the same few
    milliseconds (before either has written pending_stripe_session_id back)
    can still both pass this check and each create a session — the REST
    client here has no row-level lock to close that race atomically. That
    window is milliseconds, not the unlimited "reload the page anytime"
    window this fix closes, but it is not fully eliminated. Flagging this
    rather than claiming full atomicity.
    """
    sb = get_supabase_admin()
    resp = (
        sb.table("assessments")
        .select("pending_stripe_session_id, pending_stripe_session_fingerprint")
        .eq("id", assessment_id)
        .maybe_single()
        .execute()
    )
    row = getattr(resp, "data", None)
    pending_id = row.get("pending_stripe_session_id") if row else None
    pending_fingerprint = row.get("pending_stripe_session_fingerprint") if row else None
    if not pending_id:
        return None

    def _clear() -> None:
        sb.table("assessments").update(
            {"pending_stripe_session_id": None, "pending_stripe_session_fingerprint": None}
        ).eq("id", assessment_id).execute()

    try:
        existing = stripe.checkout.Session.retrieve(pending_id)
    except Exception:
        logger.exception("failed to retrieve pending Stripe session %s", pending_id)
        return None

    if existing.get("status") != "open":
        # Expired, completed, or otherwise no longer usable — clear the
        # stale pointer so the next attempt creates a fresh session
        # unobstructed.
        _clear()
        return None

    if pending_fingerprint == fingerprint:
        return existing.get("client_secret")

    # Still open on Stripe's side, but the customer's selections have
    # changed since it was created — never hand back a session that would
    # check them out with stale items/price/pickup. Expire it outright so
    # it can't be completed later with the old selections either (e.g. a
    # customer with it still open in another tab).
    try:
        stripe.checkout.Session.expire(pending_id)
    except Exception:
        logger.exception(
            "failed to expire stale Stripe session %s for assessment %s after selections changed",
            pending_id,
            assessment_id,
        )
    _clear()
    return None


def _record_pending_session(assessment_id: str, session_id: str, fingerprint: str) -> None:
    sb = get_supabase_admin()
    sb.table("assessments").update(
        {
            "pending_stripe_session_id": session_id,
            "pending_stripe_session_fingerprint": fingerprint,
        }
    ).eq("id", assessment_id).execute()


@router.post("/", response_model=CheckoutResponse, response_model_exclude_none=True)
def create_checkout(
    body: CheckoutRequest,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    user: OptionalUser,
) -> CheckoutResponse:
    route_started = perf_counter()
    stripe.api_key = get_settings().stripe_secret_key

    if not body.kind or not body.returnUrl:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid request")

    if body.kind not in ("deposit", "order", "cart"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown kind")

    # "deposit" and "order" both reference a row already scoped to a specific
    # signed-in user (assessments.user_id / orders.user_id) — guests never
    # reach these. Only "cart" (2026-09-24, Danielle's call: guest checkout is
    # in scope) allows a null user.
    if body.kind in ("deposit", "order"):
        if user is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in required")
        if not body.rowId:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing rowId")

    pricing_duration_ms = 0.0
    cart_quote: CartQuote | None = None
    cart_assessment_id: str | None = None
    if body.kind == "cart":
        _validate_cart(body.cartPayload)
        _validate_cart_assessment_ownership(body.cartPayload or {}, user)
        raw_assessment_id = (body.cartPayload or {}).get("assessment_id")
        cart_assessment_id = raw_assessment_id if isinstance(raw_assessment_id, str) and raw_assessment_id else None

        # Pricing runs BEFORE the reuse check (2026-10-02, stale-selection
        # fix) so reuse is decided from the server-canonical payload — the
        # one place service ids, re-verified prices, and the selected pickup
        # window are all trustworthy together — not from whatever the client
        # happened to send.
        pricing_started = perf_counter()
        cart_quote = quote_cart(body.cartPayload or {})
        pricing_duration_ms = (perf_counter() - pricing_started) * 1000

    reused_client_secret: str | None = None
    if cart_assessment_id and cart_quote is not None:
        reused_client_secret = _reuse_open_session_client_secret(
            cart_assessment_id, _fingerprint_cart(cart_quote.payload)
        )

    if reused_client_secret is not None:
        # An open session already exists for this request AND it was created
        # from the exact same selections (items, prices, pickup window) —
        # hand back the same one instead of minting a second (see
        # _reuse_open_session_client_secret). If anything changed, that
        # function already expired the stale session itself; execution falls
        # through here to create a fresh one below.
        assert cart_quote is not None
        return CheckoutResponse(
            clientSecret=reused_client_secret,
            repairsSubtotalCents=cart_quote.repairs_subtotal_cents,
            courierFeeCents=cart_quote.courier_fee_cents,
            taxCents=cart_quote.tax_cents,
            totalCents=cart_quote.total_cents,
        )

    customer_started = perf_counter()
    customer_id: str | None = None
    should_persist_customer = False
    if user is not None:
        customer_id = user.stripe_customer_id
        should_persist_customer = customer_id is None
        if customer_id is None:
            customer_id = resolve_or_create_customer(email=user.email, user_id=user.id)
    customer_duration_ms = (perf_counter() - customer_started) * 1000
    sb = get_supabase_admin()

    line_items: list[dict[str, Any]]
    description: str
    metadata: dict[str, str]

    if body.kind == "deposit":
        assert user is not None  # enforced above: deposit/order require sign-in
        resp = (
            sb.table("assessments")
            .select("id, user_id, deposit_status")
            .eq("id", body.rowId)
            .maybe_single()
            .execute()
        )
        row = getattr(resp, "data", None)
        if getattr(resp, "error", None) or not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
        if row.get("user_id") != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
        if row.get("deposit_status") == "paid":
            raise HTTPException(status.HTTP_409_CONFLICT, "Already paid")

        line_items = [
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": "Cobbli assessment deposit"},
                    "unit_amount": DEPOSIT_AMOUNT_CENTS,
                },
                "quantity": 1,
            }
        ]
        description = "Cobbli assessment deposit"
        metadata = {"userId": user.id, "kind": "deposit", "assessmentId": body.rowId}

    elif body.kind == "order":
        assert user is not None  # enforced above: deposit/order require sign-in
        resp = (
            sb.table("orders")
            .select("id, user_id, payment_status, total_cents, order_number")
            .eq("id", body.rowId)
            .maybe_single()
            .execute()
        )
        row = getattr(resp, "data", None)
        if getattr(resp, "error", None) or not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
        if row.get("user_id") != user.id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
        if row.get("payment_status") == "paid":
            raise HTTPException(status.HTTP_409_CONFLICT, "Already paid")
        total_cents = row.get("total_cents")
        if not isinstance(total_cents, int) or total_cents < 50:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid order total")

        line_items = [
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"Cobbli order {row.get('order_number')}"},
                    "unit_amount": total_cents,
                },
                "quantity": 1,
            }
        ]
        description = f"Cobbli order {row.get('order_number')}"
        metadata = {"userId": user.id, "kind": "order", "orderId": body.rowId}

    elif body.kind == "cart":
        if cart_quote is None:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Missing quote")
        payload = cart_quote.payload
        line_items = [
            {
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": "Cobbli order"},
                    "unit_amount": payload["total_cents"],
                },
                "quantity": 1,
            }
        ]
        description = "Cobbli order"
        # Guest checkout (2026-09-24, Danielle's call): no signed-in user, so
        # no "userId" key at all — the webhook branches on its presence to
        # decide whether the resulting order gets a user_id or is a guest
        # order (user_id null, contact_email is the only identifier).
        metadata = {
            **({"userId": user.id} if user is not None else {"guestEmail": payload["contact_email"]}),
            "kind": "cart",
            **_chunk_payload(payload),
        }
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown kind")

    # Signed-in customers attach their Stripe customer id (saved cards, etc.).
    # Guests have none — pass customer_email instead so Stripe still collects
    # and displays it on the Checkout Session.
    customer_kwargs: dict[str, Any] = (
        {"customer": customer_id}
        if customer_id
        else {"customer_email": (body.cartPayload or {}).get("contact_email")}
    )

    stripe_session_started = perf_counter()
    session = stripe.checkout.Session.create(
        line_items=line_items,
        mode="payment",
        ui_mode="embedded",
        return_url=body.returnUrl,
        payment_intent_data={"description": description, "metadata": metadata},
        metadata=metadata,
        # Redisplays this customer's cards saved with allow_redisplay="always"
        # (see app/routes/payment_methods.py), and lets them save a new card
        # from checkout itself for next time. Guests have no Stripe customer
        # to attach — Stripe collects/displays their email directly instead.
        saved_payment_method_options={"payment_method_save": "enabled"},
        **customer_kwargs,
    )
    stripe_session_duration_ms = (perf_counter() - stripe_session_started) * 1000

    if body.kind == "deposit":
        sb.table("assessments").update(
            {
                "stripe_session_id": session.id,
                "deposit_amount_cents": DEPOSIT_AMOUNT_CENTS,
            }
        ).eq("id", body.rowId).execute()
    elif body.kind == "order":
        sb.table("orders").update({"stripe_session_id": session.id}).eq(
            "id", body.rowId
        ).execute()
    elif body.kind == "cart" and cart_assessment_id:
        assert cart_quote is not None
        _record_pending_session(
            cart_assessment_id, session.id, _fingerprint_cart(cart_quote.payload)
        )

    if should_persist_customer:
        background_tasks.add_task(
            _persist_stripe_customer_id,
            user_id=user.id,
            app_metadata=user.app_metadata,
            customer_id=customer_id,
        )

    auth_duration_ms = float(getattr(request.state, "auth_duration_ms", 0.0))
    route_duration_ms = (perf_counter() - route_started) * 1000
    response.headers["Server-Timing"] = ", ".join(
        (
            f"auth;dur={auth_duration_ms:.2f}",
            f"customer;dur={customer_duration_ms:.2f}",
            f"pricing;dur={pricing_duration_ms:.2f}",
            f"stripe_session;dur={stripe_session_duration_ms:.2f}",
            f"total;dur={auth_duration_ms + route_duration_ms:.2f}",
        )
    )
    return CheckoutResponse(
        clientSecret=session.client_secret,
        repairsSubtotalCents=(
            cart_quote.repairs_subtotal_cents if cart_quote else None
        ),
        courierFeeCents=cart_quote.courier_fee_cents if cart_quote else None,
        taxCents=cart_quote.tax_cents if cart_quote else None,
        totalCents=cart_quote.total_cents if cart_quote else None,
    )
