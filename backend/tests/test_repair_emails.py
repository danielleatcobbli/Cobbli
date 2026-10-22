from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.repair_emails import (
    TEMPLATES,
    MissingEmailData,
    appointment_version,
    reminder_due,
    render_email,
)

NOW = datetime(2026, 10, 13, 14, tzinfo=UTC)


def fixtures(kind="request_received"):
    request = kind in {
        "request_received",
        "more_information",
        "recommendations_ready",
        "waitlisted",
        "capacity_available",
        "request_declined",
        "request_closed",
    }
    states = {
        "more_information": "needs_more_info",
        "recommendations_ready": "quote_ready",
        "waitlisted": "waitlisted",
        "capacity_available": "quote_ready",
        "request_declined": "declined",
        "request_closed": "closed",
        "bag_collected": "picked-up",
        "repair_canceled": "cancelled",
    }
    state = states.get(kind, "ready-for-return" if kind.startswith("return_") else "placed")
    if kind == "request_received":
        state = "pending"
    row = dict(
        id="repair-123",
        user_id="user-1",
        status=state,
        guest_email="guest@example.com",
        contact_email="customer@example.com",
        proposal_token="token-123",
        order_number="R-123",
        pickup_date="2026-10-14",
        pickup_time_label="10:00 AM–12:00 PM",
        pickup_calendly_event_uri="pickup-uid",
        return_date="2026-10-14",
        return_time_label="2:00 PM–4:00 PM",
        return_calendly_event_uri="return-uid",
        delivery_address=dict(
            street="1 Test St", street2="Apt 2", city="New York", state="NY", zip="10001"
        ),
    )
    appointment = "pickup" if kind.startswith("pickup") else "return"
    event = dict(
        kind=kind,
        entity_type="assessment" if request else "order",
        appointment_version=appointment_version(row, appointment),
    )
    ctx = dict(
        response_flow_ready=True,
        pickup_version=appointment_version(row, "pickup"),
        return_version=appointment_version(row, "return"),
        staff_question="Please send a handle photo.",
        staff_explanation="Material cannot be repaired.",
        next_steps="Your pickup is canceled.",
        payment_status="No charge has been made.",
        pickup_reschedule_url="https://cal.com/reschedule/pickup-uid",
        return_reschedule_url="https://cal.com/reschedule/return-uid",
    )
    return (
        event,
        row,
        dict(first_name="Alex", email="owner@example.com"),
        [{"id": "a"}, {"id": "b"}],
        ctx,
    )


def render(kind="request_received", **changes):
    event, row, profile, bags, ctx = fixtures(kind)
    row.update(changes)
    return render_email(event, row, profile, bags, ctx, "https://cobbli.com", NOW)


@pytest.mark.parametrize("kind,template_id", TEMPLATES.items())
def test_all_approved_templates(kind, template_id):
    result = render(kind)
    assert result["template_id"] == template_id
    assert result["params"]["bag_count"] == 2
    assert result["params"]["first_name"] == "Alex"
    assert result["tags"] == ["repair-lifecycle", kind]


def test_guest_request_uses_public_token_and_guest_email():
    result = render(user_id=None)
    assert result["to"] == [{"email": "guest@example.com"}]
    assert result["params"]["request_url"] == "https://cobbli.com/proposal/t/token-123"


def test_address_includes_unit_and_correct_timezone():
    result = render("pickup_confirmed")
    assert "Apt 2" in result["params"]["pickup_address"]
    assert result["params"]["pickup_window"].endswith(" EDT")
    event, row, profile, bags, ctx = fixtures("pickup_confirmed")
    row["pickup_date"] = "2026-12-01"
    event["appointment_version"] = appointment_version(row, "pickup")
    ctx["pickup_version"] = event["appointment_version"]
    assert render_email(event, row, profile, bags, ctx, "https://cobbli.com", NOW)["params"][
        "pickup_window"
    ].endswith(" EST")


@pytest.mark.parametrize(
    "kind",
    ["pickup_reminder", "return_reminder", "pickup_confirmed", "return_confirmed", "return_ready"],
)
def test_canceled_repair_suppresses_obsolete_email(kind):
    assert render(kind, status="cancelled") is None


def test_old_appointment_version_is_suppressed():
    assert render("pickup_reminder", pickup_calendly_event_uri="replacement") is None


def test_no_reminder_before_9am_or_on_wrong_day():
    _, row, *_ = fixtures("pickup_reminder")
    assert not reminder_due(row, "pickup", datetime(2026, 10, 13, 12, tzinfo=UTC))
    assert reminder_due(row, "pickup", NOW)
    assert not reminder_due(row, "pickup", datetime(2026, 10, 14, 14, tzinfo=UTC))


@pytest.mark.parametrize(
    "kind,field",
    [
        ("more_information", "staff_question"),
        ("request_declined", "staff_explanation"),
        ("repair_canceled", "next_steps"),
        ("repair_canceled", "payment_status"),
    ],
)
def test_missing_required_context_blocks_sending(kind, field):
    event, row, profile, bags, ctx = fixtures(kind)
    del ctx[field]
    with pytest.raises(MissingEmailData):
        render_email(event, row, profile, bags, ctx, "https://cobbli.com", NOW)


def test_html_in_customer_data_is_escaped():
    result = render(
        "pickup_confirmed",
        delivery_address=dict(
            street="<script>alert(1)</script>", city="NY", state="NY", zip="10001"
        ),
    )
    assert "<script>" not in result["params"]["pickup_address"]
    assert "&lt;script&gt;" in result["params"]["pickup_address"]


def test_guest_order_without_management_link_is_blocked():
    with pytest.raises(MissingEmailData, match="Guest"):
        render("return_ready", user_id=None)


def test_worker_requires_secret_even_when_disabled(unauth_client):
    assert unauth_client.post("/internal/repair-emails/run").status_code == 401


def test_worker_disabled_does_not_touch_database(unauth_client, monkeypatch):
    monkeypatch.setenv("REPAIR_EMAIL_WORKER_SECRET", "worker-test")
    from app.settings import get_settings

    get_settings.cache_clear()
    response = unauth_client.post(
        "/internal/repair-emails/run", headers={"Authorization": "Bearer worker-test"}
    )
    assert response.json() == {"enabled": False, "processed": 0}


@pytest.mark.parametrize("outcome", ["sent", "uncertain", "blocked", "suppressed", "unapproved"])
def test_worker_delivery_outcomes(unauth_client, monkeypatch, outcome):
    from app.routes import repair_email_worker as worker
    from app.settings import get_settings

    monkeypatch.setenv("REPAIR_EMAIL_WORKER_SECRET", "worker-test")
    monkeypatch.setenv("REPAIR_EMAILS_ENABLED", "true")
    monkeypatch.setenv(
        "REPAIR_EMAIL_TEST_RECIPIENTS",
        ""
        if outcome == "unapproved"
        else "guest@example.com,customer@example.com,test@example.com",
    )
    get_settings.cache_clear()
    event, row, profile, bags, ctx = fixtures()
    event.update(id="event-1", entity_id=row["id"])
    row["pairs"] = bags
    if outcome == "blocked":
        row["proposal_token"] = None
    elif outcome == "suppressed":
        row["status"] = "closed"
    sb = MagicMock()

    def rpc(name, *args):
        return SimpleNamespace(
            execute=lambda: SimpleNamespace(data=[event] if name == "claim_repair_emails" else None)
        )

    sb.rpc.side_effect = rpc

    def table(name):
        q = MagicMock()
        q.select.return_value = q
        q.eq.return_value = q
        q.maybe_single.return_value = q
        q.execute.return_value = SimpleNamespace(
            data={
                "assessments": row,
                "profiles": profile,
                "repair_email_context": {"data": ctx},
            }.get(name)
        )
        return q

    sb.table.side_effect = table
    monkeypatch.setattr(worker, "get_supabase_admin", lambda: sb)
    sender = AsyncMock(
        return_value={"messageId": "test-message"},
        side_effect=TimeoutError() if outcome == "uncertain" else None,
    )
    monkeypatch.setattr(worker, "send_brevo_email", sender)
    finish = MagicMock()
    monkeypatch.setattr(worker, "finish", finish)
    response = unauth_client.post(
        "/internal/repair-emails/run", headers={"Authorization": "Bearer worker-test"}
    )
    assert response.status_code == 200
    expected = "blocked" if outcome == "unapproved" else outcome
    assert response.json()[expected] == 1
    assert sender.await_count == (1 if outcome in {"sent", "uncertain"} else 0)
    assert finish.call_args.args[2] == expected
    if outcome == "unapproved":
        assert finish.call_args.kwargs["error_code"] == "test_recipient_not_allowed"
    if outcome == "sent":
        assert finish.call_args.kwargs["message_id"] == "test-message"


def test_booking_email_does_not_require_rescheduling():
    event, row, profile, bags, ctx = fixtures("pickup_confirmed")
    result = render_email(event, row, profile, bags, {}, "https://cobbli.com", NOW)
    assert "pickup_reschedule_url" not in result["params"]


def test_question_email_requires_working_response_flow():
    event, row, profile, bags, ctx = fixtures("more_information")
    del ctx["response_flow_ready"]
    with pytest.raises(MissingEmailData, match="response flow"):
        render_email(event, row, profile, bags, ctx, "https://cobbli.com", NOW)
