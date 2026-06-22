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
