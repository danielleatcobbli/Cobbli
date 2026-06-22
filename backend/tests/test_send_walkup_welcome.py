from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _make_supabase_mock(
    *,
    auth_user=None,
    auth_error=None,
    profile_data=None,
    link_action_url="https://example.com/reset?token=abc",
    link_error=None,
):
    sb = MagicMock()

    get_user_resp = SimpleNamespace(user=auth_user)
    if auth_error is not None:
        sb.auth.admin.get_user_by_id.side_effect = auth_error
    else:
        sb.auth.admin.get_user_by_id.return_value = get_user_resp

    link_resp = SimpleNamespace(
        properties=SimpleNamespace(action_link=link_action_url)
    )
    if link_error is not None:
        sb.auth.admin.generate_link.side_effect = link_error
    else:
        sb.auth.admin.generate_link.return_value = link_resp

    profile_chain = MagicMock()
    profile_chain.select.return_value = profile_chain
    profile_chain.eq.return_value = profile_chain
    profile_chain.maybe_single.return_value = SimpleNamespace(data=profile_data)
    sb.from_.return_value = profile_chain
    sb.table.return_value = profile_chain

    return sb


def test_walkup_welcome_happy_path(client) -> None:
    auth_user = SimpleNamespace(
        id="user-1",
        email="walkup@example.com",
        user_metadata={"created_by": "admin", "first_name": "Meta"},
    )
    sb = _make_supabase_mock(
        auth_user=auth_user,
        profile_data={"first_name": "Sam"},
        link_action_url="https://cobbli.com/reset?token=xyz",
    )

    brevo_mock = AsyncMock(return_value={"messageId": "msg-1"})

    with (
        patch("app.routes.send_walkup_welcome.get_supabase_admin", return_value=sb),
        patch("app.routes.send_walkup_welcome.send_brevo_email", brevo_mock),
    ):
        res = client.post(
            "/email/walkup-welcome",
            json={
                "user_id": "user-1",
                "context": {
                    "order_number": "ORD-123",
                    "pair_identifier": "PAIR-A",
                    "service_1": "Resole",
                    "service_2": "Polish",
                    "collection_date_window": "Mon-Wed",
                    "station_name": "Station 1",
                    "station_address": "123 Main",
                },
            },
        )

    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["brevo"] == {"messageId": "msg-1"}

    brevo_mock.assert_awaited_once()
    kwargs = brevo_mock.await_args.kwargs
    assert kwargs["template_id"] == 6
    assert kwargs["to"] == [{"email": "walkup@example.com", "name": "Sam"}]
    assert kwargs["tags"] == ["walkup-welcome"]
    params = kwargs["params"]
    assert params["first_name"] == "Sam"
    assert params["order_number"] == "ORD-123"
    assert params["pair_identifier"] == "PAIR-A"
    assert params["service_1"] == "Resole"
    assert params["service_2"] == "Polish"
    assert params["collection_date_window"] == "Mon-Wed"
    assert params["station_name"] == "Station 1"
    assert params["station_address"] == "123 Main"
    assert params["password_setup_link"] == "https://cobbli.com/reset?token=xyz"


def test_walkup_welcome_extracts_user_id_from_record(client) -> None:
    auth_user = SimpleNamespace(
        id="user-2",
        email="other@example.com",
        user_metadata={"created_by": "admin"},
    )
    sb = _make_supabase_mock(auth_user=auth_user, profile_data=None)
    brevo_mock = AsyncMock(return_value={"messageId": "msg-2"})

    with (
        patch("app.routes.send_walkup_welcome.get_supabase_admin", return_value=sb),
        patch("app.routes.send_walkup_welcome.send_brevo_email", brevo_mock),
    ):
        res = client.post(
            "/email/walkup-welcome",
            json={"record": {"id": "user-2"}},
        )

    assert res.status_code == 200
    sb.auth.admin.get_user_by_id.assert_called_once_with("user-2")


def test_walkup_welcome_falls_back_to_metadata_first_name(client) -> None:
    auth_user = SimpleNamespace(
        id="user-3",
        email="meta@example.com",
        user_metadata={"created_by": "admin", "first_name": "Alex"},
    )
    sb = _make_supabase_mock(auth_user=auth_user, profile_data=None)
    brevo_mock = AsyncMock(return_value={"messageId": "msg-3"})

    with (
        patch("app.routes.send_walkup_welcome.get_supabase_admin", return_value=sb),
        patch("app.routes.send_walkup_welcome.send_brevo_email", brevo_mock),
    ):
        res = client.post("/email/walkup-welcome", json={"user_id": "user-3"})

    assert res.status_code == 200
    kwargs = brevo_mock.await_args.kwargs
    assert kwargs["params"]["first_name"] == "Alex"
    assert kwargs["to"][0]["name"] == "Alex"


def test_walkup_welcome_skips_non_admin_user(client) -> None:
    auth_user = SimpleNamespace(
        id="user-4",
        email="self@example.com",
        user_metadata={"created_by": "self"},
    )
    sb = _make_supabase_mock(auth_user=auth_user)
    brevo_mock = AsyncMock()

    with (
        patch("app.routes.send_walkup_welcome.get_supabase_admin", return_value=sb),
        patch("app.routes.send_walkup_welcome.send_brevo_email", brevo_mock),
    ):
        res = client.post("/email/walkup-welcome", json={"user_id": "user-4"})

    assert res.status_code == 200
    assert res.json() == {"skipped": "not walk-up admin user"}
    brevo_mock.assert_not_awaited()
    sb.auth.admin.generate_link.assert_not_called()


def test_walkup_welcome_missing_user_id_returns_error(client) -> None:
    res = client.post("/email/walkup-welcome", json={})
    assert res.status_code == 400


def test_walkup_welcome_user_not_found(client) -> None:
    sb = _make_supabase_mock(auth_user=None)
    with patch("app.routes.send_walkup_welcome.get_supabase_admin", return_value=sb):
        res = client.post("/email/walkup-welcome", json={"user_id": "ghost"})
    assert res.status_code == 500


def test_walkup_welcome_link_generation_fails(client) -> None:
    auth_user = SimpleNamespace(
        id="user-5",
        email="x@example.com",
        user_metadata={"created_by": "admin"},
    )
    sb = _make_supabase_mock(
        auth_user=auth_user,
        profile_data={"first_name": "Lee"},
        link_error=RuntimeError("link gen failed"),
    )
    brevo_mock = AsyncMock()

    with (
        patch("app.routes.send_walkup_welcome.get_supabase_admin", return_value=sb),
        patch("app.routes.send_walkup_welcome.send_brevo_email", brevo_mock),
    ):
        res = client.post("/email/walkup-welcome", json={"user_id": "user-5"})

    assert res.status_code == 500
    brevo_mock.assert_not_awaited()


def test_walkup_welcome_brevo_failure_returns_500(client) -> None:
    auth_user = SimpleNamespace(
        id="user-6",
        email="boom@example.com",
        user_metadata={"created_by": "admin"},
    )
    sb = _make_supabase_mock(
        auth_user=auth_user, profile_data={"first_name": "Boom"}
    )
    brevo_mock = AsyncMock(side_effect=RuntimeError("brevo down"))

    with (
        patch("app.routes.send_walkup_welcome.get_supabase_admin", return_value=sb),
        patch("app.routes.send_walkup_welcome.send_brevo_email", brevo_mock),
    ):
        res = client.post("/email/walkup-welcome", json={"user_id": "user-6"})

    assert res.status_code == 500


def test_walkup_welcome_uses_site_url_for_redirect(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SITE_URL", "https://staging.cobbli.com")
    from app.settings import get_settings
    get_settings.cache_clear()

    auth_user = SimpleNamespace(
        id="user-7",
        email="redir@example.com",
        user_metadata={"created_by": "admin"},
    )
    sb = _make_supabase_mock(auth_user=auth_user, profile_data={"first_name": "Q"})
    brevo_mock = AsyncMock(return_value={"messageId": "ok"})

    with (
        patch("app.routes.send_walkup_welcome.get_supabase_admin", return_value=sb),
        patch("app.routes.send_walkup_welcome.send_brevo_email", brevo_mock),
    ):
        res = client.post("/email/walkup-welcome", json={"user_id": "user-7"})

    assert res.status_code == 200
    call = sb.auth.admin.generate_link.call_args
    params = call.args[0] if call.args else call.kwargs.get("params")
    assert params["type"] == "recovery"
    assert params["email"] == "redir@example.com"
    assert params["options"]["redirect_to"] == "https://staging.cobbli.com/reset-password"
