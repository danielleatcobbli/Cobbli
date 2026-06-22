from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.brevo import send_brevo_email
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/email", tags=["email"])


class AccountLockedPayload(BaseModel):
    user_id: str | None = None
    record: dict[str, Any] | None = None


@router.post("/account-locked")
async def send_account_locked(payload: AccountLockedPayload) -> JSONResponse:
    try:
        user_id = payload.user_id or (payload.record or {}).get("user_id")
        if not user_id:
            raise ValueError("Missing user_id")

        supabase = get_supabase_admin()
        result = (
            supabase.table("profiles")
            .select("first_name, email")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        profile = getattr(result, "data", None)
        if not profile or not profile.get("email"):
            raise ValueError("Profile/email not found")

        first_name = profile.get("first_name")
        recipient: dict[str, str] = {"email": profile["email"]}
        if first_name:
            recipient["name"] = first_name

        brevo = await send_brevo_email(
            template_id=7,
            to=[recipient],
            params={"first_name": first_name or ""},
            tags=["account-locked"],
        )
        return JSONResponse({"ok": True, "brevo": brevo})
    except Exception as err:
        return JSONResponse({"error": str(err)}, status_code=500)
