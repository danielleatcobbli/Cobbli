-- The guest checkout policy added in 20260924000000 was described as
-- "fetch one order you already know the id for." The rule itself was
-- USING (user_id IS NULL), which lets any visitor list every guest order,
-- including the delivery address and email. Row filters in the app do not
-- close that; the database was returning every matching row.
--
-- Drop those list policies. A guest still recovers the order they just
-- placed by passing its id or Stripe session id to a function. Both values
-- are unguessable, and the function returns at most one row. Signed-in
-- customers keep reading their own orders through the existing policies.

DROP POLICY IF EXISTS "Guests view own orders by id" ON public.orders;
DROP POLICY IF EXISTS "Guests view own order items" ON public.order_items;

CREATE OR REPLACE FUNCTION public.get_guest_order_by_session(_stripe_session_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', o.id,
    'total_cents', o.total_cents
  )
  FROM public.orders o
  WHERE _stripe_session_id IS NOT NULL
    AND length(trim(_stripe_session_id)) > 0
    AND o.user_id IS NULL
    AND o.stripe_session_id = _stripe_session_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_guest_order(_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'status', o.status,
    'contact_email', o.contact_email,
    'delivery_address', o.delivery_address,
    'repairs_subtotal_cents', o.repairs_subtotal_cents,
    'courier_fee_cents', o.courier_fee_cents,
    'total_cents', o.total_cents,
    'order_items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'pair_snapshot', i.pair_snapshot,
        'service_snapshot', i.service_snapshot,
        'price_cents', i.price_cents
      ))
      FROM public.order_items i
      WHERE i.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM public.orders o
  WHERE o.id = _id
    AND o.user_id IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_guest_order_by_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_guest_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_order_by_session(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_guest_order(uuid) TO anon;
