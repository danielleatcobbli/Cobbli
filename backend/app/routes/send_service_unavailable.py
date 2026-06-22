from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.brevo import send_brevo_email
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/email", tags=["email"])


class _Record(BaseModel):
    id: str | None = None


class ServiceUnavailableRequest(BaseModel):
    assessment_id: str | None = None
    record: _Record | None = None


def _render_html(first_name: str) -> str:
    greeting = f"Hi {first_name}," if first_name else "Hi there,"
    return (
        '<div style="font-family: Arial, sans-serif; color: #3d1700; '
        'max-width: 560px; margin: 0 auto; padding: 24px;">'
        '<h2 style="color:#3d1700;">Thanks for reaching out to Cobbli!</h2>'
        f"<p>{greeting}</p>"
        "<p>Unfortunately, we don't currently offer the service your item "
        "needs. We're always expanding our service lists, so check back soon. "
        "No charge has been made.</p>"
        '<p style="margin-top:24px;">If you have any questions, please '
        'contact us at <a href="mailto:support@cobbli.com" '
        'style="color:#3d1700;text-decoration:underline;">support@cobbli.com'
        "</a>.</p>"
        "<p>— The Cobbli team</p>"
        "</div>"
    )


def _err(message: str) -> JSONResponse:
    return JSONResponse(status_code=500, content={"error": message})


@router.post("/service-unavailable")
async def send_service_unavailable(payload: ServiceUnavailableRequest) -> Any:
    try:
        assessment_id = payload.assessment_id or (
            payload.record.id if payload.record else None
        )
        if not assessment_id:
            raise ValueError("Missing assessment_id")

        supabase = get_supabase_admin()

        a_resp = (
            supabase.table("assessments")
            .select("id, user_id")
            .eq("id", assessment_id)
            .maybe_single()
            .execute()
        )
        a_err = getattr(a_resp, "error", None)
        assessment = getattr(a_resp, "data", None)
        if a_err or not assessment:
            raise RuntimeError(str(a_err) if a_err else "Assessment not found")

        user_id = assessment["user_id"]

        try:
            auth_resp = supabase.auth.admin.get_user_by_id(user_id)
        except Exception as e:
            raise RuntimeError(str(e)) from e
        auth_user = getattr(auth_resp, "user", None)
        email = getattr(auth_user, "email", None) if auth_user else None
        if not email:
            raise RuntimeError("User email not found")

        p_resp = (
            supabase.table("profiles")
            .select("first_name")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        profile = getattr(p_resp, "data", None) or {}
        first_name = profile.get("first_name") or ""

        result = await send_brevo_email(
            subject="About your Cobbli repair request",
            html_content=_render_html(first_name),
            to=[{"email": email, "name": first_name}],
            tags=["service-unavailable"],
        )

        return {"ok": True, "brevo": result}
    except Exception as e:
        return _err(str(e))
