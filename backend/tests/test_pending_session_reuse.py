from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.routes.create_checkout import (
    _fingerprint_cart,
    _reuse_open_session_client_secret,
    _record_pending_session,
)
from app.routes.stripe_webhook import _clear_pending_session

# 2026-10-02: unit coverage for the duplicate-payment fix (Item 1 follow-up)
# and the stale-session-selection fix (Item 2 follow-up, same round) — a
# second Stripe Checkout Session should never be created for a request that
# already has one open AND unchanged, and a session whose selections have
# since changed must never be silently reused. These test the functions
# directly rather than the full /checkout/ endpoint, since that endpoint's
# existing test fixtures have the OptionalUser/require_user override bug
# documented in test_confirm_complimentary.py.


def _sb_with_pending(session_id: str | None, fingerprint: str | None = None):
    sb = MagicMock()
    select_chain = MagicMock()
    select_chain.eq.return_value = select_chain
    select_chain.maybe_single.return_value = select_chain
    select_chain.execute.return_value = SimpleNamespace(
        data={
            "pending_stripe_session_id": session_id,
            "pending_stripe_session_fingerprint": fingerprint,
        },
        error=None,
    )
    sb.table.return_value.select.return_value = select_chain
    update_chain = MagicMock()
    sb.table.return_value.update.return_value = update_chain
    update_chain.eq.return_value.execute.return_value = SimpleNamespace(data=None, error=None)
    return sb, select_chain, update_chain


def _payload(price=8000, pickup_start="2026-10-05T14:00:00Z"):
    return {
        "items": [
            {
                "service_snapshot": {"id": "resole"},
                "price_cents": price,
                "pair_snapshot": {"id": "pair-1"},
            }
        ],
        "pickup_window": {"start": pickup_start, "end": "2026-10-05T15:30:00Z", "address": "1 Main St"},
        "total_cents": price,
    }


def test_fingerprint_is_stable_for_identical_payload():
    assert _fingerprint_cart(_payload()) == _fingerprint_cart(_payload())


def test_fingerprint_changes_when_price_changes():
    assert _fingerprint_cart(_payload(price=8000)) != _fingerprint_cart(_payload(price=9000))


def test_fingerprint_changes_when_pickup_window_changes():
    assert _fingerprint_cart(_payload()) != _fingerprint_cart(
        _payload(pickup_start="2026-10-06T14:00:00Z")
    )


def test_reuse_returns_none_when_nothing_pending():
    sb, _, _ = _sb_with_pending(None)
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb):
        assert _reuse_open_session_client_secret("asm-1", "fp-a") is None


def test_reuse_returns_existing_client_secret_when_fingerprint_matches():
    sb, _, _ = _sb_with_pending("cs_open_1", fingerprint="fp-a")
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb), patch(
        "app.routes.create_checkout.stripe.checkout.Session.retrieve",
        return_value={"status": "open", "client_secret": "secret_reused"},
    ):
        result = _reuse_open_session_client_secret("asm-1", "fp-a")
    assert result == "secret_reused"


def test_reuse_expires_session_and_returns_none_when_selections_changed():
    """The core of the stale-session-selection fix: an open session whose
    fingerprint no longer matches what's being submitted must be expired —
    never silently handed back with the customer's old selections."""
    sb, _select, update_chain = _sb_with_pending("cs_open_1", fingerprint="fp-old")
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb), patch(
        "app.routes.create_checkout.stripe.checkout.Session.retrieve",
        return_value={"status": "open", "client_secret": "secret_stale"},
    ) as retrieve_mock, patch(
        "app.routes.create_checkout.stripe.checkout.Session.expire"
    ) as expire_mock:
        result = _reuse_open_session_client_secret("asm-1", "fp-new")
    assert result is None
    retrieve_mock.assert_called_once_with("cs_open_1")
    expire_mock.assert_called_once_with("cs_open_1")
    sb.table.return_value.update.assert_called_with(
        {"pending_stripe_session_id": None, "pending_stripe_session_fingerprint": None}
    )


def test_reuse_clears_and_returns_none_for_expired_session():
    sb, _, _ = _sb_with_pending("cs_expired_1", fingerprint="fp-a")
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb), patch(
        "app.routes.create_checkout.stripe.checkout.Session.retrieve",
        return_value={"status": "expired", "client_secret": "secret_stale"},
    ):
        result = _reuse_open_session_client_secret("asm-1", "fp-a")
    assert result is None
    sb.table.return_value.update.assert_called_with(
        {"pending_stripe_session_id": None, "pending_stripe_session_fingerprint": None}
    )


def test_reuse_treats_stripe_retrieve_failure_as_no_reusable_session():
    """If Stripe can't be reached, fail open to creating a new session rather
    than blocking checkout entirely — never silently reuse a session we
    couldn't actually verify is still valid."""
    sb, _, _ = _sb_with_pending("cs_unreachable", fingerprint="fp-a")
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb), patch(
        "app.routes.create_checkout.stripe.checkout.Session.retrieve",
        side_effect=Exception("network error"),
    ):
        result = _reuse_open_session_client_secret("asm-1", "fp-a")
    assert result is None


def test_record_pending_session_writes_session_id_and_fingerprint():
    sb = MagicMock()
    update_chain = MagicMock()
    sb.table.return_value.update.return_value = update_chain
    update_chain.eq.return_value.execute.return_value = SimpleNamespace(data=None, error=None)
    with patch("app.routes.create_checkout.get_supabase_admin", return_value=sb):
        _record_pending_session("asm-1", "cs_new_1", "fp-new")
    sb.table.return_value.update.assert_called_with(
        {"pending_stripe_session_id": "cs_new_1", "pending_stripe_session_fingerprint": "fp-new"}
    )
    sb.table.return_value.update.return_value.eq.assert_called_with("id", "asm-1")


def test_clear_pending_session_is_noop_without_assessment_id():
    sb = MagicMock()
    _clear_pending_session(sb, None)
    sb.table.assert_not_called()


def test_clear_pending_session_clears_both_columns():
    sb = MagicMock()
    update_chain = MagicMock()
    sb.table.return_value.update.return_value = update_chain
    update_chain.eq.return_value.execute.return_value = SimpleNamespace(data=None, error=None)
    _clear_pending_session(sb, "asm-1")
    sb.table.return_value.update.assert_called_with(
        {"pending_stripe_session_id": None, "pending_stripe_session_fingerprint": None}
    )
