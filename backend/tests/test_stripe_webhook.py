from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


def test_rejects_missing_signature(client):
    res = client.post("/stripe/webhook", content=b"{}")
    assert res.status_code == 400
    assert "signature" in res.text.lower()


def test_rejects_invalid_signature(client):
    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        side_effect=ValueError("bad sig"),
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=garbage"},
        )
    assert res.status_code == 400


def test_checkout_session_completed_marks_deposit_paid(client):
    event = SimpleNamespace(
        type="checkout.session.completed",
        data=SimpleNamespace(
            object={
                "id": "cs_test_dep",
                "payment_status": "paid",
                "payment_intent": "pi_dep_1",
                "metadata": {"kind": "deposit", "assessmentId": "a-1"},
            }
        ),
    )

    assessments_table = MagicMock()
    update_chain = MagicMock()
    eq_chain = MagicMock()
    update_chain.eq.return_value = eq_chain
    eq_chain.execute.return_value = MagicMock(data=[{"id": "a-1"}], error=None)
    assessments_table.update.return_value = update_chain

    def factory(name):
        if name == "assessments":
            return assessments_table
        return MagicMock()

    sb = MagicMock()
    sb.table.side_effect = factory
    sb.from_.side_effect = factory

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 200
    assert res.json() == {"received": True}
    assessments_table.update.assert_called_once()
    args = assessments_table.update.call_args[0][0]
    assert args["deposit_status"] == "paid"
    assert args["stripe_payment_intent_id"] == "pi_dep_1"
    assert "deposit_paid_at" in args
    update_chain.eq.assert_called_once_with("id", "a-1")


def test_checkout_session_completed_marks_order_paid(client):
    event = SimpleNamespace(
        type="checkout.session.completed",
        data=SimpleNamespace(
            object={
                "id": "cs_test_order",
                "payment_status": "paid",
                "payment_intent": {"id": "pi_ord_1"},
                "metadata": {"kind": "order", "orderId": "o-1"},
            }
        ),
    )

    orders_table = MagicMock()
    update_chain = MagicMock()
    eq_chain = MagicMock()
    update_chain.eq.return_value = eq_chain
    eq_chain.execute.return_value = MagicMock(data=[{"id": "o-1"}], error=None)
    orders_table.update.return_value = update_chain

    def factory(name):
        if name == "orders":
            return orders_table
        return MagicMock()

    sb = MagicMock()
    sb.table.side_effect = factory
    sb.from_.side_effect = factory

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 200
    orders_table.update.assert_called_once()
    args = orders_table.update.call_args[0][0]
    assert args["payment_status"] == "paid"
    assert args["status"] == "placed"
    assert args["stripe_payment_intent_id"] == "pi_ord_1"
    update_chain.eq.assert_called_once_with("id", "o-1")


def test_checkout_session_unpaid_does_nothing(client):
    event = SimpleNamespace(
        type="checkout.session.completed",
        data=SimpleNamespace(
            object={
                "id": "cs_x",
                "payment_status": "unpaid",
                "payment_intent": None,
                "metadata": {"kind": "order", "orderId": "o-2"},
            }
        ),
    )

    sb = MagicMock()
    table = MagicMock()
    sb.table.return_value = table
    sb.from_.return_value = table

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 200
    table.update.assert_not_called()


def test_cart_checkout_session_creates_order_and_items(client):
    cart_payload = {
        "contact_email": "c@example.com",
        "contact_phone": "+1",
        "delivery_address": {"line1": "1 Main"},
        "repairs_subtotal_cents": 5000,
        "courier_fee_cents": 1000,
        "total_cents": 6000,
        "items": [
            {
                "pair_snapshot": {"brand": "Nike"},
                "service_snapshot": {"id": "svc-1", "name": "Sole"},
                "price_cents": 5000,
            }
        ],
    }
    cart_str = json.dumps(cart_payload)

    metadata = {
        "kind": "cart",
        "userId": "u-1",
        "cart_0": cart_str,
    }

    event = SimpleNamespace(
        type="checkout.session.completed",
        data=SimpleNamespace(
            object={
                "id": "cs_cart_1",
                "payment_status": "paid",
                "payment_intent": "pi_cart_1",
                "metadata": metadata,
            }
        ),
    )

    orders_table = MagicMock()
    items_table = MagicMock()

    select_chain = MagicMock()
    eq_chain = MagicMock()
    eq_chain.maybe_single.return_value.execute.return_value = MagicMock(
        data=None, error=None
    )
    select_chain.eq.return_value = eq_chain
    orders_table.select.return_value = select_chain

    insert_chain = MagicMock()
    insert_select = MagicMock()
    insert_select.single.return_value.execute.return_value = MagicMock(
        data={"id": "ord-new"}, error=None
    )
    insert_chain.select.return_value = insert_select
    orders_table.insert.return_value = insert_chain

    update_chain = MagicMock()
    update_chain.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "ord-new"}], error=None
    )
    orders_table.update.return_value = update_chain

    items_insert = MagicMock()
    items_insert.execute.return_value = MagicMock(data=[], error=None)
    items_table.insert.return_value = items_insert

    def factory(name):
        if name == "orders":
            return orders_table
        if name == "order_items":
            return items_table
        return MagicMock()

    sb = MagicMock()
    sb.table.side_effect = factory
    sb.from_.side_effect = factory

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 200

    orders_table.insert.assert_called_once()
    insert_args = orders_table.insert.call_args[0][0]
    assert insert_args["user_id"] == "u-1"
    assert insert_args["status"] == "pending_payment"
    assert insert_args["total_cents"] == 6000
    assert insert_args["stripe_session_id"] == "cs_cart_1"
    assert insert_args["stripe_payment_intent_id"] == "pi_cart_1"
    assert insert_args["payment_status"] == "paid"

    items_table.insert.assert_called_once()
    items_arg = items_table.insert.call_args[0][0]
    assert len(items_arg) == 1
    assert items_arg[0]["order_id"] == "ord-new"
    assert items_arg[0]["price_cents"] == 5000

    orders_table.update.assert_called_once()
    update_args = orders_table.update.call_args[0][0]
    assert update_args == {"status": "placed"}


def test_cart_session_idempotent_when_order_exists(client):
    metadata = {"kind": "cart", "userId": "u-1", "cart_0": "{}"}
    event = SimpleNamespace(
        type="checkout.session.completed",
        data=SimpleNamespace(
            object={
                "id": "cs_cart_dup",
                "payment_status": "paid",
                "payment_intent": "pi_x",
                "metadata": metadata,
            }
        ),
    )

    orders_table = MagicMock()
    select_chain = MagicMock()
    eq_chain = MagicMock()
    eq_chain.maybe_single.return_value.execute.return_value = MagicMock(
        data={"id": "existing"}, error=None
    )
    select_chain.eq.return_value = eq_chain
    orders_table.select.return_value = select_chain

    def factory(name):
        if name == "orders":
            return orders_table
        return MagicMock()

    sb = MagicMock()
    sb.table.side_effect = factory
    sb.from_.side_effect = factory

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 200
    orders_table.insert.assert_not_called()
    orders_table.update.assert_not_called()


def test_payment_intent_succeeded_marks_deposit_paid(client):
    event = SimpleNamespace(
        type="payment_intent.succeeded",
        data=SimpleNamespace(
            object={
                "id": "pi_dep_2",
                "metadata": {"kind": "deposit", "assessmentId": "a-2"},
            }
        ),
    )

    assessments_table = MagicMock()
    update_chain = MagicMock()
    update_chain.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "a-2"}], error=None
    )
    assessments_table.update.return_value = update_chain

    def factory(name):
        if name == "assessments":
            return assessments_table
        return MagicMock()

    sb = MagicMock()
    sb.table.side_effect = factory
    sb.from_.side_effect = factory

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 200
    args = assessments_table.update.call_args[0][0]
    assert args["deposit_status"] == "paid"
    assert args["stripe_payment_intent_id"] == "pi_dep_2"


def test_payment_intent_succeeded_skips_cart(client):
    event = SimpleNamespace(
        type="payment_intent.succeeded",
        data=SimpleNamespace(
            object={
                "id": "pi_cart_dup",
                "metadata": {"kind": "cart", "userId": "u-1"},
            }
        ),
    )

    sb = MagicMock()
    table = MagicMock()
    sb.table.return_value = table
    sb.from_.return_value = table

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 200
    table.update.assert_not_called()
    table.insert.assert_not_called()


def test_payment_intent_failed_marks_order_failed(client):
    event = SimpleNamespace(
        type="payment_intent.payment_failed",
        data=SimpleNamespace(
            object={
                "id": "pi_fail_1",
                "metadata": {"kind": "order", "orderId": "o-3"},
            }
        ),
    )

    orders_table = MagicMock()
    update_chain = MagicMock()
    update_chain.eq.return_value.execute.return_value = MagicMock(
        data=[{"id": "o-3"}], error=None
    )
    orders_table.update.return_value = update_chain

    def factory(name):
        if name == "orders":
            return orders_table
        return MagicMock()

    sb = MagicMock()
    sb.table.side_effect = factory
    sb.from_.side_effect = factory

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 200
    args = orders_table.update.call_args[0][0]
    assert args == {"payment_status": "failed"}


def test_unhandled_event_type_returns_200(client):
    event = SimpleNamespace(
        type="customer.created",
        data=SimpleNamespace(object={"id": "cus_x"}),
    )

    sb = MagicMock()

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 200
    assert res.json() == {"received": True}


def test_handler_error_returns_500(client):
    event = SimpleNamespace(
        type="checkout.session.completed",
        data=SimpleNamespace(
            object={
                "id": "cs_boom",
                "payment_status": "paid",
                "payment_intent": "pi_x",
                "metadata": {"kind": "order", "orderId": "o-x"},
            }
        ),
    )

    sb = MagicMock()
    sb.table.side_effect = RuntimeError("db blew up")
    sb.from_.side_effect = RuntimeError("db blew up")

    with patch(
        "app.routes.stripe_webhook.stripe.Webhook.construct_event",
        return_value=event,
    ), patch(
        "app.routes.stripe_webhook.get_supabase_admin", return_value=sb
    ):
        res = client.post(
            "/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "t=1,v1=ok"},
        )

    assert res.status_code == 500
