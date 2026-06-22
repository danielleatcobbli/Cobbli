from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch


def _build_supabase_mock(
    *,
    assessment: dict | None = None,
    assessment_error: object | None = None,
    auth_user_email: str | None = "buyer@example.com",
    auth_user_error: object | None = None,
    profile: dict | None = None,
) -> MagicMock:
    if assessment is None and assessment_error is None:
        assessment = {"id": "assess-1", "user_id": "user-1"}
    if profile is None:
        profile = {"first_name": "Alex"}

    sb = MagicMock()

    assessments_resp = SimpleNamespace(data=assessment, error=assessment_error)
    profiles_resp = SimpleNamespace(data=profile, error=None)

    def table(name: str):
        builder = MagicMock()
        chain = builder.select.return_value.eq.return_value.maybe_single.return_value
        if name == "assessments":
            chain.execute.return_value = assessments_resp
        elif name == "profiles":
            chain.execute.return_value = profiles_resp
        return builder

    sb.table.side_effect = table

    auth_user = (
        SimpleNamespace(user=SimpleNamespace(email=auth_user_email))
        if auth_user_email is not None
        else SimpleNamespace(user=None)
    )
    sb.auth.admin.get_user_by_id.return_value = auth_user
    if auth_user_error is not None:
        sb.auth.admin.get_user_by_id.side_effect = auth_user_error

    return sb


def test_send_service_unavailable_happy_path(client) -> None:
    sb = _build_supabase_mock()
    brevo_mock = AsyncMock(return_value={"messageId": "abc-123"})

    with patch(
        "app.routes.send_service_unavailable.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_service_unavailable.send_brevo_email", brevo_mock
    ):
        res = client.post(
            "/email/service-unavailable", json={"assessment_id": "assess-1"}
        )

    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["brevo"] == {"messageId": "abc-123"}

    brevo_mock.assert_awaited_once()
    kwargs = brevo_mock.await_args.kwargs
    assert kwargs["subject"] == "About your Cobbli repair request"
    assert kwargs["to"] == [{"email": "buyer@example.com", "name": "Alex"}]
    assert "service-unavailable" in kwargs["tags"]
    assert "Hi Alex," in kwargs["html_content"]
    assert "don't currently offer the service" in kwargs["html_content"]


def test_send_service_unavailable_accepts_record_id(client) -> None:
    sb = _build_supabase_mock(profile={"first_name": ""})
    brevo_mock = AsyncMock(return_value={"messageId": "ok"})

    with patch(
        "app.routes.send_service_unavailable.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_service_unavailable.send_brevo_email", brevo_mock
    ):
        res = client.post(
            "/email/service-unavailable",
            json={"record": {"id": "assess-1"}},
        )

    assert res.status_code == 200
    kwargs = brevo_mock.await_args.kwargs
    assert "Hi there," in kwargs["html_content"]
    assert kwargs["to"] == [{"email": "buyer@example.com", "name": ""}]


def test_send_service_unavailable_missing_id(client) -> None:
    res = client.post("/email/service-unavailable", json={})
    assert res.status_code == 500
    assert "assessment_id" in res.json()["error"].lower()


def test_send_service_unavailable_assessment_not_found(client) -> None:
    sb = _build_supabase_mock(assessment=None, assessment_error=None)
    sb.table.side_effect = None
    builder = MagicMock()
    chain = builder.select.return_value.eq.return_value.maybe_single.return_value
    chain.execute.return_value = SimpleNamespace(data=None, error=None)
    sb.table.return_value = builder

    with patch(
        "app.routes.send_service_unavailable.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_service_unavailable.send_brevo_email", AsyncMock()
    ):
        res = client.post(
            "/email/service-unavailable", json={"assessment_id": "missing"}
        )

    assert res.status_code == 500
    assert "Assessment not found" in res.json()["error"]


def test_send_service_unavailable_user_email_missing(client) -> None:
    sb = _build_supabase_mock(auth_user_email=None)

    with patch(
        "app.routes.send_service_unavailable.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_service_unavailable.send_brevo_email", AsyncMock()
    ):
        res = client.post(
            "/email/service-unavailable", json={"assessment_id": "assess-1"}
        )

    assert res.status_code == 500
    assert "User email not found" in res.json()["error"]


def test_send_service_unavailable_brevo_error_returns_500(client) -> None:
    sb = _build_supabase_mock()
    brevo_mock = AsyncMock(side_effect=RuntimeError("Brevo down"))

    with patch(
        "app.routes.send_service_unavailable.get_supabase_admin", return_value=sb
    ), patch(
        "app.routes.send_service_unavailable.send_brevo_email", brevo_mock
    ):
        res = client.post(
            "/email/service-unavailable", json={"assessment_id": "assess-1"}
        )

    assert res.status_code == 500
    assert "Brevo down" in res.json()["error"]
