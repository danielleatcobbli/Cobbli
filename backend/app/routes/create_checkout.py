from __future__ import annotations

import json
from typing import Any

import stripe
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.settings import get_settings
from app.stripe_customers import resolve_or_create_customer
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/checkout", tags=["checkout"])

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
    total = payload.get("total_cents")
    if not isinstance(total, int) or isinstance(total, bool) or total < 50:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid total_cents")
    repairs = payload.get("repairs_subtotal_cents")
    if not isinstance(repairs, int) or isinstance(repairs, bool) or repairs < 0:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Invalid repairs_subtotal_cents"
        )
    courier = payload.get("courier_fee_cents")
    if not isinstance(courier, int) or isinstance(courier, bool) or courier < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid courier_fee_cents")
    items = payload.get("items")
    if not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cart has no items")
    return payload


@router.post("/", response_model=CheckoutResponse)
async def create_checkout(body: CheckoutRequest, user: CurrentUser) -> CheckoutResponse:
    stripe.api_key = get_settings().stripe_secret_key

    if not body.kind or not body.returnUrl:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid request")

    if body.kind not in ("deposit", "order", "cart"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown kind")

    if body.kind in ("deposit", "order") and not body.rowId:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing rowId")

    if body.kind == "cart":
        _validate_cart(body.cartPayload)

    customer_id = resolve_or_create_customer(email=user.email, user_id=user.id)
    sb = get_supabase_admin()

    line_items: list[dict[str, Any]]
    description: str
    metadata: dict[str, str]

    if body.kind == "deposit":
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
        payload = body.cartPayload or {}
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
        metadata = {
            "userId": user.id,
            "kind": "cart",
            **_chunk_payload(payload),
        }
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown kind")

    session = stripe.checkout.Session.create(
        line_items=line_items,
        mode="payment",
        ui_mode="embedded",
        return_url=body.returnUrl,
        customer=customer_id,
        payment_intent_data={"description": description, "metadata": metadata},
        metadata=metadata,
        # Redisplays this customer's cards saved with allow_redisplay="always"
        # (see app/routes/payment_methods.py), and lets them save a new card
        # from checkout itself for next time.
        saved_payment_method_options={"payment_method_save": "enabled"},
    )

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

    return CheckoutResponse(clientSecret=session.client_secret)
