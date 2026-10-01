-- Deliberate complimentary-confirmation path (2026-10-01, Danielle's spec).
--
-- An explicit, staff-set flag — NOT inferred from price. A request whose
-- services simply haven't been priced yet also totals $0 (see "Price
-- pending assessment" in the My Repairs list / repair details page), and
-- that must never be confused with a request staff have deliberately
-- decided to comp. Default false, additive column, no backfill: every
-- existing row is unambiguously "not complimentary" by default, which is
-- correct — nothing historical was ever marked as such.
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS complimentary boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.assessments.complimentary IS
  'Staff-set only (Admin.tsx). True means this request''s approved services are deliberately free of charge — bypasses Stripe entirely via POST /checkout/confirm-complimentary — not merely unpriced.';
