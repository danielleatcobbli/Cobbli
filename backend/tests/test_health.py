"""Smoke test for the FastAPI app skeleton."""

from __future__ import annotations


def test_health(client) -> None:
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert "version" in body


def test_root_returns_health(client) -> None:
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
