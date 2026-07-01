-- Owner-editable flat fees, previously hardcoded across the checkout/assessment
-- flow (courier fee, free-courier threshold, assessment deposit). Key/value in
-- cents so the Owner can adjust them from Settings without a code change.
--
-- Public read (checkout paths run unauthenticated); owner/admin manage.

CREATE TABLE IF NOT EXISTS public.pricing_config (
  key TEXT PRIMARY KEY,
  value_cents INTEGER NOT NULL,
  label TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads pricing config" ON public.pricing_config;
CREATE POLICY "Anyone reads pricing config" ON public.pricing_config
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Owners manage pricing config" ON public.pricing_config;
CREATE POLICY "Owners manage pricing config" ON public.pricing_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER pricing_config_updated_at BEFORE UPDATE ON public.pricing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with the current hardcoded values so behaviour is unchanged on launch.
INSERT INTO public.pricing_config (key, value_cents, label) VALUES
  ('courier_fee_cents', 1500, 'Courier fee'),
  ('free_courier_threshold_cents', 10000, 'Free courier threshold'),
  ('assessment_deposit_cents', 2000, 'Assessment deposit (per pair)')
ON CONFLICT (key) DO NOTHING;
