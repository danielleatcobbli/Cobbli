from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.brevo import send_brevo_email
from app.settings import get_settings
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/email", tags=["email"])


class WalkupRecord(BaseModel):
    user_id: str | None = None
    id: str | None = None


class WalkupWelcomeRequest(BaseModel):
    user_id: str | None = None
    record: WalkupRecord | None = None
    context: dict[str, Any] = Field(default_factory=dict)


def _resolve_user_id(req: WalkupWelcomeRequest) -> str | None:
    if req.user_id:
        return req.user_id
    if req.record:
        return req.record.user_id or req.record.id
    return None


def _meta(user: Any) -> dict[str, Any]:
    raw = getattr(user, "user_metadata", None) or {}
    return raw if isinstance(raw, dict) else {}


@router.post("/walkup-welcome")
async def send_walkup_welcome(req: WalkupWelcomeRequest) -> dict[str, Any]:
    user_id = _resolve_user_id(req)
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user_id")

    try:
        supabase = get_supabase_admin()
        auth_resp = supabase.auth.admin.get_user_by_id(user_id)
        user = getattr(auth_resp, "user", None)
        if user is None:
            raise RuntimeError("User not found")

        meta = _meta(user)
        if meta.get("created_by") != "admin":
            return {"skipped": "not walk-up admin user"}

        email = getattr(user, "email", None)
        if not email:
            raise RuntimeError("User has no email")

        profile_resp = (
            supabase.from_("profiles")
            .select("first_name")
            .eq("user_id", user_id)
            .maybe_single()
        )
        profile_data = getattr(profile_resp, "data", None) or {}

        settings = get_settings()
        link_resp = supabase.auth.admin.generate_link(
            {
                "type": "recovery",
                "email": email,
                "options": {"redirect_to": f"{settings.site_url}/reset-password"},
            }
        )
        properties = getattr(link_resp, "properties", None)
        password_setup_link = (
            getattr(properties, "action_link", "") if properties else ""
        ) or ""

        ctx = req.context or {}
        first_name = profile_data.get("first_name") or meta.get("first_name") or ""

        params = {
            "first_name": first_name,
            "order_number": ctx.get("order_number", ""),
            "pair_identifier": ctx.get("pair_identifier", ""),
            "service_1": ctx.get("service_1", ""),
            "service_2": ctx.get("service_2", ""),
            "collection_date_window": ctx.get("collection_date_window", ""),
            "station_name": ctx.get("station_name", ""),
            "station_address": ctx.get("station_address", ""),
            "password_setup_link": password_setup_link,
        }

        result = await send_brevo_email(
            template_id=6,
            to=[{"email": email, "name": str(first_name)}],
            params=params,
            tags=["walkup-welcome"],
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"ok": True, "brevo": result}
