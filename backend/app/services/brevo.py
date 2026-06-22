from __future__ import annotations

import httpx

from app.settings import get_settings

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
SENDER = {"name": "Danielle from Cobbli", "email": "noreply@cobbli.com"}
REPLY_TO = {"email": "support@cobbli.com"}


class BrevoError(RuntimeError):
    pass


async def send_brevo_email(
    *,
    to: list[dict[str, str]],
    template_id: int | None = None,
    subject: str | None = None,
    html_content: str | None = None,
    text_content: str | None = None,
    params: dict | None = None,
    tags: list[str] | None = None,
) -> dict:
    s = get_settings()
    if not s.brevo_api_key:
        raise BrevoError("BREVO_API_KEY not configured")

    payload: dict = {"sender": SENDER, "replyTo": REPLY_TO, "to": to}
    if tags:
        payload["tags"] = tags
    if template_id is not None:
        payload["templateId"] = template_id
        payload["params"] = params or {}
    if subject is not None:
        payload["subject"] = subject
    if html_content is not None:
        payload["htmlContent"] = html_content
    if text_content is not None:
        payload["textContent"] = text_content

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(
            BREVO_API_URL,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "api-key": s.brevo_api_key,
                "accept": "application/json",
            },
        )
    if res.status_code >= 400:
        raise BrevoError(f"Brevo send failed ({res.status_code}): {res.text}")
    return res.json()
