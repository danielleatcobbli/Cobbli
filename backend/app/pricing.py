from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Any

from fastapi import HTTPException, status

from app.supabase_client import get_supabase_admin

CATALOG_TTL_SECONDS = 60
MAX_CART_ITEMS = 100

PRICING_CONFIG_DEFAULTS = {
    "courier_fee_cents": 1500,
    "free_courier_threshold_cents": 10000,
}

# PackageDetail historically generated IDs from display names while the
# recommendation flow used canonical bundle slugs. Accept those old local-bag
# IDs but resolve all of them to one server-owned package record.
LEGACY_PACKAGE_ALIASES = {
    "standard-repair-sole-upper-interior": "standard-service",
    "exterior-repair-sole-upper": "full-exterior-repair",
}

SHOE_TYPE_VARIANTS = {
    "Boots": "boots",
    "Ankle boots": "ankle_boots",
}


@dataclass(frozen=True)
class PricingCatalog:
    services: dict[str, dict[str, Any]]
    packages: dict[str, dict[str, Any]]
    config: dict[str, int]


@dataclass(frozen=True)
class CartQuote:
    payload: dict[str, Any]
    repairs_subtotal_cents: int
    courier_fee_cents: int
    tax_cents: int
    total_cents: int


_catalog_lock = Lock()
_catalog_value: PricingCatalog | None = None
_catalog_expires_at = 0.0


def clear_pricing_catalog_cache() -> None:
    global _catalog_value, _catalog_expires_at
    with _catalog_lock:
        _catalog_value = None
        _catalog_expires_at = 0.0


def _rows(resp: Any, source: str) -> list[dict[str, Any]]:
    error = getattr(resp, "error", None)
    if error:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Could not load authoritative {source}",
        )
    data = getattr(resp, "data", None)
    return data if isinstance(data, list) else []


def _load_pricing_catalog() -> PricingCatalog:
    sb = get_supabase_admin()
    service_rows = _rows(
        sb.table("services")
        .select(
            "slug,name,is_active,is_coming_soon,"
            "service_variants(variant_key,standard_cents,premium_cents,rank)"
        )
        .eq("is_active", True)
        .execute(),
        "services",
    )
    package_rows = _rows(
        sb.table("repair_packages")
        .select("slug,name,price_cents,is_active")
        .eq("is_active", True)
        .execute(),
        "repair packages",
    )
    config_rows = _rows(
        sb.table("pricing_config").select("key,value_cents").execute(),
        "pricing configuration",
    )

    services = {
        row["slug"]: row
        for row in service_rows
        if isinstance(row.get("slug"), str)
        and row.get("is_active") is True
        and row.get("is_coming_soon") is not True
    }
    packages = {
        row["slug"]: row
        for row in package_rows
        if isinstance(row.get("slug"), str)
        and row.get("is_active") is True
        and isinstance(row.get("price_cents"), int)
    }
    config = dict(PRICING_CONFIG_DEFAULTS)
    for row in config_rows:
        key = row.get("key")
        value = row.get("value_cents")
        if key in config and isinstance(value, int) and value >= 0:
            config[key] = value

    return PricingCatalog(services=services, packages=packages, config=config)


def get_pricing_catalog() -> PricingCatalog:
    global _catalog_value, _catalog_expires_at
    now = monotonic()
    with _catalog_lock:
        if _catalog_value is not None and now < _catalog_expires_at:
            return _catalog_value
        _catalog_value = _load_pricing_catalog()
        _catalog_expires_at = now + CATALOG_TTL_SECONDS
        return _catalog_value


def _nested_service_selection(
    pair_snapshot: dict[str, Any], service_slug: str
) -> dict[str, Any]:
    services = pair_snapshot.get("services")
    if not isinstance(services, list):
        return {}
    for service in services:
        if isinstance(service, dict) and service.get("id") == service_slug:
            return service
    return {}


def _canonical_service_item(
    item: dict[str, Any],
    service_slug: str,
    service: dict[str, Any],
) -> dict[str, Any]:
    pair_snapshot = item.get("pair_snapshot")
    if not isinstance(pair_snapshot, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid pair snapshot")

    variants = service.get("service_variants")
    if not isinstance(variants, list) or not variants:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Service '{service_slug}' has no active price",
        )
    valid_variants = [
        variant
        for variant in variants
        if isinstance(variant, dict)
        and isinstance(variant.get("variant_key"), str)
        and isinstance(variant.get("standard_cents"), int)
        and variant["standard_cents"] >= 50
    ]
    if not valid_variants:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Service '{service_slug}' has no valid price",
        )
    valid_variants.sort(
        key=lambda variant: (
            variant.get("rank") if isinstance(variant.get("rank"), int) else 0
        )
    )

    service_snapshot = item.get("service_snapshot")
    submitted_snapshot = (
        service_snapshot if isinstance(service_snapshot, dict) else {}
    )
    nested_selection = _nested_service_selection(pair_snapshot, service_slug)
    sole_material = submitted_snapshot.get("sole_material")
    if not isinstance(sole_material, str):
        sole_material = nested_selection.get("soleMaterial")
    premium = submitted_snapshot.get("premium")
    if not isinstance(premium, bool):
        premium = nested_selection.get("premium") is True

    wanted_variant = None
    if service_slug == "full-resole" and sole_material in ("Leather", "Rubber"):
        wanted_variant = sole_material.lower()
    else:
        shoe_type = pair_snapshot.get("shoeType")
        wanted_variant = SHOE_TYPE_VARIANTS.get(shoe_type, "other")

    variant = next(
        (
            candidate
            for candidate in valid_variants
            if candidate["variant_key"] == wanted_variant
        ),
        valid_variants[0],
    )
    price_cents = variant["standard_cents"]
    # Mirrors the current live frontend pricer: premium pricing is only
    # applicable to full-resole selections.
    premium_cents = variant.get("premium_cents")
    if (
        service_slug == "full-resole"
        and premium
        and isinstance(premium_cents, int)
        and premium_cents >= 50
    ):
        price_cents = premium_cents

    canonical_snapshot: dict[str, Any] = {
        "id": service_slug,
        "name": service.get("name") or service_slug,
        "variant_key": variant["variant_key"],
        "premium": premium,
    }
    paint_consent = submitted_snapshot.get("paint_consent")
    if paint_consent in ("yes", "no"):
        canonical_snapshot["paint_consent"] = paint_consent
    if sole_material in ("Leather", "Rubber"):
        canonical_snapshot["sole_material"] = sole_material

    return {
        "pair_snapshot": pair_snapshot,
        "service_snapshot": canonical_snapshot,
        "price_cents": price_cents,
    }


def _canonical_package_item(
    item: dict[str, Any],
    submitted_id: str,
    catalog: PricingCatalog,
) -> dict[str, Any]:
    package_slug = submitted_id.removeprefix("bundle-")
    package_slug = LEGACY_PACKAGE_ALIASES.get(package_slug, package_slug)
    package = catalog.packages.get(package_slug)
    if package is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unknown or inactive repair package '{package_slug}'",
        )
    pair_snapshot = item.get("pair_snapshot")
    if not isinstance(pair_snapshot, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid pair snapshot")
    return {
        "pair_snapshot": pair_snapshot,
        "service_snapshot": {
            "id": f"bundle-{package_slug}",
            "name": package.get("name") or package_slug,
            "package_slug": package_slug,
        },
        "price_cents": package["price_cents"],
    }


def quote_cart(payload: dict[str, Any]) -> CartQuote:
    catalog = get_pricing_catalog()
    submitted_items = payload.get("items")
    if (
        not isinstance(submitted_items, list)
        or not submitted_items
        or len(submitted_items) > MAX_CART_ITEMS
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid cart items")

    canonical_items: list[dict[str, Any]] = []
    for item in submitted_items:
        if not isinstance(item, dict):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid cart item")
        service_snapshot = item.get("service_snapshot")
        if not isinstance(service_snapshot, dict):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Invalid service snapshot"
            )
        submitted_id = service_snapshot.get("id")
        if not isinstance(submitted_id, str) or not submitted_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing service ID")

        if submitted_id.startswith("bundle-"):
            canonical_item = _canonical_package_item(item, submitted_id, catalog)
        else:
            service = catalog.services.get(submitted_id)
            if service is None:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Unknown or inactive service '{submitted_id}'",
                )
            canonical_item = _canonical_service_item(item, submitted_id, service)
        canonical_items.append(canonical_item)

    repairs_subtotal = sum(item["price_cents"] for item in canonical_items)
    free_threshold = catalog.config["free_courier_threshold_cents"]
    courier_fee = (
        0
        if repairs_subtotal >= free_threshold
        else catalog.config["courier_fee_cents"]
    )

    delivery_address = payload.get("delivery_address")
    if not isinstance(delivery_address, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid delivery address")
    # Cobbli currently serves New York repair labor, which is tax exempt.
    tax_cents = 0
    total_cents = repairs_subtotal + courier_fee + tax_cents
    if total_cents < 50:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid cart total")

    canonical_payload = deepcopy(payload)
    canonical_payload["items"] = canonical_items
    canonical_payload["repairs_subtotal_cents"] = repairs_subtotal
    canonical_payload["courier_fee_cents"] = courier_fee
    canonical_payload["tax_cents"] = tax_cents
    canonical_payload["total_cents"] = total_cents

    return CartQuote(
        payload=canonical_payload,
        repairs_subtotal_cents=repairs_subtotal,
        courier_fee_cents=courier_fee,
        tax_cents=tax_cents,
        total_cents=total_cents,
    )
