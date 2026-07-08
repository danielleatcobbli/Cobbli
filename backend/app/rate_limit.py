from __future__ import annotations

import time
from threading import Lock

from fastapi import HTTPException, Request, status

# In-memory token-bucket rate limiter keyed by client IP. Suitable for the
# anon spam endpoints (coverage requests, anon service votes). This is a
# single-process best-effort backstop, not a distributed limiter — pair it
# with edge/CDN limits in production.


class TokenBucket:
    """Refilling token bucket. Not tied to any framework."""

    __slots__ = ("capacity", "refill_rate", "_tokens", "_updated")

    def __init__(self, capacity: int, refill_rate: float) -> None:
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self._tokens = float(capacity)
        self._updated = time.monotonic()

    def allow(self, now: float | None = None) -> bool:
        """Consume one token. Returns False when the bucket is empty."""
        current = time.monotonic() if now is None else now
        elapsed = max(0.0, current - self._updated)
        self._tokens = min(self.capacity, self._tokens + elapsed * self.refill_rate)
        self._updated = current
        if self._tokens < 1.0:
            return False
        self._tokens -= 1.0
        return True


class RateLimiter:
    """Thread-safe registry of per-key token buckets, usable as a FastAPI dep."""

    def __init__(self, *, capacity: int, refill_rate: float) -> None:
        self._capacity = capacity
        self._refill_rate = refill_rate
        self._buckets: dict[str, TokenBucket] = {}
        self._lock = Lock()

    def _bucket_for(self, key: str) -> TokenBucket:
        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = TokenBucket(self._capacity, self._refill_rate)
                self._buckets[key] = bucket
            return bucket

    def check(self, key: str) -> bool:
        return self._bucket_for(key).allow()

    def reset(self) -> None:
        """Clear all buckets — primarily for test isolation."""
        with self._lock:
            self._buckets.clear()

    async def __call__(self, request: Request) -> None:
        client = request.client
        key = client.host if client and client.host else "unknown"
        if not self.check(key):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many requests — slow down and try again shortly.",
            )


# Shared limiter for anon spam endpoints: 10 requests, refilling ~1 every 6s.
anon_rate_limiter = RateLimiter(capacity=10, refill_rate=1.0 / 6.0)
