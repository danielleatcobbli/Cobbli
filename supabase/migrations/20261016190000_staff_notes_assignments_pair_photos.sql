-- Records the workshop data the admin site already uses.
-- Checked against the live project on 2026-10-16: these tables and columns
-- are already there. This file only adds them when they are missing, so
-- applying it does not rewrite existing requests, repairs, photos, or notes.
--
-- Staff notes (order_notes, and the intake / outtake / QC text on
-- order_pairs) are readable only by staff and admins.
-- A customer can read pair-photo rows and files for their own order, and
-- still only their own orders. Assignment columns live on orders, which a
-- customer can already read for their own row; Postgres cannot hide those
-- columns from customers while staff read them, because both sign in as
-- the same database role.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS workshop_assignee uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispatch_assignee uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS action_required_by timestamptz,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_date date,
  ADD COLUMN IF NOT EXISTS pickup_time_label text,
  ADD COLUMN IF NOT EXISTS return_date date,
  ADD COLUMN IF NOT EXISTS return_time_label text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_team text;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS order_pair_id uuid,
  ADD COLUMN IF NOT EXISTS done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.order_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shoe_type text,
  shoe_brand text,
  shoe_color_material text,
  customer_notes text,
  intake_status text NOT NULL DEFAULT 'not-started',
  intake_notes text,
  completion_status text NOT NULL DEFAULT 'not-started',
  outtake_notes text,
  condition_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  qc_status text NOT NULL DEFAULT 'not-started',
  qc_notes text,
  qc_reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Columns the admin screen reads that an older copy of order_pairs may lack.
ALTER TABLE public.order_pairs
  ADD COLUMN IF NOT EXISTS qc_status text NOT NULL DEFAULT 'not-started',
  ADD COLUMN IF NOT EXISTS qc_notes text,
  ADD COLUMN IF NOT EXISTS qc_reviewed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pair_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_pair_id uuid NOT NULL REFERENCES public.order_pairs(id) ON DELETE CASCADE,
  side text NOT NULL,
  angle text,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_pair_id_fkey'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_order_pair_id_fkey
      FOREIGN KEY (order_pair_id) REFERENCES public.order_pairs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS order_pairs_order_id_idx ON public.order_pairs(order_id);
CREATE INDEX IF NOT EXISTS order_notes_order_id_idx ON public.order_notes(order_id);
CREATE INDEX IF NOT EXISTS pair_photos_order_pair_id_idx ON public.pair_photos(order_pair_id);
CREATE UNIQUE INDEX IF NOT EXISTS pair_photos_pair_side_angle_key
  ON public.pair_photos(order_pair_id, side, angle);

DROP TRIGGER IF EXISTS order_pairs_updated_at ON public.order_pairs;
CREATE TRIGGER order_pairs_updated_at
  BEFORE UPDATE ON public.order_pairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_pairs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pair_photos TO authenticated;
GRANT ALL ON public.order_pairs TO service_role;
GRANT ALL ON public.order_notes TO service_role;
GRANT ALL ON public.pair_photos TO service_role;

GRANT EXECUTE ON FUNCTION public.is_staff_or_admin(uuid) TO authenticated;

ALTER TABLE public.order_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pair_photos ENABLE ROW LEVEL SECURITY;

-- order_pairs holds intake, outtake, and QC notes. No customer policy.
DROP POLICY IF EXISTS "Staff view order pairs" ON public.order_pairs;
CREATE POLICY "Staff view order pairs" ON public.order_pairs
  FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff insert order pairs" ON public.order_pairs;
CREATE POLICY "Staff insert order pairs" ON public.order_pairs
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff update order pairs" ON public.order_pairs;
CREATE POLICY "Staff update order pairs" ON public.order_pairs
  FOR UPDATE TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff delete order pairs" ON public.order_pairs;
CREATE POLICY "Staff delete order pairs" ON public.order_pairs
  FOR DELETE TO authenticated USING (public.is_staff_or_admin(auth.uid()));

-- order_notes are internal. No customer policy.
DROP POLICY IF EXISTS "Staff view order notes" ON public.order_notes;
CREATE POLICY "Staff view order notes" ON public.order_notes
  FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff insert order notes" ON public.order_notes;
CREATE POLICY "Staff insert order notes" ON public.order_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff update order notes" ON public.order_notes;
CREATE POLICY "Staff update order notes" ON public.order_notes
  FOR UPDATE TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff delete order notes" ON public.order_notes;
CREATE POLICY "Staff delete order notes" ON public.order_notes
  FOR DELETE TO authenticated USING (public.is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Customers view own pair photos" ON public.pair_photos;
CREATE POLICY "Customers view own pair photos" ON public.pair_photos
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.order_pairs p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.id = pair_photos.order_pair_id
        AND o.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Staff view pair photos" ON public.pair_photos;
CREATE POLICY "Staff view pair photos" ON public.pair_photos
  FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff insert pair photos" ON public.pair_photos;
CREATE POLICY "Staff insert pair photos" ON public.pair_photos
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff update pair photos" ON public.pair_photos;
CREATE POLICY "Staff update pair photos" ON public.pair_photos
  FOR UPDATE TO authenticated USING (public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff delete pair photos" ON public.pair_photos;
CREATE POLICY "Staff delete pair photos" ON public.pair_photos
  FOR DELETE TO authenticated USING (public.is_staff_or_admin(auth.uid()));

-- Staff mark a service line done. Customers keep the own-row policies from
-- the original orders migration.
DROP POLICY IF EXISTS "Staff update order items" ON public.order_items;
CREATE POLICY "Staff update order items" ON public.order_items
  FOR UPDATE TO authenticated USING (public.is_staff_or_admin(auth.uid()));

-- Names for workshop and dispatch assignees. Staff can read profiles; they
-- cannot change someone else's profile.
DROP POLICY IF EXISTS "Staff view profiles" ON public.profiles;
CREATE POLICY "Staff view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_staff_or_admin(auth.uid()));

-- Workshop files are stored as <order id>/<pair id>/..., not under the
-- customer's user id. The older pair-photos policies only match that user
-- folder, so staff could not open them.
CREATE OR REPLACE FUNCTION public.owns_order_folder(_folder text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
BEGIN
  IF _folder IS NULL OR _folder !~ '^[0-9a-fA-F-]{36}$' THEN
    RETURN false;
  END IF;
  _id := _folder::uuid;
  RETURN EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = _id AND o.user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.owns_order_folder(text) TO authenticated;

DROP POLICY IF EXISTS "Customers read own order pair photos" ON storage.objects;
CREATE POLICY "Customers read own order pair photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'pair-photos'
    AND public.owns_order_folder((storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "Staff read pair photos" ON storage.objects;
CREATE POLICY "Staff read pair photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'pair-photos' AND public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff upload pair photos" ON storage.objects;
CREATE POLICY "Staff upload pair photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pair-photos' AND public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff update pair photos" ON storage.objects;
CREATE POLICY "Staff update pair photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pair-photos' AND public.is_staff_or_admin(auth.uid()));
DROP POLICY IF EXISTS "Staff delete pair photos" ON storage.objects;
CREATE POLICY "Staff delete pair photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pair-photos' AND public.is_staff_or_admin(auth.uid()));
