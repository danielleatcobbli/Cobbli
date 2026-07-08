from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.auth import AuthUser, require_staff


def _staff_user():
    return AuthUser(id="staff-1", email="staff@example.com", access_token="tok")


def _mock(rows):
    chain = MagicMock()
    chain.select.return_value = chain
    chain.in_.return_value = chain
    chain.execute.return_value = SimpleNamespace(data=rows, error=None)
    sb = MagicMock()
    sb.table.return_value = chain
    return sb, chain


_UUIDS = "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222"


def test_requires_auth(unauth_client):
    res = unauth_client.get(f"/ops/profiles?ids={_UUIDS}")
    assert res.status_code == 401


def test_forbidden_for_non_staff(client, monkeypatch):
    monkeypatch.setattr("app.auth._roles_for", lambda _uid: {"customer"})
    res = client.get(f"/ops/profiles?ids={_UUIDS}")
    assert res.status_code == 403


def test_happy_path_uses_admin_client(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    rows = [
        {
            "user_id": "11111111-1111-1111-1111-111111111111",
            "first_name": "Ada",
            "last_name": "Lovelace",
            "phone": "+15555550100",
        }
    ]
    sb, chain = _mock(rows)
    monkeypatch.setattr(
        "app.routes.ops_profiles.get_supabase_admin", lambda: sb
    )
    res = client.get(f"/ops/profiles?ids={_UUIDS}")
    assert res.status_code == 200, res.text
    assert res.json() == {"data": rows}
    # both validated UUIDs passed to the IN filter
    called_ids = chain.in_.call_args.args[1]
    assert len(called_ids) == 2
    client.app.dependency_overrides.pop(require_staff, None)


def test_invalid_uuid_rejected(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    res = client.get("/ops/profiles?ids=not-a-uuid")
    assert res.status_code == 400
    client.app.dependency_overrides.pop(require_staff, None)


def test_empty_ids_rejected(client, monkeypatch):
    client.app.dependency_overrides[require_staff] = _staff_user
    res = client.get("/ops/profiles?ids=")
    # empty string -> no ids provided
    assert res.status_code == 400
    client.app.dependency_overrides.pop(require_staff, None)
