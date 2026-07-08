from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import AdminUser
from app.supabase_client import get_supabase_for_user

router = APIRouter(prefix="/ops", tags=["ops", "service-admin"])

_ZIP_RE = re.compile(r"^[0-9]{5}$")


class ServiceUpdate(BaseModel):
    """Admin-editable service fields. All optional; at least one required."""

    base_price_cents: int | None = Field(default=None, ge=0)
    turnaround_days: int | None = Field(default=None, ge=0)
    name: str | None = None
    short_description: str | None = None
    full_description: str | None = None
    image_url: str | None = None
    is_active: bool | None = None
    popularity_rank: int | None = Field(default=None, ge=0)


class ServiceAreaUpsert(BaseModel):
    label: str | None = None
    is_active: bool = True


class PricingConfigUpsert(BaseModel):
    value_cents: int = Field(ge=0)
    label: str | None = None


def _raise_if_error(resp: Any) -> None:
    err = getattr(resp, "error", None)
    if err:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(err))


def _validate_zip(zip_code: str) -> None:
    if not _ZIP_RE.match(zip_code):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid ZIP code")


@router.patch("/services/{service_id}")
async def update_service(service_id: str, body: ServiceUpdate, user: AdminUser) -> Any:
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")
    sb = get_supabase_for_user(user.access_token)
    resp = sb.table("services").update(updates).eq("id", service_id).execute()
    _raise_if_error(resp)
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Service not found")
    return {"data": rows[0]}


@router.put("/service-areas/{zip_code}")
async def upsert_service_area(
    zip_code: str, body: ServiceAreaUpsert, user: AdminUser
) -> Any:
    _validate_zip(zip_code)
    payload = {"zip": zip_code, "label": body.label, "is_active": body.is_active}
    sb = get_supabase_for_user(user.access_token)
    resp = sb.table("service_areas").upsert(payload).execute()
    _raise_if_error(resp)
    rows = getattr(resp, "data", None) or []
    return {"data": rows[0] if rows else payload}


@router.delete("/service-areas/{zip_code}")
async def delete_service_area(zip_code: str, user: AdminUser) -> Any:
    _validate_zip(zip_code)
    sb = get_supabase_for_user(user.access_token)
    resp = sb.table("service_areas").delete().eq("zip", zip_code).execute()
    _raise_if_error(resp)
    return {"ok": True}


@router.put("/pricing-config/{key}")
async def upsert_pricing_config(
    key: str, body: PricingConfigUpsert, user: AdminUser
) -> Any:
    if not key.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid key")
    payload = {"key": key, "value_cents": body.value_cents, "label": body.label}
    sb = get_supabase_for_user(user.access_token)
    resp = sb.table("pricing_config").upsert(payload).execute()
    _raise_if_error(resp)
    rows = getattr(resp, "data", None) or []
    return {"data": rows[0] if rows else payload}
