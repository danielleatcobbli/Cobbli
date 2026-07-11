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

        # Real per-line-item list, not a flattened "pair_identifier" +
        # "service_1"/"service_2" (which silently dropped anything past a
        # second service, and any pair past the first). Feeds the Brevo
        # template's `{% for item in params.items %}` loop directly — see
        # requirements doc Section 15. `qty` is hardcoded to 1 since
        # `order_items` has no quantity column today; each row is already one
        # (pair, service) line.
        item_list = []
        for i in items:
            pair_snap = i.get("pair_snapshot") or {}
            pair_parts = [pair_snap.get("brand"), pair_snap.get("shoe_type")]
            name = " ".join(p for p in pair_parts if isinstance(p, str) and p) or "Your pair"
            service_snap = i.get("service_snapshot") or {}
            item_list.append({
                "name": name,
                "service": service_snap.get("name") or "Service",
                "description": pair_snap.get("description") or "",
                "qty": 1,
            })

        params = {
            "first_name": profile.get("first_name") or "",
            "order_number": order.get("order_number"),
            "order_date": order.get("placed_at") or "",
            # No scheduled-pickup timestamp exists on `orders` yet (see
            # Section 5/9 — Calendly-backed pickup scheduling isn't wired to
            # persist a real date/time on the order today), so this can't be
            # populated from real data yet. Left blank rather than guessed;
            # revisit once that field exists.
            "pickup_datetime": order.get("pickup_datetime") or "",
            "pickup_address": _format_address(order.get("delivery_address")),
            "contact_phone": order.get("contact_phone") or "",
            "items": item_list,
            "repair_subtotal": _fmt_cents(int(order.get("repairs_subtotal_cents") or 0)),
            "delivery_fee": _fmt_cents(int(order.get("courier_fee_cents") or 0)),
            "tax": _fmt_cents(int(order.get("tax_cents") or 0)),
            "order_total": _fmt_cents(int(order.get("total_cents") or 0)),
            "support_email": "support@cobbli.com",
        }

        result = await send_brevo_email(
            # Was `template_id=1` — no such template exists in the Brevo
            # account (only 17, 15, 8, 7, 6). 15 is the real, active "Order
            # confirmation" template. See requirements doc Section 15.
            template_id=15,
            to=[{"email": order["contact_email"], "name": profile.get("first_name") or ""}],
            params=params,
            tags=["order-confirmation"],
        )
        return JSONResponse(content={"ok": True, "brevo": result})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
