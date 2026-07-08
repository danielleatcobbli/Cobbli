from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock

from app.auth import AuthUser, require_admin


def _admin_user():
    return AuthUser(id="admin-1", email="admin@example.com", access_token="tok")


def _mock(rows):
    chain = MagicMock()
    for m in ("select", "eq", "order", "maybe_single", "insert", "update", "delete"):
        getattr(chain, m).return_value = chain
    chain.execute.return_value = SimpleNamespace(data=rows, error=None)
    sb = MagicMock()
    sb.table.return_value = chain
    return sb, chain


def _override_admin(client):
    client.app.dependency_overrides[require_admin] = _admin_user


def _clear_admin(client):
    client.app.dependency_overrides.pop(require_admin, None)


# ---- auth / role gating ----


def test_list_posts_requires_auth(unauth_client):
    res = unauth_client.get("/ops/blog/posts")
    assert res.status_code == 401


def test_list_posts_forbidden_for_staff(client, monkeypatch):
    # staff role is NOT admin -> 403 on admin-gated route
    monkeypatch.setattr("app.auth._roles_for", lambda _uid: {"staff"})
    res = client.get("/ops/blog/posts")
    assert res.status_code == 403


def test_create_forbidden_for_non_admin(client, monkeypatch):
    monkeypatch.setattr("app.auth._roles_for", lambda _uid: {"customer"})
    res = client.post("/ops/blog/posts", json={"title": "x", "slug": "x"})
    assert res.status_code == 403


# ---- happy paths ----


def test_list_posts_happy(client, monkeypatch):
    _override_admin(client)
    rows = [{"id": "p1", "status": "draft"}]
    sb, _c = _mock(rows)
    monkeypatch.setattr("app.routes.ops_blog.get_supabase_for_user", lambda _t: sb)
    res = client.get("/ops/blog/posts")
    assert res.status_code == 200, res.text
    assert res.json() == {"data": rows}
    _clear_admin(client)


def test_create_derives_author_id(client, monkeypatch):
    _override_admin(client)
    created = [{"id": "p1", "author_id": "admin-1", "slug": "hello"}]
    sb, chain = _mock(created)
    monkeypatch.setattr("app.routes.ops_blog.get_supabase_for_user", lambda _t: sb)
    # client attempts to spoof author_id; route must ignore it
    res = client.post(
        "/ops/blog/posts",
        json={"title": "Hello", "slug": "hello", "author_id": "someone-else"},
    )
    assert res.status_code == 201, res.text
    inserted = chain.insert.call_args.args[0]
    assert inserted["author_id"] == "admin-1"
    assert res.json()["data"]["author_id"] == "admin-1"
    _clear_admin(client)


def test_create_invalid_status(client, monkeypatch):
    _override_admin(client)
    res = client.post(
        "/ops/blog/posts",
        json={"title": "x", "slug": "x", "status": "live"},
    )
    assert res.status_code == 400
    _clear_admin(client)


def test_patch_post_happy(client, monkeypatch):
    _override_admin(client)
    rows = [{"id": "p1", "title": "New"}]
    sb, _c = _mock(rows)
    monkeypatch.setattr("app.routes.ops_blog.get_supabase_for_user", lambda _t: sb)
    res = client.patch("/ops/blog/posts/p1", json={"title": "New"})
    assert res.status_code == 200, res.text
    assert res.json() == {"data": rows[0]}
    _clear_admin(client)


def test_patch_post_no_fields(client, monkeypatch):
    _override_admin(client)
    res = client.patch("/ops/blog/posts/p1", json={})
    assert res.status_code == 400
    _clear_admin(client)


def test_delete_post_happy(client, monkeypatch):
    _override_admin(client)
    sb, _c = _mock([])
    monkeypatch.setattr("app.routes.ops_blog.get_supabase_for_user", lambda _t: sb)
    res = client.delete("/ops/blog/posts/p1")
    assert res.status_code == 200, res.text
    assert res.json() == {"ok": True}
    _clear_admin(client)


# ---- public reads (no auth) ----


def test_public_list_published_no_auth(unauth_client, monkeypatch):
    rows = [{"id": "p1", "status": "published"}]
    sb, chain = _mock(rows)
    monkeypatch.setattr("app.routes.ops_blog.get_supabase_admin", lambda: sb)
    res = unauth_client.get("/blog/posts")
    assert res.status_code == 200, res.text
    assert res.json() == {"data": rows}
    chain.eq.assert_any_call("status", "published")


def test_public_get_by_slug_enforces_published(unauth_client, monkeypatch):
    sb, chain = _mock({"id": "p1", "slug": "hi", "status": "published"})
    monkeypatch.setattr("app.routes.ops_blog.get_supabase_admin", lambda: sb)
    res = unauth_client.get("/blog/posts/hi")
    assert res.status_code == 200, res.text
    chain.eq.assert_any_call("status", "published")


def test_public_get_by_slug_not_found(unauth_client, monkeypatch):
    sb, _c = _mock(None)
    monkeypatch.setattr("app.routes.ops_blog.get_supabase_admin", lambda: sb)
    res = unauth_client.get("/blog/posts/missing")
    assert res.status_code == 404
