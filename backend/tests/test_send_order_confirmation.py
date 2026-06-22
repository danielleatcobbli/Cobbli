from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _order(**overrides) -> dict:
    base = {
        "id": "order-1",
        "user_id": "user-1",
        "order_number": "CB-1001",
        "delivery_method": "door-to-door",
        "contact_email": "buyer@example.com",
        "delivery_address": {
            "street": "123 Main St",
            "street2": "",
            "city": "Brooklyn",
            "state": "NY",
            "zip": "11201",
        },
        "repairs_subtotal_cents": 4500,
        "courier_fee_cents": 1000,
        "tax_cents": 500,
        "total_cents": 6000,
    }
    base.update(overrides)
    return base


def _build_admin_mock(profile: dict | None, items: list[dict] | None) -> MagicMock:
    admin = MagicMock()

    def _from(table: str):
        tbl = MagicMock()
        sel = MagicMock()
        eq = MagicMock()
        tbl.select.return_value = sel
        sel.eq.return_value = eq
        if table == "profiles":
            eq.maybe_single.return_value.execute.return_value = MagicMock(
                data=profile, error=None
            )
            eq.execute.return_value = MagicMock(data=profile, error=None)
        elif table == "order_items":
            eq.execute.return_value = MagicMock(data=items or [], error=None)
        return tbl

    admin.from_.side_effect = _from
    admin.table.side_effect = _from
    return admin


@pytest.fixture
def admin_mock():
    profile = {"first_name": "Jane", "email": "buyer@example.com"}
    items = [
        {
            "pair_snapshot": {"brand": "Nike", "shoe_type": "Air Max"},
            "service_snapshot": {"name": "Sole repair"},
            "price_cents": 4500,
        },
        {
            "pair_snapshot": {"brand": "Nike", "shoe_type": "Air Max"},
            "service_snapshot": {"name": "Polish"},
            "price_cents": 0,
        },
    ]
    return _build_admin_mock(profile, items)


def test_happy_path_sends_brevo_template(client, admin_mock) -> None:
    brevo_mock = AsyncMock(return_value={"messageId": "msg-1"})
    with patch(
        "app.routes.send_order_confirmation.get_supabase_admin",
        return_value=admin_mock,
    ), patch(
        "app.routes.send_order_confirmation.send_brevo_email",
        brevo_mock,
    ):
        res = client.post("/email/order-confirmation", json={"record": _order()})

    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["brevo"] == {"messageId": "msg-1"}

    brevo_mock.assert_awaited_once()
    kwargs = brevo_mock.await_args.kwargs
    assert kwargs["template_id"] == 1
    assert kwargs["to"] == [{"email": "buyer@example.com", "name": "Jane"}]
    assert kwargs["tags"] == ["order-confirmation"]
    params = kwargs["params"]
    assert params["first_name"] == "Jane"
    assert params["order_number"] == "CB-1001"
    assert params["pair_identifier"] == "Nike Air Max"
    assert params["service_1"] == "Sole repair"
    assert params["service_2"] == "Polish"
    assert params["price"] == "$45.00"
    assert params["pickup_address"] == "123 Main St, Brooklyn, NY, 11201"
    assert params["repairs_subtotal"] == "$45.00"
    assert params["courier_fee"] == "$10.00"
    assert params["tax"] == "$5.00"
    assert params["order_total"] == "$60.00"


def test_skips_when_not_door_to_door(client) -> None:
    brevo_mock = AsyncMock()
    with patch(
        "app.routes.send_order_confirmation.send_brevo_email", brevo_mock
    ), patch(
        "app.routes.send_order_confirmation.get_supabase_admin"
    ) as admin_factory:
        res = client.post(
            "/email/order-confirmation",
            json={"record": _order(delivery_method="pickup")},
        )

    assert res.status_code == 200
    assert res.json() == {"skipped": "not door-to-door"}
    brevo_mock.assert_not_awaited()
    admin_factory.assert_not_called()


def test_accepts_bare_order_payload(client, admin_mock) -> None:
    brevo_mock = AsyncMock(return_value={"messageId": "msg-2"})
    with patch(
        "app.routes.send_order_confirmation.get_supabase_admin",
        return_value=admin_mock,
    ), patch(
        "app.routes.send_order_confirmation.send_brevo_email",
        brevo_mock,
    ):
        res = client.post("/email/order-confirmation", json=_order())

    assert res.status_code == 200
    assert res.json()["ok"] is True
    brevo_mock.assert_awaited_once()


def test_missing_order_id_returns_500(client) -> None:
    res = client.post("/email/order-confirmation", json={"record": {}})
    assert res.status_code == 500
    assert "error" in res.json()


def test_falls_back_to_default_pair_identifier(client) -> None:
    admin = _build_admin_mock(
        profile={"first_name": "", "email": "x@example.com"},
        items=[
            {
                "pair_snapshot": {},
                "service_snapshot": {},
                "price_cents": 0,
            }
        ],
    )
    brevo_mock = AsyncMock(return_value={"messageId": "msg-3"})
    with patch(
        "app.routes.send_order_confirmation.get_supabase_admin",
        return_value=admin,
    ), patch(
        "app.routes.send_order_confirmation.send_brevo_email",
        brevo_mock,
    ):
        res = client.post("/email/order-confirmation", json={"record": _order()})

    assert res.status_code == 200
    params = brevo_mock.await_args.kwargs["params"]
    assert params["pair_identifier"] == "Your pair"
    assert params["service_1"] == "Service"
    assert params["service_2"] == ""
    assert params["price"] == "$0.00"


def test_brevo_failure_returns_500(client, admin_mock) -> None:
    brevo_mock = AsyncMock(side_effect=RuntimeError("brevo down"))
    with patch(
        "app.routes.send_order_confirmation.get_supabase_admin",
        return_value=admin_mock,
    ), patch(
        "app.routes.send_order_confirmation.send_brevo_email",
        brevo_mock,
    ):
        res = client.post("/email/order-confirmation", json={"record": _order()})

    assert res.status_code == 500
    assert "error" in res.json()


def test_handles_null_delivery_address(client, admin_mock) -> None:
    brevo_mock = AsyncMock(return_value={"messageId": "msg-4"})
    with patch(
        "app.routes.send_order_confirmation.get_supabase_admin",
        return_value=admin_mock,
    ), patch(
        "app.routes.send_order_confirmation.send_brevo_email",
        brevo_mock,
    ):
        res = client.post(
            "/email/order-confirmation",
            json={"record": _order(delivery_address=None)},
        )

    assert res.status_code == 200
    params = brevo_mock.await_args.kwargs["params"]
    assert params["pickup_address"] == ""
