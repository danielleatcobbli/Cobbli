from __future__ import annotations

import re

import stripe
from fastapi import HTTPException, status

_USER_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


def resolve_or_create_customer(*, email: str | None, user_id: str) -> str:
    """Find (or create) the Stripe Customer for a Cobbli user.

    Looks up by `metadata.userId` first, then by email (backfilling metadata
    on match), and only creates a new Customer if neither is found.
    """
    if not _USER_ID_RE.match(user_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid userId")

    found = stripe.Customer.search(
        query=f"metadata['userId']:'{user_id}'", limit=1
    )
    if getattr(found, "data", None):
        return found.data[0].id

    if email:
        existing = stripe.Customer.list(email=email, limit=1)
        if getattr(existing, "data", None):
            c = existing.data[0]
            existing_meta = getattr(c, "metadata", None) or {}
            if existing_meta.get("userId") != user_id:
                stripe.Customer.modify(
                    c.id, metadata={**existing_meta, "userId": user_id}
                )
            return c.id

    created = stripe.Customer.create(
        **({"email": email} if email else {}),
        metadata={"userId": user_id},
    )
    return created.id
