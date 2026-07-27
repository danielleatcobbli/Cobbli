from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.auth import CurrentUser
from app.services.brevo import send_brevo_email
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/email", tags=["email"])

# Was 7, which is actually the "Account locked" template — a customer
# updating their password was getting told their account had been locked.
# 8 is the real "Password updated" template. See requirements doc Section 15.
BREVO_TEMPLATE_ID = 8


@router.post("/password-updated")
async def send_password_updated(user: CurrentUser) -> dict:
    if not user.email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid user")

    first_name = ""
    try:
        admin = get_supabase_admin()
        resp = (
            admin.table("profiles")
            .select("first_name")
            .eq("user_id", user.id)
            .maybe_single()
            .execute()
        )
        data = getattr(resp, "data", None)
        if data and data.get("first_name"):
            first_name = data["first_name"]
    except Exception:
        first_name = ""

    to_entry: dict[str, str] = {"email": user.email}
    if first_name:
        to_entry["name"] = first_name

    try:
        result = await send_brevo_email(
            template_id=BREVO_TEMPLATE_ID,
            to=[to_entry],
            params={"first_name": first_name},
            tags=["password-updated"],
        )
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": str(e)},
        )

    return {"ok": True, "brevo": result}
