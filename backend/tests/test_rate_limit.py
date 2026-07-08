from __future__ import annotations

import pytest

from app.rate_limit import RateLimiter, TokenBucket


def test_token_bucket_allows_up_to_capacity():
    bucket = TokenBucket(capacity=3, refill_rate=0.0)
    assert bucket.allow(now=0.0) is True
    assert bucket.allow(now=0.0) is True
    assert bucket.allow(now=0.0) is True
    # 4th within same instant, no refill -> denied
    assert bucket.allow(now=0.0) is False


def test_token_bucket_refills_over_time():
    bucket = TokenBucket(capacity=1, refill_rate=1.0)  # 1 token/sec
    assert bucket.allow(now=0.0) is True
    assert bucket.allow(now=0.0) is False
    # after 1 second, one token is back
    assert bucket.allow(now=1.0) is True


def test_rate_limiter_keys_are_independent():
    limiter = RateLimiter(capacity=1, refill_rate=0.0)
    assert limiter.check("1.1.1.1") is True
    assert limiter.check("1.1.1.1") is False
    # different key has its own bucket
    assert limiter.check("2.2.2.2") is True


def test_rate_limiter_reset():
    limiter = RateLimiter(capacity=1, refill_rate=0.0)
    assert limiter.check("k") is True
    assert limiter.check("k") is False
    limiter.reset()
    assert limiter.check("k") is True


@pytest.mark.asyncio
async def test_dependency_raises_429_when_exhausted():
    from fastapi import HTTPException

    limiter = RateLimiter(capacity=1, refill_rate=0.0)

    class _Client:
        host = "9.9.9.9"

    class _Req:
        client = _Client()

    req = _Req()
    await limiter(req)  # first allowed
    with pytest.raises(HTTPException) as exc:
        await limiter(req)
    assert exc.value.status_code == 429
