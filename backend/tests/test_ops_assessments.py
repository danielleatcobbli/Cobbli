from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.auth import AuthUser, require_staff


def _staff_user():
    return AuthUser(id="staff-1", email="staff@example.com", access_token="tok")


def _chain(data, error=None):
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.neq.return_value = chain
    chain.in_.return_value = chain
    chain.order.return_value = chain
    chain.maybe_single.return_value = chain
    chain.update.return_value = chain
    chain.execute.return_value = SimpleNamespace(data=data, error=error)
    return chain


def _select_mock(rows, orders=None, orders_error=None):
    """Build a supabase mock: `assessments` terminates in execute() ->
    data=rows, `orders` (linked-order lookup) in data=orders."""
    chain = _chain(rows)
    orders_chain = _chain(orders or [], orders_error)
    sb = MagicMock()
    sb.table.side_effect = lambda name: orders_chain if name == "orders" else chain
    return sb, chain


def test_list_requires_auth(unauth_client):
    res = unauth_client.get("/ops/assessments/")
    assert res.status_code == 401


def test_list_forbidden_for_non_staff(client, monkeypatch):
    # authenticated as a plain user (no staff/admin role)
    monkeypatch.setattr("app.auth._roles_for", lambda _uid: {"customer"})
    res = client.get("/ops/assessments/")
    assert res.status_code == 403


def test_list_happy_path(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    rows = [{"id": "a1", "status": "pending"}]
    sb, chain = _select_mock(rows)
    monkeypatch.setattr(
        "app.routes.ops_assessments.get_supabase_for_user", lambda _t: sb
    )
    res = client.get("/ops/assessments/?status_filter=pending")
    assert res.status_code == 200, res.text
    assert res.json() == {"data": [{"id": "a1", "status": "pending", "order": None}]}
    chain.eq.assert_any_call("status", "pending")
    client.app.dependency_overrides.pop(require_staff, None)


def test_list_attaches_linked_order(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    rows = [{"id": "a1", "status": "booked"}, {"id": "a2", "status": "pending"}]
    orders = [{"id": "o1", "order_number": "CB-1", "status": "placed", "assessment_id": "a1"}]
    sb, _chain_ = _select_mock(rows, orders)
    monkeypatch.setattr("app.routes.ops_assessments.get_supabase_for_user", lambda _t: sb)
    res = client.get("/ops/assessments/")
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data[0]["order"]["order_number"] == "CB-1"
    assert data[1]["order"] is None
    client.app.dependency_overrides.pop(require_staff, None)


def test_list_fails_loudly_when_order_lookup_fails(client, monkeypatch):
    # A failed order lookup must be an error, never rows with the order
    # silently missing (a booked request would look un-booked).
    client.app.dependency_overrides[require_staff] = _staff_user
    sb, _chain_ = _select_mock([{"id": "a1", "status": "booked"}], orders_error="db down")
    monkeypatch.setattr("app.routes.ops_assessments.get_supabase_for_user", lambda _t: sb)
    res = client.get("/ops/assessments/")
    assert res.status_code == 502
    client.app.dependency_overrides.pop(require_staff, None)


def test_get_one_includes_linked_order(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    orders = [{"id": "o1", "order_number": "CB-1", "status": "placed", "assessment_id": "a1"}]
    sb, _chain_ = _select_mock({"id": "a1", "status": "booked"}, orders)
    monkeypatch.setattr("app.routes.ops_assessments.get_supabase_for_user", lambda _t: sb)
    res = client.get("/ops/assessments/a1")
    assert res.status_code == 200, res.text
    assert res.json()["data"]["order"]["id"] == "o1"
    client.app.dependency_overrides.pop(require_staff, None)


def test_get_one_not_found(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    sb, _c = _select_mock(None)
    monkeypatch.setattr(
        "app.routes.ops_assessments.get_supabase_for_user", lambda _t: sb
    )
    res = client.get("/ops/assessments/missing")
    assert res.status_code == 404
    client.app.dependency_overrides.pop(require_staff, None)


def test_patch_happy_path(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    updated = [{"id": "a1", "status": "needs_more_info"}]
    sb, chain = _select_mock(updated)
    monkeypatch.setattr(
        "app.routes.ops_assessments.get_supabase_for_user", lambda _t: sb
    )
    res = client.patch("/ops/assessments/a1", json={"status": "needs_more_info"})
    assert res.status_code == 200, res.text
    assert res.json() == {"data": updated[0]}
    client.app.dependency_overrides.pop(require_staff, None)


def test_patch_invalid_status(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    res = client.patch("/ops/assessments/a1", json={"status": "bogus"})
    assert res.status_code == 400
    client.app.dependency_overrides.pop(require_staff, None)


def test_patch_no_fields(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    res = client.patch("/ops/assessments/a1", json={})
    assert res.status_code == 400
    client.app.dependency_overrides.pop(require_staff, None)


def test_staff_cannot_manually_mark_request_booked(client):
    client.app.dependency_overrides[require_staff] = _staff_user
    assert client.patch("/ops/assessments/a1", json={"status":"booked"}).status_code == 400


def test_publish_requires_bag_assignments(client):
    client.app.dependency_overrides[require_staff] = _staff_user
    assert client.patch("/ops/assessments/a1", json={"status":"quote_ready", "proposed_services":[{"name":"Stitch"}]}).status_code == 400
