from __future__ import annotations

import json
from unittest.mock import MagicMock

import httpx
import pytest
import respx

AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"


def _signed_url_response(path: str) -> dict:
    return {"data": {"signedUrl": f"https://signed.example/{path}"}, "error": None}


def _make_admin_mock(signed_results: list[dict] | None = None) -> MagicMock:
    admin = MagicMock()
    bucket = MagicMock()
    if signed_results is None:
        bucket.create_signed_url.side_effect = (
            lambda path, ttl: _signed_url_response(path)
        )
    else:
        bucket.create_signed_url.side_effect = signed_results
    admin.storage.from_.return_value = bucket
    return admin


def _ai_payload(shoe_type, colors, brand) -> dict:
    body = {"shoeType": shoe_type, "colors": colors, "brand": brand}
    return {"choices": [{"message": {"content": "JSON: " + json.dumps(body)}}]}


@pytest.fixture
def admin_mock(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    admin = _make_admin_mock()
    monkeypatch.setattr(
        "app.routes.analyze_shoe_photos.get_supabase_admin",
        lambda: admin,
    )
    return admin


@respx.mock
def test_happy_path_returns_classification(client, admin_mock: MagicMock) -> None:
    respx.post(AI_URL).mock(
        return_value=httpx.Response(
            200, json=_ai_payload("Sneakers", ["Black", "White"], "Nike")
        )
    )

    res = client.post(
        "/analyze-shoe-photos/",
        json={"photoPaths": ["a.jpg", "b.jpg"], "bucket": "pair-photos"},
    )
    assert res.status_code == 200
    assert res.json() == {
        "shoeType": "Sneakers",
        "colors": ["Black", "White"],
        "brand": "Nike",
    }
    admin_mock.storage.from_.assert_called_with("pair-photos")


@respx.mock
def test_default_bucket_is_assessment_uploads(client, admin_mock: MagicMock) -> None:
    respx.post(AI_URL).mock(
        return_value=httpx.Response(200, json=_ai_payload("Boots", ["Brown"], None))
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["x.jpg"]})
    assert res.status_code == 200
    admin_mock.storage.from_.assert_called_with("assessment-uploads")


def test_missing_photo_paths_returns_400(client, admin_mock: MagicMock) -> None:
    res = client.post("/analyze-shoe-photos/", json={})
    assert res.status_code == 400
    assert res.json()["error"] == "photoPaths required"


def test_unauthenticated_request_returns_401(unauth_client) -> None:
    res = unauth_client.post(
        "/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]}
    )
    assert res.status_code == 401


def test_empty_photo_paths_returns_400(client, admin_mock: MagicMock) -> None:
    res = client.post("/analyze-shoe-photos/", json={"photoPaths": []})
    assert res.status_code == 400
    assert res.json()["error"] == "photoPaths required"


def test_no_signed_urls_returns_null_result(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = _make_admin_mock(
        signed_results=[{"data": None, "error": {"message": "boom"}}]
    )
    monkeypatch.setattr(
        "app.routes.analyze_shoe_photos.get_supabase_admin", lambda: admin
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["bad.jpg"]})
    assert res.status_code == 200
    assert res.json() == {"shoeType": None, "colors": [], "brand": None}


@respx.mock
def test_ai_gateway_429_returns_null_result(client, admin_mock: MagicMock) -> None:
    respx.post(AI_URL).mock(return_value=httpx.Response(429, text="rate limited"))

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json() == {"shoeType": None, "colors": [], "brand": None}


@respx.mock
def test_ai_gateway_402_returns_null_result(client, admin_mock: MagicMock) -> None:
    respx.post(AI_URL).mock(
        return_value=httpx.Response(402, text="payment required")
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json() == {"shoeType": None, "colors": [], "brand": None}


@respx.mock
def test_ai_gateway_500_returns_500(client, admin_mock: MagicMock) -> None:
    respx.post(AI_URL).mock(return_value=httpx.Response(500, text="server error"))

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 500
    body = res.json()
    assert body["shoeType"] is None
    assert body["colors"] == []
    assert body["brand"] is None
    assert "error" in body


@respx.mock
def test_invalid_shoe_type_is_nulled(client, admin_mock: MagicMock) -> None:
    respx.post(AI_URL).mock(
        return_value=httpx.Response(
            200, json=_ai_payload("FlipFlops", ["Black"], "Acme")
        )
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    body = res.json()
    assert body["shoeType"] is None
    assert body["colors"] == ["Black"]
    assert body["brand"] == "Acme"


@respx.mock
def test_invalid_colors_are_filtered(client, admin_mock: MagicMock) -> None:
    respx.post(AI_URL).mock(
        return_value=httpx.Response(
            200,
            json=_ai_payload("Sneakers", ["Black", "Magenta", "Red"], None),
        )
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json()["colors"] == ["Black", "Red"]


@respx.mock
def test_four_or_more_colors_collapse_to_multi(client, admin_mock: MagicMock) -> None:
    respx.post(AI_URL).mock(
        return_value=httpx.Response(
            200,
            json=_ai_payload("Sneakers", ["Black", "White", "Red", "Blue"], None),
        )
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json()["colors"] == ["Multi"]


@respx.mock
def test_brand_is_trimmed_to_100_chars(client, admin_mock: MagicMock) -> None:
    long_brand = "B" * 250
    respx.post(AI_URL).mock(
        return_value=httpx.Response(
            200, json=_ai_payload("Sneakers", ["Black"], long_brand)
        )
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json()["brand"] == "B" * 100


@respx.mock
def test_unparseable_ai_response_yields_null(client, admin_mock: MagicMock) -> None:
    respx.post(AI_URL).mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": "no json here at all"}}]},
        )
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json() == {"shoeType": None, "colors": [], "brand": None}


@respx.mock
def test_only_first_six_paths_are_signed(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = _make_admin_mock()
    monkeypatch.setattr(
        "app.routes.analyze_shoe_photos.get_supabase_admin", lambda: admin
    )
    respx.post(AI_URL).mock(
        return_value=httpx.Response(
            200, json=_ai_payload("Sneakers", ["Black"], None)
        )
    )

    paths = [f"{i}.jpg" for i in range(10)]
    res = client.post("/analyze-shoe-photos/", json={"photoPaths": paths})
    assert res.status_code == 200
    assert admin.storage.from_.return_value.create_signed_url.call_count == 6


def test_missing_api_key_returns_500(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("AI_API_KEY", "")
    from app.settings import get_settings

    get_settings.cache_clear()

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 500
    body = res.json()
    assert "AI_API_KEY" in body["error"]
    assert body["shoeType"] is None
    assert body["colors"] == []
    assert body["brand"] is None
