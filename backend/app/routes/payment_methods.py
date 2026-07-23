from __future__ import annotations

import stripe
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import CurrentUser
from app.settings import get_settings
from app.stripe_customers import resolve_or_create_customer
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/payment-methods", tags=["payment-methods"])


class SetupIntentResponse(BaseModel):
    clientSecret: str | None = Field(default=None)


class ConfirmRequest(BaseModel):
    setupIntentId: str | None = None
    billingAddressId: str | None = None
    cardholderName: str | None = None
    makeDefault: bool = False
    # If set, this confirm call replaces the card on an existing row (rather
    # than inserting a new one) — used by the "replace card details" flow.
    replaceId: str | None = None


class PaymentMethodOut(BaseModel):
    id: str
    cardBrand: str
    cardLast4: str
    expMonth: int
    expYear: int
    cardholderName: str | None = None
    billingAddressId: str | None = None
    isDefault: bool


class DefaultRequest(BaseModel):
    makeDefault: bool = True


class UpdateRequest(BaseModel):
    cardholderName: str | None = None
    billingAddressId: str | None = None
    makeDefault: bool | None = None
    expMonth: int | None = None
    expYear: int | None = None


def _card_summary(pm: "stripe.PaymentMethod") -> tuple[str, str, int, int]:
    card = getattr(pm, "card", None)
    if not card:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not a card payment method")
    brand = (getattr(card, "brand", None) or "card").capitalize()
    return brand, getattr(card, "last4", ""), getattr(card, "exp_month", 0), getattr(card, "exp_year", 0)


def _billing_details(*, sb, body: ConfirmRequest, user: CurrentUser) -> dict:
    """Build Stripe billing details from the user-owned address selected in the UI.

    Checkout only redisplays a saved card when its PaymentMethod has a billing
    name, email, and valid address. Keeping these details only in Supabase makes
    the card real and attached, but ineligible for Checkout prefilling.
    """
    cardholder_name = (body.cardholderName or "").strip()
    if not cardholder_name or not user.email or not body.billingAddressId:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Cardholder name, email, and billing address are required",
        )

    address_resp = (
        sb.table("addresses")
        .select("id, user_id, street, street2, city, state, zip")
        .eq("id", body.billingAddressId)
        .eq("user_id", user.id)
        .maybe_single()
        .execute()
    )
    address = getattr(address_resp, "data", None)
    if not address:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid billing address")

    return {
        "name": cardholder_name,
        "email": user.email,
        "address": {
            "line1": address["street"],
            "line2": address.get("street2") or None,
            "city": address["city"],
            "state": address["state"],
            "postal_code": address["zip"],
            "country": "US",
        },
    }


@router.post("/setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(user: CurrentUser) -> SetupIntentResponse:
    """Create a SetupIntent so the client can securely tokenize a card via
    Stripe Elements, without ever touching raw card data ourselves."""
    stripe.api_key = get_settings().stripe_secret_key
    customer_id = resolve_or_create_customer(email=user.email, user_id=user.id)
    intent = stripe.SetupIntent.create(
        customer=customer_id,
        usage="off_session",
        metadata={"userId": user.id},
    )
    return SetupIntentResponse(clientSecret=intent.client_secret)


@router.post("/confirm", response_model=PaymentMethodOut)
async def confirm_payment_method(body: ConfirmRequest, user: CurrentUser) -> PaymentMethodOut:
    """Finalize a card added via Stripe Elements: verify the SetupIntent
    belongs to this user's Stripe customer, then persist a display record
    (Stripe remains the source of truth for the actual token)."""
    stripe.api_key = get_settings().stripe_secret_key
    if not body.setupIntentId:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing setupIntentId")

    customer_id = resolve_or_create_customer(email=user.email, user_id=user.id)

    intent = stripe.SetupIntent.retrieve(body.setupIntentId)
    if intent.customer != customer_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    if intent.status != "succeeded":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Card setup did not succeed")

    payment_method_id = intent.payment_method
    if not payment_method_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No payment method on setup intent")

    sb = get_supabase_admin()
    pm = stripe.PaymentMethod.retrieve(payment_method_id)
    brand, last4, exp_month, exp_year = _card_summary(pm)

    # A PaymentMethod created via a bare SetupIntent defaults to
    # allow_redisplay="unspecified", which Stripe Checkout deliberately
    # excludes from the saved-card list. The customer explicitly chose to
    # save this card via "Add payment method," so mark it accordingly —
    # otherwise it's tokenized and real but Checkout will never show it.
    stripe.PaymentMethod.modify(
        payment_method_id,
        allow_redisplay="always",
        billing_details=_billing_details(sb=sb, body=body, user=user),
    )

    if body.replaceId:
        existing = (
            sb.table("payment_methods")
            .select("id, user_id, stripe_payment_method_id, is_default")
            .eq("id", body.replaceId)
            .maybe_single()
            .execute()
        )
        existing_row = getattr(existing, "data", None)
        if not existing_row or existing_row.get("user_id") != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment method not found")

        make_default = body.makeDefault or bool(existing_row.get("is_default"))
        if make_default:
            stripe.Customer.modify(
                customer_id, invoice_settings={"default_payment_method": payment_method_id}
            )

        old_pm_id = existing_row["stripe_payment_method_id"]
        update_resp = (
            sb.table("payment_methods")
            .update(
                {
                    "stripe_payment_method_id": payment_method_id,
                    "cardholder_name": body.cardholderName,
                    "card_brand": brand,
                    "card_last4": last4,
                    "exp_month": exp_month,
                    "exp_year": exp_year,
                    "billing_address_id": body.billingAddressId,
                    "is_default": make_default,
                }
            )
            .eq("id", body.replaceId)
            .execute()
        )
        data = getattr(update_resp, "data", None) or []
        row_id = data[0]["id"] if data else body.replaceId

        if old_pm_id and old_pm_id != payment_method_id and not old_pm_id.startswith("manual_"):
            try:
                stripe.PaymentMethod.detach(old_pm_id)
            except stripe.error.StripeError:
                pass  # old token may already be gone; not fatal
    else:
        count_resp = (
            sb.table("payment_methods")
            .select("id", count="exact", head=True)
            .eq("user_id", user.id)
            .execute()
        )
        is_first = (getattr(count_resp, "count", None) or 0) == 0
        make_default = body.makeDefault or is_first

        if make_default:
            stripe.Customer.modify(
                customer_id, invoice_settings={"default_payment_method": payment_method_id}
            )

        row = {
            "user_id": user.id,
            "stripe_payment_method_id": payment_method_id,
            "cardholder_name": body.cardholderName,
            "card_brand": brand,
            "card_last4": last4,
            "exp_month": exp_month,
            "exp_year": exp_year,
            "billing_address_id": body.billingAddressId,
            "is_default": make_default,
        }
        insert_resp = sb.table("payment_methods").insert(row).execute()
        data = getattr(insert_resp, "data", None) or []
        row_id = data[0]["id"] if data else payment_method_id

    return PaymentMethodOut(
        id=row_id,
        cardBrand=brand,
        cardLast4=last4,
        expMonth=exp_month,
        expYear=exp_year,
        cardholderName=body.cardholderName,
        billingAddressId=body.billingAddressId,
        isDefault=make_default,
    )


@router.post("/{payment_method_row_id}/default", response_model=dict)
async def set_default_payment_method(
    payment_method_row_id: str, body: DefaultRequest, user: CurrentUser
) -> dict:
    stripe.api_key = get_settings().stripe_secret_key
    sb = get_supabase_admin()

    resp = (
        sb.table("payment_methods")
        .select("id, stripe_payment_method_id, user_id")
        .eq("id", payment_method_row_id)
        .maybe_single()
        .execute()
    )
    row = getattr(resp, "data", None)
    if not row or row.get("user_id") != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment method not found")

    if body.makeDefault:
        customer_id = resolve_or_create_customer(email=user.email, user_id=user.id)
        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": row["stripe_payment_method_id"]},
        )
        sb.table("payment_methods").update({"is_default": True}).eq(
            "id", payment_method_row_id
        ).execute()

    return {"ok": True}


@router.patch("/{payment_method_row_id}", response_model=dict)
async def update_payment_method(
    payment_method_row_id: str, body: UpdateRequest, user: CurrentUser
) -> dict:
    """Update non-card fields (and optionally correct the exp date Stripe has
    on file) without re-tokenizing the card. Use /confirm with `replaceId`
    to swap the underlying card entirely."""
    stripe.api_key = get_settings().stripe_secret_key
    sb = get_supabase_admin()

    resp = (
        sb.table("payment_methods")
        .select("id, stripe_payment_method_id, user_id")
        .eq("id", payment_method_row_id)
        .maybe_single()
        .execute()
    )
    row = getattr(resp, "data", None)
    if not row or row.get("user_id") != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment method not found")

    update: dict = {}
    if body.cardholderName is not None:
        update["cardholder_name"] = body.cardholderName
    if body.billingAddressId is not None:
        update["billing_address_id"] = body.billingAddressId
    if body.expMonth is not None and body.expYear is not None:
        stripe_pm_id = row["stripe_payment_method_id"]
        if not stripe_pm_id.startswith("manual_"):
            stripe.PaymentMethod.modify(
                stripe_pm_id, card={"exp_month": body.expMonth, "exp_year": body.expYear}
            )
        update["exp_month"] = body.expMonth
        update["exp_year"] = body.expYear

    if body.makeDefault:
        customer_id = resolve_or_create_customer(email=user.email, user_id=user.id)
        stripe.Customer.modify(
            customer_id,
            invoice_settings={"default_payment_method": row["stripe_payment_method_id"]},
        )
        update["is_default"] = True
    elif body.makeDefault is False:
        update["is_default"] = False

    if update:
        sb.table("payment_methods").update(update).eq("id", payment_method_row_id).execute()

    return {"ok": True}
