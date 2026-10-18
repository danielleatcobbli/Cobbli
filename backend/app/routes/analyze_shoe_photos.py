from __future__ import annotations

import base64
import json
import re
from typing import Any

import boto3
import httpx
from botocore.exceptions import ClientError
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth import CurrentUser
from app.settings import get_settings
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/analyze-shoe-photos", tags=["ai"])

# Bedrock throttling / capacity errors we treat as "no result" (soft-fail),
# mirroring the old gateway's 402/429 handling.
_SOFT_FAIL_ERRORS = {"ThrottlingException", "ServiceUnavailableException"}

SHOE_TYPES = ["Sneakers", "Boots", "Ankle boots", "Heels", "Flats", "Loafers", "Sandals"]
COLORS = [
    "Black", "Blue", "Brown", "Cream", "Denim", "Gold", "Green", "Grey",
    "Multi", "Navy", "Orange", "Pattern", "Pink", "Purple", "Red", "Silver",
    "Tan", "White", "Yellow",
]

EMPTY_RESULT = {"shoeType": None, "colors": [], "brand": None}


class AnalyzeRequest(BaseModel):
    photoPaths: list[str] | None = None
    bucket: str | None = None


def _prompt_text() -> str:
    shoe_types = ", ".join(SHOE_TYPES)
    color_list = ", ".join(COLORS)
    return (
        "You are helping classify a pair of shoes from customer photos for a shoe repair "
        "service.\n"
        "Identify, from the photos:\n"
        f"1) shoeType - one of: {shoe_types}.\n"
        "2) colors - Look carefully at the shoe in the image. List ONLY the colors that "
        "are clearly and visibly present on the shoe itself - including the upper, sole, "
        "laces, and lining if visible. Do not include colors you are uncertain about. Do "
        "not guess. If a color is only marginally present or you are not confident it is "
        f"there, omit it. Return only colors from this exact list: {color_list}. Return a "
        "maximum of 3 colors. If you can only confidently identify 1 color, return only 1. "
        "IMPORTANT: if the shoe has 4 or more distinct colors, return \"Multi\" as the sole "
        "color value instead of listing individual colors.\n"
        "3) brand - visible brand name if clearly readable, otherwise null.\n"
        "Reply ONLY with strict JSON: "
        '{"shoeType": string|null, "colors": string[], "brand": string|null}.'
    )


def _fetch_image_block(url: str) -> dict[str, Any] | None:
    """Download a signed image URL and return a Bedrock image content block.

    Bedrock's Claude API takes inline base64 bytes (it does not fetch URLs), so
    each photo must be downloaded here. A photo that fails to download is skipped
    rather than failing the whole request.
    """
    try:
        resp = httpx.get(url, timeout=20.0)
        resp.raise_for_status()
    except httpx.HTTPError:
        return None
    media_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    if not media_type.startswith("image/"):
        media_type = "image/jpeg"
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": base64.standard_b64encode(resp.content).decode("ascii"),
        },
    }


def _build_messages(image_blocks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = list(image_blocks)
    content.append({"type": "text", "text": _prompt_text()})
    return [{"role": "user", "content": content}]


def _extract_signed_url(result: Any) -> str | None:
    if isinstance(result, dict):
        if result.get("error") or not result.get("data"):
            return None
        data = result["data"]
        if isinstance(data, dict):
            return data.get("signedUrl") or data.get("signed_url")
    return getattr(result, "signed_url", None) or getattr(result, "signedUrl", None)


def _parse_ai_content(raw: str) -> dict[str, Any]:
    match = re.search(r"\{[\s\S]*\}", raw or "")
    if not match:
        return {}
    try:
        parsed = json.loads(match[0])
    except (ValueError, TypeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _normalize(parsed: dict[str, Any]) -> dict[str, Any]:
    raw_type = parsed.get("shoeType")
    shoe_type = raw_type if raw_type in SHOE_TYPES else None

    raw_colors = parsed.get("colors")
    colors: list[str] = []
    if isinstance(raw_colors, list):
        colors = [c for c in raw_colors if isinstance(c, str) and c in COLORS][:4]
    if len(colors) >= 4:
        colors = ["Multi"]

    raw_brand = parsed.get("brand")
    brand: str | None = None
    if isinstance(raw_brand, str) and raw_brand.strip():
        brand = raw_brand.strip()[:100]

    return {"shoeType": shoe_type, "colors": colors, "brand": brand}


def _bedrock_client():
    settings = get_settings()
    return boto3.client("bedrock-runtime", region_name=settings.bedrock_region)


def _invoke_bedrock(image_blocks: list[dict[str, Any]]) -> str:
    """Call Bedrock Claude and return the raw text content. Raises on hard errors."""
    settings = get_settings()
    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 512,
            "messages": _build_messages(image_blocks),
        }
    )
    resp = _bedrock_client().invoke_model(
        modelId=settings.bedrock_model_id,
        body=body,
        contentType="application/json",
        accept="application/json",
    )
    payload = json.loads(resp["body"].read())
    parts = payload.get("content") or [{}]
    text = parts[0].get("text") if isinstance(parts[0], dict) else None
    return text if isinstance(text, str) else ""


@router.post("/")
async def analyze_shoe_photos(
    payload: AnalyzeRequest,
    user: CurrentUser,
) -> JSONResponse:
    _ = user  # auth-only; user identity isn't used in the request itself
    try:
        photo_paths = payload.photoPaths
        if not isinstance(photo_paths, list) or len(photo_paths) == 0:
            return JSONResponse({"error": "photoPaths required"}, status_code=400)

        bucket_name = (
            "pair-photos" if payload.bucket == "pair-photos" else "assessment-uploads"
        )
        admin = get_supabase_admin()

        urls: list[str] = []
        for path in photo_paths[:6]:
            try:
                result = admin.storage.from_(bucket_name).create_signed_url(
                    path, 60 * 5
                )
            except Exception:  # noqa: S112 - missing url just skips this photo
                continue
            signed = _extract_signed_url(result)
            if signed:
                urls.append(signed)

        if not urls:
            return JSONResponse(EMPTY_RESULT)

        image_blocks = [b for b in (_fetch_image_block(u) for u in urls) if b]
        if not image_blocks:
            return JSONResponse(EMPTY_RESULT)

        try:
            raw = _invoke_bedrock(image_blocks)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in _SOFT_FAIL_ERRORS:
                return JSONResponse(EMPTY_RESULT)
            raise

        parsed = _parse_ai_content(raw)
        return JSONResponse(_normalize(parsed))
    except Exception as exc:
        return JSONResponse(
            {"error": str(exc), **EMPTY_RESULT},
            status_code=500,
        )
