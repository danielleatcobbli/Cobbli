-- RLS foundation for the operations dashboard (the authoritative access layer).
--
-- Staff need read/write on the operational data (orders, order_items,
-- assessments, reworks) but NOT on settings/pricing/roles (admin only, already
-- enforced elsewhere). Customers keep own-row access only.
--
-- A SECURITY DEFINER helper keeps the policies readable and consistent.

-- The `reworks` table is referenced by the generated types but did not exist in
-- the live DB, so create it here (matches the typed shape). Rework requests link
-- an order to a set of in-scope services with a status.
CREATE TABLE IF NOT EXISTS public.reworks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  services_in_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reworks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin(_user_id uuid)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('staff', 'admin')
  );
$$;

-- ---- orders: staff+admin can view and update all ----
DROP POLICY IF EXISTS "Staff view all orders" ON public.orders;
CREATE POLICY "Staff view all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff update orders" ON public.orders;
CREATE POLICY "Staff update orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.is_staff_or_admin(auth.uid()));

-- ---- order_items: staff+admin can view all ----
DROP POLICY IF EXISTS "Staff view all order items" ON public.order_items;
CREATE POLICY "Staff view all order items" ON public.order_items
  FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));

-- ---- assessments: staff+admin can view and update all ----
DROP POLICY IF EXISTS "Staff view all assessments" ON public.assessments;
CREATE POLICY "Staff view all assessments" ON public.assessments
  FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff update all assessments" ON public.assessments;
CREATE POLICY "Staff update all assessments" ON public.assessments
  FOR UPDATE TO authenticated USING (public.is_staff_or_admin(auth.uid()));

-- ---- reworks: RLS was enabled with NO policies (nobody but service role can
-- touch it). Give customers own-row access and staff+admin full management. ----
DROP POLICY IF EXISTS "Users view own reworks" ON public.reworks;
CREATE POLICY "Users view own reworks" ON public.reworks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own reworks" ON public.reworks;
CREATE POLICY "Users insert own reworks" ON public.reworks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff view all reworks" ON public.reworks;
CREATE POLICY "Staff view all reworks" ON public.reworks
  FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff manage reworks" ON public.reworks;
CREATE POLICY "Staff manage reworks" ON public.reworks
  FOR UPDATE TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff insert reworks" ON public.reworks;
CREATE POLICY "Staff insert reworks" ON public.reworks
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin(auth.uid()));
