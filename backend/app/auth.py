from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from supabase import Client

from app.supabase_client import get_supabase_admin


class AuthUser:
    """Authenticated Supabase user, resolved from a Bearer JWT."""

    __slots__ = ("id", "email", "access_token")

    def __init__(self, id: str, email: str | None, access_token: str) -> None:
        self.id = id
        self.email = email
        self.access_token = access_token


async def require_user(
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser:
    """FastAPI dependency: 401 unless caller has a valid Supabase JWT."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Empty bearer token")

    client: Client = get_supabase_admin()
    try:
        resp = client.auth.get_user(token)
    except Exception as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized") from e

    user = getattr(resp, "user", None)
    if user is None or not getattr(user, "id", None):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unauthorized")
    return AuthUser(id=user.id, email=getattr(user, "email", None), access_token=token)


CurrentUser = Annotated[AuthUser, Depends(require_user)]


# Roles that satisfy each gate. 'owner' is legacy → treated as 'admin';
# 'user' is legacy → 'customer'. Mirrors the frontend useRole normalization.
_ADMIN_ROLES = {"admin", "owner"}
_STAFF_ROLES = {"staff", "admin", "owner"}


def _roles_for(user_id: str) -> set[str]:
    """Fetch the caller's role labels. Reads the caller's OWN user_roles rows
    via the service-role client — a narrow privileged lookup of the requester's
    roles, not of any ops data. Returns an empty set on any failure (fail closed)."""
    try:
        client: Client = get_supabase_admin()
        resp = (
            client.table("user_roles")
            .select("role")
            .eq("user_id", user_id)
            .execute()
        )
        return {row["role"] for row in (getattr(resp, "data", None) or [])}
    except Exception:
        return set()


async def require_staff(user: CurrentUser) -> AuthUser:
    """403 unless the caller holds staff or admin (or legacy owner)."""
    if _roles_for(user.id) & _STAFF_ROLES:
        return user
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Staff or admin role required")


async def require_admin(user: CurrentUser) -> AuthUser:
    """403 unless the caller holds admin (or legacy owner)."""
    if _roles_for(user.id) & _ADMIN_ROLES:
        return user
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin role required")


StaffUser = Annotated[AuthUser, Depends(require_staff)]
AdminUser = Annotated[AuthUser, Depends(require_admin)]
