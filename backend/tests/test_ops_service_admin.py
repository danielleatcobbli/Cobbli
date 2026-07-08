from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.auth import AuthUser, require_admin


def _admin_user():
    return AuthUser(id="admin-1", email="admin@example.com", access_token="tok")


def _mock(rows):
    chain = MagicMock()
    for m in ("update", "eq", "upsert", "delete", "select"):
        getattr(chain, m).return_value = chain
    chain.execute.return_value = SimpleNamespace(data=rows, error=None)
    sb = MagicMock()
    sb.table.return_value = chain
    return sb, chain


def _override(client):
    client.app.dependency_overrides[require_admin] = _admin_user


def _clear(client):
    client.app.dependency_overrides.pop(require_admin, None)


# ---- auth / role gating ----


def test_service_update_requires_auth(unauth_client):
    res = unauth_client.patch("/ops/services/s1", json={"base_price_cents": 100})
    assert res.status_code == 401


def test_service_update_forbidden_for_staff(client, monkeypatch):
    monkeypatch.setattr("app.auth._roles_for", lambda _uid: {"staff"})
    res = client.patch("/ops/services/s1", json={"base_price_cents": 100})
    assert res.status_code == 403


# ---- services ----


def test_service_update_happy(client, monkeypatch):
    _override(client)
    rows = [{"id": "s1", "base_price_cents": 4200}]
    sb, chain = _mock(rows)
    monkeypatch.setattr(
        "app.routes.ops_service_admin.get_supabase_for_user", lambda _t: sb
    )
    res = client.patch("/ops/services/s1", json={"base_price_cents": 4200})
    assert res.status_code == 200, res.text
    assert res.json() == {"data": rows[0]}
    chain.update.assert_called_once_with({"base_price_cents": 4200})
    _clear(client)


def test_service_update_no_fields(client, monkeypatch):
    _override(client)
    res = client.patch("/ops/services/s1", json={})
    assert res.status_code == 400
    _clear(client)


def test_service_update_not_found(client, monkeypatch):
    _override(client)
    sb, _c = _mock([])
    monkeypatch.setattr(
        "app.routes.ops_service_admin.get_supabase_for_user", lambda _t: sb
    )
    res = client.patch("/ops/services/s1", json={"turnaround_days": 3})
    assert res.status_code == 404
    _clear(client)


# ---- service areas ----


def test_service_area_upsert_happy(client, monkeypatch):
    _override(client)
    rows = [{"zip": "10001", "is_active": True}]
    sb, chain = _mock(rows)
    monkeypatch.setattr(
        "app.routes.ops_service_admin.get_supabase_for_user", lambda _t: sb
    )
    res = client.put("/ops/service-areas/10001", json={"is_active": True})
    assert res.status_code == 200, res.text
    assert res.json()["data"]["zip"] == "10001"
    _clear(client)


def test_service_area_invalid_zip(client, monkeypatch):
    _override(client)
    res = client.put("/ops/service-areas/abc", json={"is_active": True})
    assert res.status_code == 400
    _clear(client)


def test_service_area_delete_happy(client, monkeypatch):
    _override(client)
    sb, _c = _mock([])
    monkeypatch.setattr(
        "app.routes.ops_service_admin.get_supabase_for_user", lambda _t: sb
    )
    res = client.delete("/ops/service-areas/10001")
    assert res.status_code == 200, res.text
    assert res.json() == {"ok": True}
    _clear(client)


def test_service_area_delete_invalid_zip(client, monkeypatch):
    _override(client)
    res = client.delete("/ops/service-areas/9")
    assert res.status_code == 400
    _clear(client)


# ---- pricing config ----


def test_pricing_config_upsert_happy(client, monkeypatch):
    _override(client)
    rows = [{"key": "courier_fee_cents", "value_cents": 1800}]
    sb, chain = _mock(rows)
    monkeypatch.setattr(
        "app.routes.ops_service_admin.get_supabase_for_user", lambda _t: sb
    )
    res = client.put(
        "/ops/pricing-config/courier_fee_cents", json={"value_cents": 1800}
    )
    assert res.status_code == 200, res.text
    assert res.json()["data"]["value_cents"] == 1800
    upserted = chain.upsert.call_args.args[0]
    assert upserted["key"] == "courier_fee_cents"
    assert upserted["value_cents"] == 1800
    _clear(client)


def test_pricing_config_negative_value_rejected(client, monkeypatch):
    _override(client)
    res = client.put(
        "/ops/pricing-config/courier_fee_cents", json={"value_cents": -5}
    )
    assert res.status_code == 422  # pydantic ge=0 validation
    _clear(client)
