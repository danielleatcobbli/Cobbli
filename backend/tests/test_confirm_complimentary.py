from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.auth import AuthUser, optional_user
from app.pricing import CartQuote

# ---------------------------------------------------------------------------
# 2026-10-02: new coverage for POST /checkout/confirm-complimentary (Item 4)
# and the ownership/duplicate-confirmation guards around it (Item 1/5).
#
# IMPORTANT finding while writing this: the existing `authed_client` fixture
# in test_create_checkout.py overrides `require_user`, but create_checkout's
# endpoints take `user: OptionalUser`, which resolves via `optional_user()` —
# a plain function that calls `require_user(...)` directly rather than via a
# nested `Depends()`. FastAPI's dependency_overrides only intercepts at the
# Depends() graph level, so overriding `require_user` never affects routes
# typed as OptionalUser. Every existing authed_client test for "deposit",
# "order", and "cart" kinds has therefore been silently running as a signed-
# OUT (guest) request all along, regardless of the fixture's intent — a
# pre-existing test-infrastructure bug, not something introduced this
# session. Confirmed by running the suite: those tests fail on assertions
# like `md["userId"] == "user-123"` with `KeyError: 'userId'`, because the
# metadata actually written is the guest-path's `guestEmail` key.
#
# This file overrides `optional_user` directly instead, which is the
# dependency the endpoint actually declares.
# ---------------------------------------------------------------------------


@pytest.fixture
def auth_user():
    return AuthUser(id="user-123", email="buyer@example.com", access_token="tok")


@pytest.fixture
def authed_client(client, auth_user):
    client.app.dependency_overrides[optional_user] = lambda: auth_user
    yield client
    client.app.dependency_overrides.pop(optional_user, None)


@pytest.fixture(autouse=True)
def canonical_complimentary_quote():
    """Avoids a real network call to the pricing catalog (get_pricing_catalog
    hits Supabase directly) — mirrors test_create_checkout.py's
    canonical_quote fixture for the regular quote_cart."""

    def quote(payload):
        canonical = dict(payload)
        canonical["items"] = [
            {**item, "price_cents": item.get("price_cents", 0)}
            for item in canonical.get("items", [])
        ]
        canonical["repairs_subtotal_cents"] = 0
        canonical["courier_fee_cents"] = 0
        canonical["tax_cents"] = 0
        canonical["total_cents"] = 0
        return CartQuote(
            payload=canonical,
            repairs_subtotal_cents=0,
            courier_fee_cents=0,
            tax_cents=0,
            total_cents=0,
        )

    with patch(
        "app.routes.create_checkout.quote_cart_complimentary", side_effect=quote
    ) as mocked:
        yield mocked


def _assessment_row(**overrides):
    row = {
        "id": "asm-1",
        "user_id": "user-123",
        "status": "quote_ready",
        "complimentary": True,
    }
    row.update(overrides)
    return row


def _make_sb(assessment_row, *, insert_result=None, insert_error=None, existing_order=None):
    """Builds a MagicMock standing in for get_supabase_admin() that handles
    the three tables confirm_complimentary touches: assessments (select),
    orders (insert/select), order_items (insert)."""
    assessments_table = MagicMock()
    select_chain = MagicMock()
    select_chain.eq.return_value = select_chain
    select_chain.maybe_single.return_value = select_chain
    select_chain.execute.return_value = SimpleNamespace(data=assessment_row, error=None)
    assessments_table.select.return_value = select_chain

    orders_table = MagicMock()
    insert_chain = MagicMock()
    insert_select = MagicMock()
    if insert_error is not None:
        insert_select.single.return_value.execute.return_value = SimpleNamespace(
            data=None, error=insert_error
        )
    else:
        insert_select.single.return_value.execute.return_value = SimpleNamespace(
            data=insert_result or {"id": "ord-new"}, error=None
        )
    insert_chain.select.return_value = insert_select
    orders_table.insert.return_value = insert_chain

    existing_select_chain = MagicMock()
    existing_select_chain.eq.return_value = existing_select_chain
    existing_select_chain.maybe_single.return_value = existing_select_chain
    existing_select_chain.execute.return_value = SimpleNamespace(
        data=existing_order, error=None
    )
    # orders_table.select is used for the "existing order after duplicate"
    # lookup — give it a fresh chain distinct from assessments' select.
    orders_table.select.return_value = existing_select_chain

    orders_table.update.return_value.eq.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": "asm-1"}], error=None
    )

    order_items_table = MagicMock()
    order_items_table.insert.return_value.execute.return_value = SimpleNamespace(
        data=[], error=None
    )

    def factory(name):
        return {
            "assessments": assessments_table,
            "orders": orders_table,
            "order_items": order_items_table,
        }.get(name, MagicMock())

    sb = MagicMock()
    sb.table.side_effect = factory
    return sb, orders_table, order_items_table


def _payload(**overrides):
    body = {
        "assessment_id": "asm-1",
        "contact_email": "buyer@example.com",
        "contact_phone": "555-0100",
        "delivery_address": {"street": "1 Main St", "city": "NY", "state": "NY", "zip": "10001"},
        "pickup_window": {"start": "2026-10-05T14:00:00Z", "end": "2026-10-05T15:30:00Z"},
        "items": [
            {
                "pair_snapshot": {"id": "pair-1"},
                "service_snapshot": {"id": "resole", "name": "Full resole"},
                "price_cents": 8000,
            }
        ],
    }
    body.update(overrides)
    return body


def _mock_cal_book(event_uri="evt_123"):
    return patch(
        "app.routes.create_checkout.httpx.post",
        return_value=SimpleNamespace(
            status_code=200, json=lambda: {"event_uri": event_uri}, text=""
        ),
    )


def test_confirm_complimentary_requires_signin_or_guest_ownership(authed_client):
    """A signed-in user may not confirm someone else's request."""
    sb, _orders, _items = _make_sb(_assessment_row(user_id="someone-else"))
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb):
        res = authed_client.post(
            "/checkout/confirm-complimentary", json={"cartPayload": _payload()}
        )
    assert res.status_code == 403


def test_confirm_complimentary_rejects_unflagged_request(authed_client):
    """The hard rule: no flag, no free order — even if essential pricing is $0."""
    sb, _orders, _items = _make_sb(_assessment_row(complimentary=False))
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb):
        res = authed_client.post(
            "/checkout/confirm-complimentary", json={"cartPayload": _payload()}
        )
    assert res.status_code == 403
    assert "not been marked complimentary" in res.text


def test_confirm_complimentary_rejects_already_booked(authed_client):
    sb, _orders, _items = _make_sb(_assessment_row(status="booked"))
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb):
        res = authed_client.post(
            "/checkout/confirm-complimentary", json={"cartPayload": _payload()}
        )
    assert res.status_code == 409


def test_confirm_complimentary_requires_pickup_window(authed_client):
    """Pickup-before-confirmation (2026-10-02): no window, no order."""
    sb, orders_table, _items = _make_sb(_assessment_row())
    payload = _payload()
    del payload["pickup_window"]
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb):
        res = authed_client.post("/checkout/confirm-complimentary", json={"cartPayload": payload})
    assert res.status_code == 400
    orders_table.insert.assert_not_called()


def test_confirm_complimentary_fails_closed_when_slot_unavailable(authed_client):
    """If cal-book can't hold the slot, nothing is created — never "confirmed"
    with pickup unresolved."""
    sb, orders_table, _items = _make_sb(_assessment_row())
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb), patch(
        "app.routes.create_checkout.httpx.post",
        return_value=SimpleNamespace(status_code=409, json=lambda: {"error": "taken"}, text="taken"),
    ):
        res = authed_client.post(
            "/checkout/confirm-complimentary", json={"cartPayload": _payload()}
        )
    assert res.status_code == 409
    assert "no longer available" in res.text
    orders_table.insert.assert_not_called()


def test_confirm_complimentary_happy_path_books_and_creates_zero_dollar_order(authed_client):
    sb, orders_table, items_table = _make_sb(
        _assessment_row(), insert_result={"id": "ord-new"}
    )
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb), _mock_cal_book(
        "evt_abc"
    ):
        res = authed_client.post(
            "/checkout/confirm-complimentary", json={"cartPayload": _payload()}
        )
    assert res.status_code == 200, res.text
    assert res.json() == {"orderId": "ord-new"}

    insert_args = orders_table.insert.call_args[0][0]
    assert insert_args["payment_status"] == "complimentary"
    assert insert_args["total_cents"] == 0
    assert insert_args["repairs_subtotal_cents"] == 0
    assert insert_args["courier_fee_cents"] == 0
    assert insert_args["assessment_id"] == "asm-1"
    assert insert_args["pickup_calendly_event_uri"] == "evt_abc"
    assert insert_args["stripe_session_id"] is None

    items_table.insert.assert_called_once()
    item_rows = items_table.insert.call_args[0][0]
    assert item_rows[0]["price_cents"] == 0


def test_confirm_complimentary_duplicate_is_idempotent_and_cancels_orphan_booking(authed_client):
    """A double-click (or retry) hits the orders_assessment_id_unique index —
    the endpoint must return the already-created order, not a second one,
    and must cancel the booking it just made rather than leave two holds."""
    unique_violation = {"code": "23505", "message": "duplicate key"}
    sb, orders_table, _items = _make_sb(
        _assessment_row(), insert_error=unique_violation, existing_order={"id": "ord-existing"}
    )
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb), _mock_cal_book(
        "evt_dup"
    ) as cal_book_mock:
        res = authed_client.post(
            "/checkout/confirm-complimentary", json={"cartPayload": _payload()}
        )
    assert res.status_code == 200, res.text
    assert res.json() == {"orderId": "ord-existing"}
    # cal-book (to create the hold) and cal-cancel (to release the orphaned
    # duplicate) should both have been called — two total POSTs.
    assert cal_book_mock.call_count == 2
    cancel_call = cal_book_mock.call_args_list[1]
    assert cancel_call.kwargs["json"] == {"event_uri": "evt_dup"}


def test_confirm_complimentary_guest_cannot_claim_signed_in_users_request(unauth_client):
    """A guest (no auth) may not confirm a request owned by a signed-in user."""
    sb, _orders, _items = _make_sb(_assessment_row(user_id="user-123"))
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb):
        res = unauth_client.post(
            "/checkout/confirm-complimentary", json={"cartPayload": _payload()}
        )
    assert res.status_code == 403
