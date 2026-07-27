-- Link orders back to the source assessment so the admin dashboard can show
-- the original proposal (photos + proposed services) for traceability.
--
-- Nullable because:
--   • Orders placed via the standard checkout flow have no assessment.
--   • Orders created before this migration existed have no assessment.
--
-- ON DELETE SET NULL: if an assessment row is ever deleted, the order
-- record survives (it's the authoritative record of what was paid for).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS assessment_id uuid
    REFERENCES public.assessments(id) ON DELETE SET NULL;

-- Index makes it fast to look up "all orders that came from this proposal"
-- (useful for future admin tooling).
CREATE INDEX IF NOT EXISTS orders_assessment_id_idx ON public.orders (assessment_id)
  WHERE assessment_id IS NOT NULL;
