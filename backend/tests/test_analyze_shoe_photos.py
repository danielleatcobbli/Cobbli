from __future__ import annotations

import io
import json
from unittest.mock import MagicMock

import pytest
from botocore.exceptions import ClientError


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


def _bedrock_text_payload(shoe_type, colors, brand) -> dict:
    """Mimic a Bedrock invoke_model response body (Claude messages API)."""
    body = {"shoeType": shoe_type, "colors": colors, "brand": brand}
    return {"content": [{"type": "text", "text": "JSON: " + json.dumps(body)}]}


def _make_bedrock_mock(text_payload: dict) -> MagicMock:
    """Return a boto3 bedrock-runtime client mock whose invoke_model returns
    a body object with a .read() yielding the given JSON payload."""
    client = MagicMock()
    client.invoke_model.return_value = {
        "body": io.BytesIO(json.dumps(text_payload).encode("utf-8"))
    }
    return client


def _throttling_error() -> ClientError:
    return ClientError(
        {"Error": {"Code": "ThrottlingException", "Message": "slow down"}},
        "InvokeModel",
    )


@pytest.fixture(autouse=True)
def _stub_image_download(monkeypatch: pytest.MonkeyPatch) -> None:
    """Every signed URL 'downloads' to a tiny fake image block, so tests never
    hit the network. Overridden implicitly where a test needs no images."""
    monkeypatch.setattr(
        "app.routes.analyze_shoe_photos._fetch_image_block",
        lambda url: {
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": "AA=="},
        },
    )


@pytest.fixture
def admin_mock(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    admin = _make_admin_mock()
    monkeypatch.setattr(
        "app.routes.analyze_shoe_photos.get_supabase_admin",
        lambda: admin,
    )
    return admin


def _patch_bedrock(monkeypatch: pytest.MonkeyPatch, client: MagicMock) -> None:
    monkeypatch.setattr(
        "app.routes.analyze_shoe_photos._bedrock_client", lambda: client
    )


def test_happy_path_returns_classification(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_bedrock(
        monkeypatch,
        _make_bedrock_mock(_bedrock_text_payload("Sneakers", ["Black", "White"], "Nike")),
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


def test_default_bucket_is_assessment_uploads(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_bedrock(
        monkeypatch, _make_bedrock_mock(_bedrock_text_payload("Boots", ["Brown"], None))
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


def test_bedrock_throttling_returns_null_result(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    bedrock = MagicMock()
    bedrock.invoke_model.side_effect = _throttling_error()
    _patch_bedrock(monkeypatch, bedrock)

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json() == {"shoeType": None, "colors": [], "brand": None}


def test_bedrock_hard_error_returns_500(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    bedrock = MagicMock()
    bedrock.invoke_model.side_effect = ClientError(
        {"Error": {"Code": "AccessDeniedException", "Message": "nope"}},
        "InvokeModel",
    )
    _patch_bedrock(monkeypatch, bedrock)

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 500
    body = res.json()
    assert body["shoeType"] is None
    assert body["colors"] == []
    assert body["brand"] is None
    assert "error" in body


def test_invalid_shoe_type_is_nulled(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_bedrock(
        monkeypatch,
        _make_bedrock_mock(_bedrock_text_payload("FlipFlops", ["Black"], "Acme")),
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    body = res.json()
    assert body["shoeType"] is None
    assert body["colors"] == ["Black"]
    assert body["brand"] == "Acme"


def test_invalid_colors_are_filtered(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_bedrock(
        monkeypatch,
        _make_bedrock_mock(
            _bedrock_text_payload("Sneakers", ["Black", "Magenta", "Red"], None)
        ),
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json()["colors"] == ["Black", "Red"]


def test_four_or_more_colors_collapse_to_multi(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_bedrock(
        monkeypatch,
        _make_bedrock_mock(
            _bedrock_text_payload("Sneakers", ["Black", "White", "Red", "Blue"], None)
        ),
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json()["colors"] == ["Multi"]


def test_brand_is_trimmed_to_100_chars(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    long_brand = "B" * 250
    _patch_bedrock(
        monkeypatch,
        _make_bedrock_mock(_bedrock_text_payload("Sneakers", ["Black"], long_brand)),
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json()["brand"] == "B" * 100


def test_unparseable_ai_response_yields_null(
    client, admin_mock: MagicMock, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_bedrock(
        monkeypatch,
        _make_bedrock_mock({"content": [{"type": "text", "text": "no json at all"}]}),
    )

    res = client.post("/analyze-shoe-photos/", json={"photoPaths": ["a.jpg"]})
    assert res.status_code == 200
    assert res.json() == {"shoeType": None, "colors": [], "brand": None}


def test_only_first_six_paths_are_signed(
    client, monkeypatch: pytest.MonkeyPatch
) -> None:
    admin = _make_admin_mock()
    monkeypatch.setattr(
        "app.routes.analyze_shoe_photos.get_supabase_admin", lambda: admin
    )
    _patch_bedrock(
        monkeypatch, _make_bedrock_mock(_bedrock_text_payload("Sneakers", ["Black"], None))
    )

    paths = [f"{i}.jpg" for i in range(10)]
    res = client.post("/analyze-shoe-photos/", json={"photoPaths": paths})
    assert res.status_code == 200
    assert admin.storage.from_.return_value.create_signed_url.call_count == 6
