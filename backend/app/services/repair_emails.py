"""Approved lifecycle template mapping. Inputs come from server-owned records."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from html import escape
from urllib.parse import quote, urlsplit
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
TEMPLATES = dict(
    zip(
        (
            "request_received",
            "more_information",
            "recommendations_ready",
            "pickup_confirmed",
            "pickup_reminder",
            "bag_collected",
            "return_ready",
            "return_confirmed",
            "return_reminder",
            "waitlisted",
            "capacity_available",
            "request_declined",
            "request_closed",
            "repair_canceled",
        ),
        range(25, 39),
        strict=True,
    )
)
REQUEST_STATES = {
    "more_information": {"needs_more_info"},
    "recommendations_ready": {"quote_ready"},
    "capacity_available": {"quote_ready"},
    "waitlisted": {"waitlisted"},
    "request_declined": {"declined", "service_unavailable"},
    "request_closed": {"closed"},
}
PICKUP_STATES = {"placed", "confirmed", "pickup-scheduled"}
RETURN_STATES = {"ready-for-return", "return-scheduled"}


class MissingEmailData(ValueError):
    """Operator action required; never send partially populated templates."""


def required(row: dict, field: str) -> str:
    value = row.get(field)
    if not isinstance(value, str) or not value.strip():
        raise MissingEmailData(f"Missing {field}")
    return value.strip()


def appointment_version(row: dict, kind: str) -> str:
    return "|".join(
        str(row.get(f"{kind}_{f}") or "") for f in ("calendly_event_uri", "date", "time_label")
    )


def reminder_due(row: dict, kind: str, now: datetime) -> bool:
    if not row.get(f"{kind}_date") or not row.get(f"{kind}_calendly_event_uri"):
        return False
    local = now.astimezone(NY)
    return local.hour >= 9 and date.fromisoformat(
        row[f"{kind}_date"][:10]
    ) == local.date() + timedelta(days=1)


def render_email(
    event: dict,
    row: dict,
    profile: dict,
    bags: list[dict],
    context: dict,
    site_url: str,
    now: datetime,
) -> dict | None:
    kind = event["kind"]
    if kind not in TEMPLATES:
        raise MissingEmailData("Unknown email kind")
    state = row.get("status")
    if kind in REQUEST_STATES and state not in REQUEST_STATES[kind]:
        return None
    if kind == "request_received" and state in {
        "booked",
        "closed",
        "declined",
        "service_unavailable",
    }:
        return None
    if kind.startswith("pickup_") and state not in PICKUP_STATES:
        return None
    if kind == "bag_collected" and state not in {"picked-up", "at-the-workshop", "in-repair"}:
        return None
    if kind.startswith("return_") and state not in RETURN_STATES:
        return None
    if kind == "repair_canceled" and state not in {"canceled", "cancelled"}:
        return None
    appointment = "pickup" if kind.startswith("pickup_") else "return"
    scheduled = kind in {
        "pickup_confirmed",
        "pickup_reminder",
        "return_confirmed",
        "return_reminder",
    }
    if scheduled:
        if event.get("appointment_version") != appointment_version(row, appointment):
            return None
        if kind.endswith("reminder") and not reminder_due(row, appointment, now):
            return None
    parsed = urlsplit(site_url)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
        or parsed.username
    ):
        raise MissingEmailData("SITE_URL must be an HTTPS origin")
    base = site_url.rstrip("/")
    is_request = event["entity_type"] == "assessment"
    email = (
        (row.get("guest_email") or profile.get("email")) if is_request else row.get("contact_email")
    )
    if not isinstance(email, str) or "@" not in email or any(c in email for c in "\r\n"):
        raise MissingEmailData("Missing recipient email")
    if not bags:
        raise MissingEmailData("Missing bag records")
    params = {"first_name": profile.get("first_name") or "", "bag_count": len(bags)}
    if is_request:
        link = f"{base}/proposal/t/{quote(required(row, 'proposal_token'), safe='')}"
        params.update(
            request_reference=row["id"],
            request_url=link,
            response_url=link,
            recommendations_url=link,
        )
    else:
        if row.get("repair_access_token"):
            link = f"{base}/proposal/t/{quote(row['repair_access_token'], safe='')}"
        elif row.get("user_id"):
            link = f"{base}/repair/order/{quote(row['id'], safe='')}"
        else:
            raise MissingEmailData("Guest repair has no access token")
        params.update(
            repair_reference=row.get("order_number") or row["id"],
            repair_url=link,
            pickup_details_url=link,
            return_details_url=link,
            schedule_return_url=link,
        )
    if scheduled:
        d = date.fromisoformat(required(row, f"{appointment}_date")[:10])
        address = row.get("delivery_address") or {}
        if not isinstance(address, dict) or not all(
            address.get(k) for k in ("street", "city", "state", "zip")
        ):
            raise MissingEmailData("Incomplete appointment address")
        window = required(row, f"{appointment}_time_label")
        zone = datetime(d.year, d.month, d.day, 12, tzinfo=NY).tzname()
        params[f"{appointment}_date"] = d.strftime("%A, %B %d, %Y")
        params[f"{appointment}_window"] = f"{window} {zone}"
        params[f"{appointment}_address"] = ", ".join(
            str(address[k]) for k in ("street", "street2", "city", "state", "zip") if address.get(k)
        )
    if kind == "more_information" and context.get("response_flow_ready") is not True:
        raise MissingEmailData("Customer response flow is not enabled")
    fields = {
        "more_information": ["staff_question"],
        "request_declined": ["staff_explanation"],
        "repair_canceled": ["next_steps", "payment_status"],
    }.get(kind, [])
    for field in fields:
        params[field] = required(context, field)
    if kind in {"request_closed", "repair_canceled"}:
        for field in ("payment_status", "cancellation_reason"):
            if context.get(field):
                params[field] = context[field]
    params = {k: escape(v, quote=True) if isinstance(v, str) else v for k, v in params.items()}
    return {
        "to": [{"email": email}],
        "template_id": TEMPLATES[kind],
        "params": params,
        "tags": ["repair-lifecycle", kind],
    }
