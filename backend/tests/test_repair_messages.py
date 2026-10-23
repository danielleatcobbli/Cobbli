from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.auth import AuthUser, optional_user, require_staff
from app.routes import repair_messages as messages

REQUEST = str(uuid4())
QUESTION = str(uuid4())
USER = AuthUser(id="owner", email="owner@example.com", access_token="test")


@pytest.fixture
def db(monkeypatch):
    sb = MagicMock()
    q = MagicMock()
    for method in ("select", "eq", "maybe_single", "order", "limit"):
        getattr(q, method).return_value = q
    sb.table.return_value = q
    monkeypatch.setattr(messages, "get_supabase_admin", lambda: sb)
    return sb, q


def test_request_token_cannot_open_another_customers_request(db):
    sb, q = db
    q.execute.return_value = SimpleNamespace(
        data={"id": REQUEST, "user_id": "other", "proposal_token": "correct"}
    )
    with pytest.raises(HTTPException) as exc:
        messages.request_access(sb, REQUEST, USER, "wrong")
    assert exc.value.status_code == 403


@pytest.mark.parametrize("user,token", [(USER, None), (None, "correct")])
def test_owner_or_matching_email_token_has_access(db, user, token):
    sb, q = db
    q.execute.return_value = SimpleNamespace(
        data={"id": REQUEST, "user_id": "owner", "proposal_token": "correct"}
    )
    assert messages.request_access(sb, REQUEST, user, token)["id"] == REQUEST


def test_guest_question_endpoint_requires_token(unauth_client, db):
    _, q = db
    q.execute.return_value = SimpleNamespace(
        data={"id": REQUEST, "user_id": "owner", "proposal_token": "correct"}
    )
    assert unauth_client.get(f"/customer/requests/{REQUEST}/question").status_code == 403


def test_customer_cannot_call_staff_message_endpoint(unauth_client):
    assert (
        unauth_client.post(
            f"/ops/assessments/{REQUEST}/message", json={"action": "decline", "message": "No"}
        ).status_code
        == 401
    )


def test_staff_question_uses_atomic_workflow(unauth_client, db):
    sb, _ = db
    unauth_client.app.dependency_overrides[require_staff] = lambda: USER
    sb.rpc.return_value.execute.return_value = SimpleNamespace(data=QUESTION)
    response = unauth_client.post(
        f"/ops/assessments/{REQUEST}/message",
        json={"action": "question", "message": " Show the handle "},
    )
    assert response.status_code == 200
    sb.rpc.assert_called_once_with(
        "repair_request_message",
        {"request_id": REQUEST, "action": "question", "message": "Show the handle"},
    )


def test_repeated_customer_response_returns_saved_receipt_without_upload(unauth_client, db):
    sb, q = db
    unauth_client.app.dependency_overrides[optional_user] = lambda: None
    q.execute.side_effect = [
        SimpleNamespace(data={"id": REQUEST, "proposal_token": "correct", "status": "pending"}),
        SimpleNamespace(data={"id": QUESTION}),
        SimpleNamespace(data={"id": "saved-response"}),
    ]
    response = unauth_client.post(
        f"/customer/requests/{REQUEST}/responses",
        headers={"X-Repair-Token": "correct"},
        data={"question_id": QUESTION, "submission_id": str(uuid4()), "text": "retry"},
    )
    assert response.status_code == 200
    assert response.json() == {"saved": True, "response_id": "saved-response"}
    sb.storage.from_.assert_not_called()
    sb.rpc.assert_not_called()


def test_cancel_requires_explicit_calendar_confirmation(unauth_client, db):
    sb, _ = db
    unauth_client.app.dependency_overrides[require_staff] = lambda: USER
    response = unauth_client.post(
        f"/ops/repairs/{REQUEST}/cancel",
        json={"next_steps": "No collection", "payment_status": "No charge"},
    )
    assert response.status_code == 400
    sb.rpc.assert_not_called()


@pytest.mark.parametrize("content", [b"<script>alert(1)</script>", b"", b"GIF89a"])
def test_upload_checks_content_not_filename(content):
    with pytest.raises(HTTPException):
        messages.image_type(content)
