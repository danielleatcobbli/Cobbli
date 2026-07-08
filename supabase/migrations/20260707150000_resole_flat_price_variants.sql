-- Full Resole is now a single flat price ($85) regardless of sole material.
-- Update both variants (leather and rubber) to 8500 cents standard and premium.

UPDATE public.service_variants
SET
  standard_cents = 8500,
  premium_cents  = 8500
WHERE service_id = (SELECT id FROM public.services WHERE slug = 'full-resole');
