from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.auth import AuthUser, require_staff


def _staff_user():
    return AuthUser(id="staff-1", email="staff@example.com", access_token="tok")


def _select_mock(rows):
    """Build a supabase mock whose select().eq()/order()/maybe_single() chain
    terminates in execute() -> data=rows."""
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.order.return_value = chain
    chain.maybe_single.return_value = chain
    chain.update.return_value = chain
    chain.execute.return_value = SimpleNamespace(data=rows, error=None)
    sb = MagicMock()
    sb.table.return_value = chain
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
    assert res.json() == {"data": rows}
    chain.eq.assert_any_call("status", "pending")
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
    updated = [{"id": "a1", "status": "in_review"}]
    sb, chain = _select_mock(updated)
    monkeypatch.setattr(
        "app.routes.ops_assessments.get_supabase_for_user", lambda _t: sb
    )
    res = client.patch("/ops/assessments/a1", json={"status": "in_review"})
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
