-- Authoritative prices for the legacy repair-package SKUs.
-- Package descriptive content remains in the frontend; checkout pricing is
-- always read from this server-managed table.

CREATE TABLE IF NOT EXISTS public.repair_packages (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.repair_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads active repair packages" ON public.repair_packages;
CREATE POLICY "Anyone reads active repair packages"
  ON public.repair_packages
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage repair packages" ON public.repair_packages;
CREATE POLICY "Admins manage repair packages"
  ON public.repair_packages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.repair_packages TO anon, authenticated;
GRANT ALL ON public.repair_packages TO service_role;

DROP TRIGGER IF EXISTS repair_packages_updated_at ON public.repair_packages;
CREATE TRIGGER repair_packages_updated_at
  BEFORE UPDATE ON public.repair_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.repair_packages (slug, name, price_cents, is_active) VALUES
  ('full-restoration', 'Full restoration', 25000, true),
  ('standard-service', 'Standard repair (sole, upper, & interior)', 20000, true),
  ('full-exterior-repair', 'Exterior repair (sole & upper)', 12500, true),
  ('upper-repair', 'Upper repair', 10000, true),
  ('interior-repair', 'Interior repair', 10000, true),
  ('sole-repair', 'Sole repair', 8500, true),
  ('preventative-care', 'Preventative care', 6000, true),
  ('just-a-shine', 'Just a Shine', 2000, true)
ON CONFLICT (slug) DO NOTHING;
