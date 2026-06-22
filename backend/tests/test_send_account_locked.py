from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch


def _mock_supabase_with_profile(profile: dict | None):
    sb = MagicMock()
    chain = sb.table.return_value.select.return_value.eq.return_value.maybe_single.return_value
    chain.execute.return_value = MagicMock(data=profile)
    return sb


def test_send_account_locked_happy_path(client):
    profile = {"first_name": "Ada", "email": "ada@example.com"}
    sb = _mock_supabase_with_profile(profile)

    with patch(
        "app.routes.send_account_locked.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_account_locked.send_brevo_email",
        new=AsyncMock(return_value={"messageId": "msg-1"}),
    ) as brevo:
        resp = client.post(
            "/email/account-locked",
            json={"user_id": "u-1"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["brevo"] == {"messageId": "msg-1"}

    brevo.assert_awaited_once()
    kwargs = brevo.await_args.kwargs
    assert kwargs["template_id"] == 7
    assert kwargs["to"] == [{"email": "ada@example.com", "name": "Ada"}]
    assert kwargs["params"] == {"first_name": "Ada"}
    assert kwargs["tags"] == ["account-locked"]


def test_send_account_locked_accepts_record_user_id(client):
    profile = {"first_name": "Bea", "email": "bea@example.com"}
    sb = _mock_supabase_with_profile(profile)

    with patch(
        "app.routes.send_account_locked.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_account_locked.send_brevo_email",
        new=AsyncMock(return_value={"messageId": "msg-2"}),
    ) as brevo:
        resp = client.post(
            "/email/account-locked",
            json={"record": {"user_id": "u-2"}},
        )

    assert resp.status_code == 200
    brevo.assert_awaited_once()
    kwargs = brevo.await_args.kwargs
    assert kwargs["to"][0]["email"] == "bea@example.com"


def test_send_account_locked_missing_user_id(client):
    with patch("app.routes.send_account_locked.get_supabase_admin") as gsa, patch(
        "app.routes.send_account_locked.send_brevo_email", new=AsyncMock()
    ) as brevo:
        resp = client.post("/email/account-locked", json={})

    assert resp.status_code == 500
    assert "user_id" in resp.json()["error"].lower()
    gsa.assert_not_called()
    brevo.assert_not_awaited()


def test_send_account_locked_handles_no_first_name(client):
    profile = {"first_name": None, "email": "no-name@example.com"}
    sb = _mock_supabase_with_profile(profile)

    with patch(
        "app.routes.send_account_locked.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_account_locked.send_brevo_email",
        new=AsyncMock(return_value={"messageId": "msg-3"}),
    ) as brevo:
        resp = client.post(
            "/email/account-locked",
            json={"user_id": "u-3"},
        )

    assert resp.status_code == 200
    kwargs = brevo.await_args.kwargs
    assert kwargs["to"] == [{"email": "no-name@example.com"}]
    assert kwargs["params"] == {"first_name": ""}


def test_send_account_locked_profile_not_found(client):
    sb = _mock_supabase_with_profile(None)

    with patch(
        "app.routes.send_account_locked.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_account_locked.send_brevo_email", new=AsyncMock()
    ) as brevo:
        resp = client.post(
            "/email/account-locked",
            json={"user_id": "u-missing"},
        )

    assert resp.status_code == 500
    err = resp.json()["error"].lower()
    assert "email" in err or "profile" in err
    brevo.assert_not_awaited()


def test_send_account_locked_profile_without_email(client):
    sb = _mock_supabase_with_profile({"first_name": "NoEmail", "email": None})

    with patch(
        "app.routes.send_account_locked.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_account_locked.send_brevo_email", new=AsyncMock()
    ) as brevo:
        resp = client.post(
            "/email/account-locked",
            json={"user_id": "u-no-email"},
        )

    assert resp.status_code == 500
    brevo.assert_not_awaited()


def test_send_account_locked_brevo_failure(client):
    profile = {"first_name": "Cleo", "email": "cleo@example.com"}
    sb = _mock_supabase_with_profile(profile)

    with patch(
        "app.routes.send_account_locked.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_account_locked.send_brevo_email",
        new=AsyncMock(side_effect=RuntimeError("Brevo down")),
    ):
        resp = client.post(
            "/email/account-locked",
            json={"user_id": "u-4"},
        )

    assert resp.status_code == 500
    assert "Brevo down" in resp.json()["error"]
