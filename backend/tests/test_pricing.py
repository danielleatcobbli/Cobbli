from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.pricing import PricingCatalog, quote_cart


@pytest.fixture
def catalog():
    return PricingCatalog(
        services={
            "heel-repair": {
                "slug": "heel-repair",
                "name": "Heel repair",
                "is_active": True,
                "is_coming_soon": False,
                "service_variants": [
                    {
                        "variant_key": "default",
                        "standard_cents": 5000,
                        "premium_cents": 6500,
                        "rank": 0,
                    }
                ],
            },
            "full-resole": {
                "slug": "full-resole",
                "name": "Full resole",
                "is_active": True,
                "is_coming_soon": False,
                "service_variants": [
                    {
                        "variant_key": "leather",
                        "standard_cents": 8500,
                        "premium_cents": 9500,
                        "rank": 0,
                    },
                    {
                        "variant_key": "rubber",
                        "standard_cents": 7500,
                        "premium_cents": 9000,
                        "rank": 1,
                    },
                ],
            },
        },
        packages={
            "full-restoration": {
                "slug": "full-restoration",
                "name": "Full restoration",
                "price_cents": 25000,
                "is_active": True,
            },
            "standard-service": {
                "slug": "standard-service",
                "name": "Standard repair",
                "price_cents": 20000,
                "is_active": True,
            },
        },
        config={
            "courier_fee_cents": 1500,
            "free_courier_threshold_cents": 10000,
        },
    )


@pytest.fixture(autouse=True)
def use_catalog(catalog):
    with patch("app.pricing.get_pricing_catalog", return_value=catalog):
        yield


def _payload(service_id: str = "heel-repair"):
    return {
        "contact_email": "buyer@example.com",
        "contact_phone": "+15555550100",
        "delivery_address": {"state": "NY"},
        "repairs_subtotal_cents": 1,
        "courier_fee_cents": 0,
        "tax_cents": 999999,
        "total_cents": 50,
        "items": [
            {
                "pair_snapshot": {
                    "id": "pair-1",
                    "shoeType": "Unspecified",
                    "services": [{"id": service_id}],
                },
                "service_snapshot": {"id": service_id, "name": "Tampered"},
                "price_cents": 1,
            }
        ],
    }


def test_ignores_all_client_money_fields():
    quote = quote_cart(_payload())

    assert quote.repairs_subtotal_cents == 5000
    assert quote.courier_fee_cents == 1500
    assert quote.tax_cents == 0
    assert quote.total_cents == 6500
    assert quote.payload["items"][0]["price_cents"] == 5000
    assert quote.payload["items"][0]["service_snapshot"]["name"] == "Heel repair"


def test_server_package_price_is_authoritative():
    quote = quote_cart(_payload("bundle-full-restoration"))

    assert quote.repairs_subtotal_cents == 25000
    assert quote.courier_fee_cents == 0
    assert quote.total_cents == 25000
    assert quote.payload["items"][0]["service_snapshot"] == {
        "id": "bundle-full-restoration",
        "name": "Full restoration",
        "package_slug": "full-restoration",
    }


def test_legacy_package_id_resolves_to_canonical_package():
    quote = quote_cart(_payload("bundle-standard-repair-sole-upper-interior"))

    assert quote.total_cents == 20000
    assert quote.payload["items"][0]["service_snapshot"]["id"] == (
        "bundle-standard-service"
    )


def test_free_courier_threshold_uses_server_subtotal():
    payload = _payload()
    payload["items"].append(payload["items"][0] | {
        "pair_snapshot": {
            "id": "pair-2",
            "shoeType": "Unspecified",
            "services": [{"id": "heel-repair"}],
        }
    })

    quote = quote_cart(payload)

    assert quote.repairs_subtotal_cents == 10000
    assert quote.courier_fee_cents == 0
    assert quote.total_cents == 10000


def test_full_resole_uses_validated_variant_and_tier():
    payload = _payload("full-resole")
    payload["items"][0]["service_snapshot"].update(
        {"sole_material": "Rubber", "premium": True}
    )

    quote = quote_cart(payload)

    assert quote.payload["items"][0]["price_cents"] == 9000
    assert quote.payload["items"][0]["service_snapshot"]["variant_key"] == "rubber"


@pytest.mark.parametrize(
    "service_id",
    ["unknown-service", "bundle-unknown-package"],
)
def test_unknown_or_inactive_items_fail_closed(service_id):
    with pytest.raises(HTTPException) as exc:
        quote_cart(_payload(service_id))

    assert exc.value.status_code == 400
