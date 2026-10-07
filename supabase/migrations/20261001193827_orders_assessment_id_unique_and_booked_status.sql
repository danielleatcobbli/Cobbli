-- Request-to-order continuity fix (2026-10-01, Danielle's spec).
--
-- Two additive, non-destructive changes — no table rewrite, no data
-- migration, nothing backfilled or guessed for existing rows:
--
-- 1. A partial unique index on orders.assessment_id. This is the DB-level
--    backstop against double-charging a customer for the same accepted
--    assessment: if two checkout sessions for the same assessment both
--    somehow get paid (a double-click, a retried webhook, a race between
--    two tabs), the second order INSERT fails outright instead of silently
--    creating a second paid order. The webhook (backend/app/routes/
--    stripe_webhook.py) is updated separately to catch that failure
--    gracefully and treat it as "another delivery already handled this."
--    NULL assessment_id values (every historical order, and every future
--    order that didn't originate from a request) are explicitly exempt via
--    the WHERE clause — a unique index with no WHERE clause would treat
--    every NULL as colliding with no other NULL in Postgres, so this isn't
--    strictly required for correctness, but it's included for clarity and
--    so the index only ever has to enforce real values.
--
-- 2. Lets service-role code (the Stripe webhook) flip an assessment to
--    'booked' — the value the whole app already reads (Admin.tsx, the My
--    Repairs exclusion, AssessmentProposal.tsx/RepairDetails.tsx's
--    `alreadyBooked`) but that nothing has ever actually written (confirmed
--    2026-10-01: no RPC, trigger, or app code sets it anywhere live). No new
--    status value is introduced — this just makes the existing one real.
--    No RLS policy change needed for this: the webhook uses the Supabase
--    service-role client (get_supabase_admin()), which bypasses RLS
--    entirely, the same way it already does to insert orders/order_items.

CREATE UNIQUE INDEX IF NOT EXISTS orders_assessment_id_unique
  ON public.orders (assessment_id)
  WHERE assessment_id IS NOT NULL;
