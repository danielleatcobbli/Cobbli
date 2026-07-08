from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import AdminUser
from app.supabase_client import get_supabase_admin, get_supabase_for_user

# Admin-gated CRUD lives under /ops/blog; the unauthenticated public reads live
# under /blog and enforce status='published' in code.
router = APIRouter(tags=["blog"])

_SELECT = (
    "id, title, slug, excerpt, body, cover_image_url, seo_title, "
    "seo_description, status, published_at, author_id, created_at, updated_at"
)
_ALLOWED_STATUSES = {"draft", "published"}


class BlogPostCreate(BaseModel):
    title: str = Field(min_length=1)
    slug: str = Field(min_length=1)
    body: str = ""
    excerpt: str | None = None
    cover_image_url: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    status: str = "draft"


class BlogPostUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    body: str | None = None
    excerpt: str | None = None
    cover_image_url: str | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    status: str | None = None


def _raise_if_error(resp: Any) -> None:
    err = getattr(resp, "error", None)
    if err:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(err))


def _validate_status(value: str | None) -> None:
    if value is not None and value not in _ALLOWED_STATUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid status")


# ---- Admin CRUD (incl. drafts) ----


@router.get("/ops/blog/posts")
async def list_posts_admin(user: AdminUser) -> Any:
    sb = get_supabase_for_user(user.access_token)
    resp = sb.table("blog_posts").select(_SELECT).order(
        "created_at", desc=True
    ).execute()
    _raise_if_error(resp)
    return {"data": getattr(resp, "data", None) or []}


@router.post("/ops/blog/posts", status_code=status.HTTP_201_CREATED)
async def create_post(body: BlogPostCreate, user: AdminUser) -> Any:
    _validate_status(body.status)
    # author_id is ALWAYS derived from the authenticated admin — never trust
    # any client-supplied value.
    payload = {
        "title": body.title,
        "slug": body.slug,
        "body": body.body,
        "excerpt": body.excerpt,
        "cover_image_url": body.cover_image_url,
        "seo_title": body.seo_title,
        "seo_description": body.seo_description,
        "status": body.status,
        "author_id": user.id,
    }
    sb = get_supabase_for_user(user.access_token)
    resp = sb.table("blog_posts").insert(payload).execute()
    _raise_if_error(resp)
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Insert returned no row")
    return {"data": rows[0]}


@router.patch("/ops/blog/posts/{post_id}")
async def update_post(post_id: str, body: BlogPostUpdate, user: AdminUser) -> Any:
    _validate_status(body.status)
    # author_id is intentionally not updatable via this route.
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields to update")

    sb = get_supabase_for_user(user.access_token)
    resp = sb.table("blog_posts").update(updates).eq("id", post_id).execute()
    _raise_if_error(resp)
    rows = getattr(resp, "data", None) or []
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return {"data": rows[0]}


@router.delete("/ops/blog/posts/{post_id}")
async def delete_post(post_id: str, user: AdminUser) -> Any:
    sb = get_supabase_for_user(user.access_token)
    resp = sb.table("blog_posts").delete().eq("id", post_id).execute()
    _raise_if_error(resp)
    return {"ok": True}


# ---- Public reads (no auth) — published only, enforced in code ----


@router.get("/blog/posts")
async def list_published_posts() -> Any:
    sb = get_supabase_admin()
    resp = (
        sb.table("blog_posts")
        .select(_SELECT)
        .eq("status", "published")
        .order("published_at", desc=True)
        .execute()
    )
    _raise_if_error(resp)
    return {"data": getattr(resp, "data", None) or []}


@router.get("/blog/posts/{slug}")
async def get_published_post(slug: str) -> Any:
    sb = get_supabase_admin()
    resp = (
        sb.table("blog_posts")
        .select(_SELECT)
        .eq("slug", slug)
        .eq("status", "published")
        .maybe_single()
        .execute()
    )
    _raise_if_error(resp)
    row = getattr(resp, "data", None)
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found")
    return {"data": row}
