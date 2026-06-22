from __future__ import annotations

import json
import re
from typing import Any

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.auth import CurrentUser
from app.settings import get_settings
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/analyze-shoe-photos", tags=["ai"])

AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions"
AI_MODEL = "google/gemini-2.5-pro"

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


def _build_prompt(urls: list[str]) -> list[dict[str, Any]]:
    shoe_types = ", ".join(SHOE_TYPES)
    color_list = ", ".join(COLORS)
    text = (
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
    content: list[dict[str, Any]] = [{"type": "text", "text": text}]
    content.extend({"type": "image_url", "image_url": {"url": u}} for u in urls)
    return content


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


@router.post("/")
async def analyze_shoe_photos(
    payload: AnalyzeRequest,
    user: CurrentUser,
) -> JSONResponse:
    _ = user  # auth-only; user identity isn't used in the request itself
    try:
        settings = get_settings()
        if not settings.ai_api_key:
            raise RuntimeError("AI_API_KEY not configured")

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

        async with httpx.AsyncClient(timeout=60.0) as http:
            ai_res = await http.post(
                AI_GATEWAY_URL,
                headers={
                    "Authorization": f"Bearer {settings.ai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": AI_MODEL,
                    "messages": [{"role": "user", "content": _build_prompt(urls)}],
                },
            )

        if ai_res.status_code >= 400:
            if ai_res.status_code in (402, 429):
                return JSONResponse(EMPTY_RESULT)
            raise RuntimeError(f"AI gateway {ai_res.status_code}")

        body = ai_res.json()
        choices = body.get("choices") or [{}]
        message = choices[0].get("message") or {}
        raw = message.get("content")
        parsed = _parse_ai_content(raw if isinstance(raw, str) else "")
        return JSONResponse(_normalize(parsed))
    except Exception as exc:
        return JSONResponse(
            {"error": str(exc), **EMPTY_RESULT},
            status_code=500,
        )
