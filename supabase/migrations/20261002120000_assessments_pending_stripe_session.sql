-- Duplicate-payment fix, Item 1 follow-up (2026-10-02).
--
-- Tracks the one Stripe Checkout Session currently open for a given
-- request, so create_checkout.py can hand back that same session instead
-- of minting a second one when a customer reloads Checkout.tsx or opens it
-- in two tabs. Cleared by the webhook once that request's checkout attempt
-- resolves (order created, or confirmed a duplicate). Nullable, no backfill
-- needed — every existing row simply has no open session right now.
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS pending_stripe_session_id text;

COMMENT ON COLUMN public.assessments.pending_stripe_session_id IS
  'Set by POST /checkout/ when a Stripe Checkout Session is created for this request; cleared by the Stripe webhook once that attempt resolves. Used to prevent two simultaneously-open sessions (and so two possible successful charges) for the same request.';

-- Stale-session-selection fix, added same round (2026-10-02) before this
-- migration was ever applied — a SHA-256 over the canonical items/prices/
-- pickup window the pending session above was actually created from, so a
-- later request for the same assessment can tell "truly the same checkout
-- attempt, safe to resume" apart from "selections changed since, must not
-- reuse." See _fingerprint_cart / _reuse_open_session_client_secret in
-- create_checkout.py.
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS pending_stripe_session_fingerprint text;

COMMENT ON COLUMN public.assessments.pending_stripe_session_fingerprint IS
  'SHA-256 fingerprint (service ids, prices, pickup window) of the cart that produced pending_stripe_session_id. A mismatch on a later checkout attempt means selections changed since that session was created — the old session is expired rather than reused.';
