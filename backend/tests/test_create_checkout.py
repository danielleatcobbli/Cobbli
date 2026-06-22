from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.auth import AuthUser, require_user


@pytest.fixture
def auth_user():
    return AuthUser(id="user-123", email="buyer@example.com", access_token="tok")


@pytest.fixture
def authed_client(client, auth_user):
    client.app.dependency_overrides[require_user] = lambda: auth_user
    yield client
    client.app.dependency_overrides.pop(require_user, None)


def _stripe_session(session_id: str = "cs_test_1", client_secret: str = "cs_test_secret"):  # noqa: S107
    return SimpleNamespace(id=session_id, client_secret=client_secret)


def _make_supabase_mock(select_response):
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.maybe_single.return_value = chain
    chain.execute.return_value = select_response

    update_chain = MagicMock()
    update_chain.eq.return_value = update_chain
    update_chain.execute.return_value = SimpleNamespace(data=None, error=None)
    chain.update.return_value = update_chain

    sb = MagicMock()
    sb.table.return_value = chain
    sb.from_.return_value = chain
    return sb, chain, update_chain


def test_missing_bearer_returns_401(unauth_client):
    res = unauth_client.post(
        "/checkout/", json={"kind": "deposit", "returnUrl": "https://x"}
    )
    assert res.status_code == 401


def test_missing_kind_returns_400(authed_client):
    res = authed_client.post("/checkout/", json={"returnUrl": "https://x"})
    assert res.status_code == 400


def test_missing_return_url_returns_400(authed_client):
    res = authed_client.post("/checkout/", json={"kind": "deposit"})
    assert res.status_code == 400


def test_unknown_kind_returns_400(authed_client):
    res = authed_client.post(
        "/checkout/", json={"kind": "bogus", "returnUrl": "https://x"}
    )
    assert res.status_code == 400


def test_deposit_creates_session(authed_client):
    select_resp = SimpleNamespace(
        data={"id": "asm-1", "user_id": "user-123", "deposit_status": "pending"},
        error=None,
    )
    sb, _chain, update_chain = _make_supabase_mock(select_resp)

    with patch(
        "app.routes.create_checkout.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[]),
    ), patch(
        "app.routes.create_checkout.stripe.Customer.list",
        return_value=SimpleNamespace(data=[]),
    ), patch(
        "app.routes.create_checkout.stripe.Customer.create",
        return_value=SimpleNamespace(id="cus_1"),
    ) as create_customer, patch(
        "app.routes.create_checkout.stripe.checkout.Session.create",
        return_value=_stripe_session("cs_dep", "secret_dep"),
    ) as create_session:
        res = authed_client.post(
            "/checkout/",
            json={"kind": "deposit", "rowId": "asm-1", "returnUrl": "https://x/done"},
        )

    assert res.status_code == 200, res.text
    assert res.json() == {"clientSecret": "secret_dep"}

    kwargs = create_session.call_args.kwargs
    assert kwargs["mode"] == "payment"
    assert kwargs["ui_mode"] == "embedded"
    assert kwargs["return_url"] == "https://x/done"
    assert kwargs["customer"] == "cus_1"
    assert kwargs["line_items"][0]["price_data"]["unit_amount"] == 2000
    assert kwargs["metadata"]["userId"] == "user-123"
    assert kwargs["metadata"]["kind"] == "deposit"
    assert kwargs["metadata"]["assessmentId"] == "asm-1"

    assert create_customer.called
    update_chain.eq.assert_called_with("id", "asm-1")


def test_deposit_missing_row_id(authed_client):
    with patch("app.routes.create_checkout.get_supabase_admin"):
        res = authed_client.post(
            "/checkout/", json={"kind": "deposit", "returnUrl": "https://x"}
        )
    assert res.status_code == 400


def test_deposit_assessment_not_found(authed_client):
    select_resp = SimpleNamespace(data=None, error=None)
    sb, _chain, _u = _make_supabase_mock(select_resp)
    with patch(
        "app.routes.create_checkout.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_x")]),
    ):
        res = authed_client.post(
            "/checkout/",
            json={"kind": "deposit", "rowId": "missing", "returnUrl": "https://x"},
        )
    assert res.status_code == 404


def test_deposit_forbidden_other_user(authed_client):
    select_resp = SimpleNamespace(
        data={"id": "asm-1", "user_id": "someone-else", "deposit_status": "pending"},
        error=None,
    )
    sb, _c, _u = _make_supabase_mock(select_resp)
    with patch(
        "app.routes.create_checkout.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_x")]),
    ):
        res = authed_client.post(
            "/checkout/",
            json={"kind": "deposit", "rowId": "asm-1", "returnUrl": "https://x"},
        )
    assert res.status_code == 403


def test_deposit_already_paid(authed_client):
    select_resp = SimpleNamespace(
        data={"id": "asm-1", "user_id": "user-123", "deposit_status": "paid"},
        error=None,
    )
    sb, _c, _u = _make_supabase_mock(select_resp)
    with patch(
        "app.routes.create_checkout.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_x")]),
    ):
        res = authed_client.post(
            "/checkout/",
            json={"kind": "deposit", "rowId": "asm-1", "returnUrl": "https://x"},
        )
    assert res.status_code == 409


def test_order_creates_session(authed_client):
    select_resp = SimpleNamespace(
        data={
            "id": "ord-1",
            "user_id": "user-123",
            "payment_status": "pending",
            "total_cents": 12345,
            "order_number": "CB-001",
        },
        error=None,
    )
    sb, _chain, update_chain = _make_supabase_mock(select_resp)

    with patch(
        "app.routes.create_checkout.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_o")]),
    ), patch(
        "app.routes.create_checkout.stripe.checkout.Session.create",
        return_value=_stripe_session("cs_o", "secret_o"),
    ) as create_session:
        res = authed_client.post(
            "/checkout/",
            json={"kind": "order", "rowId": "ord-1", "returnUrl": "https://x/done"},
        )

    assert res.status_code == 200, res.text
    assert res.json() == {"clientSecret": "secret_o"}

    kwargs = create_session.call_args.kwargs
    assert kwargs["line_items"][0]["price_data"]["unit_amount"] == 12345
    assert "Cobbli order CB-001" in kwargs["line_items"][0]["price_data"]["product_data"]["name"]
    assert kwargs["metadata"]["orderId"] == "ord-1"
    assert kwargs["metadata"]["kind"] == "order"
    update_chain.eq.assert_called_with("id", "ord-1")


def test_order_invalid_total(authed_client):
    select_resp = SimpleNamespace(
        data={
            "id": "ord-1",
            "user_id": "user-123",
            "payment_status": "pending",
            "total_cents": 10,
            "order_number": "CB-001",
        },
        error=None,
    )
    sb, _c, _u = _make_supabase_mock(select_resp)
    with patch(
        "app.routes.create_checkout.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_x")]),
    ):
        res = authed_client.post(
            "/checkout/",
            json={"kind": "order", "rowId": "ord-1", "returnUrl": "https://x"},
        )
    assert res.status_code == 400


def _valid_cart():
    return {
        "contact_email": "x@y.com",
        "contact_phone": "+15555550100",
        "delivery_address": {"line1": "1 Main"},
        "repairs_subtotal_cents": 5000,
        "courier_fee_cents": 500,
        "total_cents": 5500,
        "items": [
            {
                "pair_snapshot": {"brand": "X"},
                "service_snapshot": {"id": "svc-1", "name": "Resole"},
                "price_cents": 5000,
            }
        ],
    }


def test_cart_creates_session_and_chunks_metadata(authed_client):
    sb, _c, _u = _make_supabase_mock(SimpleNamespace(data=None, error=None))
    payload = _valid_cart()

    with patch(
        "app.routes.create_checkout.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_c")]),
    ), patch(
        "app.routes.create_checkout.stripe.checkout.Session.create",
        return_value=_stripe_session("cs_c", "secret_c"),
    ) as create_session:
        res = authed_client.post(
            "/checkout/",
            json={
                "kind": "cart",
                "returnUrl": "https://x/done",
                "cartPayload": payload,
            },
        )

    assert res.status_code == 200, res.text
    assert res.json() == {"clientSecret": "secret_c"}

    md = create_session.call_args.kwargs["metadata"]
    assert md["userId"] == "user-123"
    assert md["kind"] == "cart"

    chunks = sorted(
        (k for k in md if k.startswith("cart_")),
        key=lambda k: int(k.split("_")[1]),
    )
    assert chunks, "expected cart_N chunks"
    rebuilt = "".join(md[k] for k in chunks)
    assert json.loads(rebuilt) == payload


def test_cart_invalid_email(authed_client):
    bad = _valid_cart()
    bad["contact_email"] = "not-an-email"
    with patch("app.routes.create_checkout.get_supabase_admin"), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_x")]),
    ):
        res = authed_client.post(
            "/checkout/",
            json={"kind": "cart", "returnUrl": "https://x", "cartPayload": bad},
        )
    assert res.status_code == 400


def test_cart_total_too_low(authed_client):
    bad = _valid_cart()
    bad["total_cents"] = 10
    with patch("app.routes.create_checkout.get_supabase_admin"), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_x")]),
    ):
        res = authed_client.post(
            "/checkout/",
            json={"kind": "cart", "returnUrl": "https://x", "cartPayload": bad},
        )
    assert res.status_code == 400


def test_cart_no_items(authed_client):
    bad = _valid_cart()
    bad["items"] = []
    with patch("app.routes.create_checkout.get_supabase_admin"), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_x")]),
    ):
        res = authed_client.post(
            "/checkout/",
            json={"kind": "cart", "returnUrl": "https://x", "cartPayload": bad},
        )
    assert res.status_code == 400


def test_resolve_customer_found_by_metadata(authed_client):
    sb, _c, _u = _make_supabase_mock(
        SimpleNamespace(
            data={"id": "asm-1", "user_id": "user-123", "deposit_status": "pending"},
            error=None,
        )
    )
    with patch(
        "app.routes.create_checkout.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[SimpleNamespace(id="cus_meta")]),
    ) as search, patch(
        "app.routes.create_checkout.stripe.Customer.list"
    ) as list_call, patch(
        "app.routes.create_checkout.stripe.Customer.create"
    ) as create_call, patch(
        "app.routes.create_checkout.stripe.checkout.Session.create",
        return_value=_stripe_session(),
    ) as session_create:
        res = authed_client.post(
            "/checkout/",
            json={"kind": "deposit", "rowId": "asm-1", "returnUrl": "https://x"},
        )

    assert res.status_code == 200, res.text
    search.assert_called_once()
    list_call.assert_not_called()
    create_call.assert_not_called()
    assert session_create.call_args.kwargs["customer"] == "cus_meta"


def test_resolve_customer_by_email_updates_metadata(authed_client):
    sb, _c, _u = _make_supabase_mock(
        SimpleNamespace(
            data={"id": "asm-1", "user_id": "user-123", "deposit_status": "pending"},
            error=None,
        )
    )
    with patch(
        "app.routes.create_checkout.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.create_checkout.stripe.Customer.search",
        return_value=SimpleNamespace(data=[]),
    ), patch(
        "app.routes.create_checkout.stripe.Customer.list",
        return_value=SimpleNamespace(
            data=[SimpleNamespace(id="cus_em", metadata={"foo": "bar"})]
        ),
    ), patch(
        "app.routes.create_checkout.stripe.Customer.modify"
    ) as modify, patch(
        "app.routes.create_checkout.stripe.Customer.create"
    ) as create_call, patch(
        "app.routes.create_checkout.stripe.checkout.Session.create",
        return_value=_stripe_session(),
    ):
        res = authed_client.post(
            "/checkout/",
            json={"kind": "deposit", "rowId": "asm-1", "returnUrl": "https://x"},
        )

    assert res.status_code == 200, res.text
    modify.assert_called_once()
    create_call.assert_not_called()
    md = modify.call_args.kwargs["metadata"]
    assert md["userId"] == "user-123"
    assert md["foo"] == "bar"
