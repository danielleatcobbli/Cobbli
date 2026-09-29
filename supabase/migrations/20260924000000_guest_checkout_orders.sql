-- Guest checkout (2026-09-24, Danielle's call): orders.user_id must become
-- nullable so a guest (no Supabase account) can place a real order, and we
-- need a way for that guest's own browser to read the order back right
-- after paying (Checkout.tsx polls `orders` by stripe_session_id, then
-- OrderConfirmation reads it by id) even though they have no auth session.
--
-- Security model: guest orders are matched by knowing the order's own id or
-- stripe_session_id — both opaque, unguessable UUID-style values that are
-- never listed or enumerable, only ever handed back to the browser that
-- just created that specific row. This mirrors the existing
-- assessments.proposal_token pattern and the existing (pre-guest-checkout)
-- stripe_session_id lookup Checkout.tsx already does. It does NOT let an
-- anonymous visitor browse or list guest orders — only fetch one they
-- already hold the id/session id for.

ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

DROP POLICY IF EXISTS "Guests view own orders by id" ON public.orders;
CREATE POLICY "Guests view own orders by id" ON public.orders
  FOR SELECT TO anon
  USING (user_id IS NULL);

-- OrderConfirmation.tsx joins order_items onto the same query, so guests
-- need the matching read on order_items for guest-owned orders too.
DROP POLICY IF EXISTS "Guests view own order items" ON public.order_items;
CREATE POLICY "Guests view own order items" ON public.order_items
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND o.user_id IS NULL
    )
  );
