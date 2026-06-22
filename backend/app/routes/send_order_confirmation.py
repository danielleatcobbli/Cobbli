from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.services.brevo import send_brevo_email
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/email", tags=["email"])


def _fmt_cents(cents: int) -> str:
    return f"${(cents / 100):.2f}"


def _format_address(addr: dict[str, Any] | None) -> str:
    if not addr:
        return ""
    keys = ("street", "street2", "city", "state", "zip")
    parts = [addr.get(k) for k in keys]
    return ", ".join(p for p in parts if isinstance(p, str) and p)


def _extract_order(payload: dict[str, Any]) -> dict[str, Any]:
    return payload.get("record") or payload.get("order") or payload


def _result_data(resp: Any) -> Any:
    return getattr(resp, "data", None) if resp is not None else None


@router.post("/order-confirmation")
async def send_order_confirmation(request: Request) -> JSONResponse:
    try:
        payload = await request.json()
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

    try:
        order = _extract_order(payload or {})
        if not isinstance(order, dict) or not order.get("id"):
            raise ValueError("Missing order record")

        if order.get("delivery_method") != "door-to-door":
            return JSONResponse(content={"skipped": "not door-to-door"})

        admin = get_supabase_admin()

        profile_resp = (
            admin.from_("profiles")
            .select("first_name, email")
            .eq("user_id", order["user_id"])
            .maybe_single()
            .execute()
        )
        items_resp = (
            admin.from_("order_items")
            .select("pair_snapshot, service_snapshot, price_cents")
            .eq("order_id", order["id"])
            .execute()
        )

        profile = _result_data(profile_resp) or {}
        items = _result_data(items_resp) or []

        first_item = items[0] if items else {}
        pair_snap = first_item.get("pair_snapshot") or {}
        pair_parts = [pair_snap.get("brand"), pair_snap.get("shoe_type")]
        pair_identifier = (
            " ".join(p for p in pair_parts if isinstance(p, str) and p)
            or "Your pair"
        )
        service_names = [
            ((i.get("service_snapshot") or {}).get("name") or "Service")
            for i in items
        ]

        params = {
            "first_name": profile.get("first_name") or "",
            "order_number": order.get("order_number"),
            "pair_identifier": pair_identifier,
            "service_1": service_names[0] if len(service_names) > 0 else "",
            "service_2": service_names[1] if len(service_names) > 1 else "",
            "price": _fmt_cents(int(first_item.get("price_cents") or 0)),
            "pickup_address": _format_address(order.get("delivery_address")),
            "repairs_subtotal": _fmt_cents(int(order.get("repairs_subtotal_cents") or 0)),
            "courier_fee": _fmt_cents(int(order.get("courier_fee_cents") or 0)),
            "tax": _fmt_cents(int(order.get("tax_cents") or 0)),
            "order_total": _fmt_cents(int(order.get("total_cents") or 0)),
        }

        result = await send_brevo_email(
            template_id=1,
            to=[{"email": order["contact_email"], "name": profile.get("first_name") or ""}],
            params=params,
            tags=["order-confirmation"],
        )
        return JSONResponse(content={"ok": True, "brevo": result})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
