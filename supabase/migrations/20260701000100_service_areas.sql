-- Serviced ZIP codes, migrated out of the hardcoded src/data/serviceAreas.ts
-- so the Owner can manage coverage from the Settings area without a code change.
--
-- Read access is public (anon + authenticated) but limited to active rows, so
-- the checkout / address-validation paths can query it without auth. Writes are
-- restricted to owner/admin via has_role().

CREATE TABLE IF NOT EXISTS public.service_areas (
  zip TEXT PRIMARY KEY,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;

-- Public can read active service areas (needed by unauthenticated checkout paths).
DROP POLICY IF EXISTS "Anyone views active service areas" ON public.service_areas;
CREATE POLICY "Anyone views active service areas" ON public.service_areas
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- Owners and admins manage the full list.
DROP POLICY IF EXISTS "Owners manage service areas" ON public.service_areas;
CREATE POLICY "Owners manage service areas" ON public.service_areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER service_areas_updated_at BEFORE UPDATE ON public.service_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the beta-launch ZIPs previously hardcoded in serviceAreas.ts.
INSERT INTO public.service_areas (zip) VALUES
  ('10001'), ('10002'), ('10003'), ('10004'), ('10005'), ('10006'), ('10007'),
  ('10009'), ('10010'), ('10011'), ('10012'), ('10013'), ('10014'), ('10038'),
  ('10280'), ('10281'), ('10282')
ON CONFLICT (zip) DO NOTHING;
