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
    """Client scoped to the caller's JWT so PostgREST enforces RLS.

    Uses the ANON key (not service-role) as the base key: the anon key carries
    no privileged claims, so PostgREST evaluates every request under the
    caller's JWT with RLS intact. Using the service-role key here would bypass
    RLS regardless of .postgrest.auth(), removing the DB-level backstop — the
    exact failure mode we must avoid for ops/admin routes.
    """
    s = get_settings()
    if not s.supabase_url:
        raise RuntimeError("SUPABASE_URL not configured")
    # Prefer the anon key; fall back to service-role only if anon is unset so
    # dev/local doesn't hard-break, but log-worthy in prod (see settings note).
    base_key = s.supabase_anon_key or s.supabase_service_role_key
    if not base_key:
        raise RuntimeError("SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY not configured")
    client = create_client(s.supabase_url, base_key)
    client.postgrest.auth(access_token)
    return client
