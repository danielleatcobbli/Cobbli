from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Ensure the `app` package on the project root is importable from tests.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


@pytest.fixture(autouse=True)
def _set_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Default safe env for every test; individual tests override as needed."""
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_dummy")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_test_dummy")
    monkeypatch.setenv("BREVO_API_KEY", "brevo-test")
    monkeypatch.setenv("AI_API_KEY", "ai-test")
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "*")
    monkeypatch.setenv("SITE_URL", "https://test.cobbli.com")

    # Reset cached settings so the new env is picked up
    from app.settings import get_settings  # noqa: PLC0415
    get_settings.cache_clear()


def _fake_user():
    from app.auth import AuthUser  # noqa: PLC0415

    return AuthUser(
        id="00000000-0000-0000-0000-000000000001",
        email="test-user@example.com",
        access_token="test-token",
    )


@pytest.fixture
def client():
    """TestClient with auth pre-resolved to a fake user.

    Use `unauth_client` instead when explicitly testing 401 behavior.
    """
    from fastapi.testclient import TestClient  # noqa: PLC0415

    from app.auth import require_user  # noqa: PLC0415
    from app.main import create_app  # noqa: PLC0415

    app = create_app()
    app.dependency_overrides[require_user] = _fake_user
    return TestClient(app)


@pytest.fixture
def unauth_client():
    """TestClient with no auth override — use to test 401 paths."""
    from fastapi.testclient import TestClient  # noqa: PLC0415

    from app.main import create_app  # noqa: PLC0415
    return TestClient(create_app())


# Make sure the package can locate the app dir
os.environ.setdefault("PYTHONPATH", str(ROOT))
