from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.settings import get_settings


@lru_cache(maxsize=1)
def get_supabase_admin() -> Client:
    """Service-role Supabase client. Bypasses RLS — keep server-side only."""
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured")
    return create_client(s.supabase_url, s.supabase_service_role_key)


def get_supabase_for_user(access_token: str) -> Client:
    """Anon-keyed client scoped to the caller's JWT (RLS-respecting)."""
    s = get_settings()
    if not s.supabase_url:
        raise RuntimeError("SUPABASE_URL not configured")
    client = create_client(s.supabase_url, s.supabase_service_role_key)
    client.postgrest.auth(access_token)
    return client
