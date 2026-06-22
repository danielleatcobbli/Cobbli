from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.auth import AuthUser, require_user
from app.main import create_app


@pytest.fixture
def auth_user() -> AuthUser:
    return AuthUser(
        id="user-123",
        email="jane@example.com",
        access_token="jwt-token",
    )


@pytest.fixture
def app_with_auth(auth_user: AuthUser):
    app = create_app()
    app.dependency_overrides[require_user] = lambda: auth_user
    return app


@pytest.fixture
def authed_client(app_with_auth):
    from fastapi.testclient import TestClient

    return TestClient(app_with_auth)


def _admin_with_profile(first_name: str | None):
    admin = MagicMock()
    profile_data = {"first_name": first_name} if first_name is not None else None
    chain = admin.table.return_value
    chain = chain.select.return_value
    chain = chain.eq.return_value
    chain.maybe_single.return_value.execute.return_value = MagicMock(data=profile_data)
    return admin


def test_returns_ok_with_profile_first_name(
    monkeypatch: pytest.MonkeyPatch, authed_client
) -> None:
    admin = _admin_with_profile("Jane")
    monkeypatch.setattr(
        "app.routes.send_password_updated.get_supabase_admin",
        lambda: admin,
    )
    brevo_mock = AsyncMock(return_value={"messageId": "abc-123"})
    monkeypatch.setattr(
        "app.routes.send_password_updated.send_brevo_email", brevo_mock
    )

    res = authed_client.post("/email/password-updated")

    assert res.status_code == 200
    body = res.json()
    assert body == {"ok": True, "brevo": {"messageId": "abc-123"}}

    brevo_mock.assert_awaited_once()
    kwargs = brevo_mock.await_args.kwargs
    assert kwargs["template_id"] == 7
    assert kwargs["to"] == [{"email": "jane@example.com", "name": "Jane"}]
    assert kwargs["params"] == {"first_name": "Jane"}
    assert kwargs["tags"] == ["password-updated"]


def test_falls_back_to_empty_first_name_when_profile_missing(
    monkeypatch: pytest.MonkeyPatch, authed_client
) -> None:
    admin = _admin_with_profile(None)
    monkeypatch.setattr(
        "app.routes.send_password_updated.get_supabase_admin",
        lambda: admin,
    )
    brevo_mock = AsyncMock(return_value={"messageId": "xyz"})
    monkeypatch.setattr(
        "app.routes.send_password_updated.send_brevo_email", brevo_mock
    )

    res = authed_client.post("/email/password-updated")

    assert res.status_code == 200
    kwargs = brevo_mock.await_args.kwargs
    assert kwargs["to"] == [{"email": "jane@example.com"}]
    assert kwargs["params"] == {"first_name": ""}


def test_requires_authorization_header(unauth_client) -> None:
    res = unauth_client.post("/email/password-updated")
    assert res.status_code == 401


def test_returns_500_when_brevo_fails(
    monkeypatch: pytest.MonkeyPatch, authed_client
) -> None:
    admin = _admin_with_profile("Jane")
    monkeypatch.setattr(
        "app.routes.send_password_updated.get_supabase_admin",
        lambda: admin,
    )
    monkeypatch.setattr(
        "app.routes.send_password_updated.send_brevo_email",
        AsyncMock(side_effect=RuntimeError("Brevo down")),
    )

    res = authed_client.post("/email/password-updated")

    assert res.status_code == 500
    assert "error" in res.json()


def test_handles_supabase_query_failure_gracefully(
    monkeypatch: pytest.MonkeyPatch, authed_client
) -> None:
    admin = MagicMock()
    admin.table.side_effect = RuntimeError("db connection lost")
    monkeypatch.setattr(
        "app.routes.send_password_updated.get_supabase_admin",
        lambda: admin,
    )
    brevo_mock = AsyncMock(return_value={"messageId": "ok"})
    monkeypatch.setattr(
        "app.routes.send_password_updated.send_brevo_email", brevo_mock
    )

    res = authed_client.post("/email/password-updated")

    assert res.status_code == 200
    kwargs = brevo_mock.await_args.kwargs
    assert kwargs["params"] == {"first_name": ""}
    assert kwargs["to"] == [{"email": "jane@example.com"}]
