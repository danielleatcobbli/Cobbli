-- Service consolidations, removals, and full_description population.
-- Runs after 20260707120000 which set short_description to short card text.
-- full_description is used on detail pages where a richer description is needed.

-- ── Strap Repair — update name, card text, price ─────────────────────────────

UPDATE public.services SET
  name               = 'Strap Repair',
  short_description  = 'We reattach or tighten a strap that''s come loose or pulled away from your shoe',
  card_name          = 'Strap Repair',
  card_price_label   = '$45'
WHERE slug = 'strap-repair';

-- ── Buckle Repair — align with consolidated Hardware or Buckle Repair ─────────
-- buckle-repair is not shown on the services grid but may appear as a detail
-- page. Deactivate it so the URL redirects to /services.

UPDATE public.services SET
  is_active = false
WHERE slug = 'buckle-repair';

-- ── Removals — deactivate services not going to launch ───────────────────────

-- Patch repair / upper repair: no launch timeline confirmed
UPDATE public.services SET
  is_active = false
WHERE slug = 'patch-repair-upper-repair';

-- Zipper replacement: consolidated into Zipper Repair (zipper-reattachment)
UPDATE public.services SET
  is_active = false
WHERE slug = 'zipper-replacement';

-- Buckle replacement: hardware-replacement is the canonical coming-soon entry
UPDATE public.services SET
  is_active = false
WHERE slug = 'buckle-replacement';

-- ── full_description — richer detail-page descriptions ───────────────────────
-- Only set where meaningfully different from short_description.
-- ServiceDetail falls back to short_description when full_description is NULL.

UPDATE public.services SET full_description =
  'We add a thin, durable layer to the bottom of your shoe to protect it from wear. When it eventually wears down, we simply replace the protective layer — no invasive resole needed.'
WHERE slug = 'protective-full-sole';

UPDATE public.services SET full_description =
  'A worn sole doesn''t mean the end of a great shoe. We replace the sole completely, restoring the grip, structure, and feel you''ve been missing.'
WHERE slug = 'full-resole';

UPDATE public.services SET full_description =
  'The heel tip protects your heel from wear — replacing it early avoids more costly damage down the line. We always replace both heel tips together, so the pair looks and feels even.'
WHERE slug = 'high-heel-tip-replacement';

UPDATE public.services SET full_description =
  'We repair any damage or stains and, with your go-ahead, apply professional dye color-matched to your shoes to achieve a like-new appearance.'
WHERE slug = 'color-restoration';

UPDATE public.services SET full_description =
  'We replenish the natural oils in your leather or suede to make it soft, flexible, and protected from cracking. Think of it as moisturizer for your shoes.'
WHERE slug = 'leather-or-suede-conditioning';

UPDATE public.services SET full_description =
  'We patch holes, tears, or areas that have worn through on the inside of your shoe.'
WHERE slug = 'lining-repair';

UPDATE public.services SET full_description =
  'A split seam will keep spreading if left alone. We stitch it back together cleanly to stop further damage.'
WHERE slug = 'seam-repair';

UPDATE public.services SET full_description =
  'A strap that''s coming away or has loosened over time will only get worse if left alone. We reattach it securely or tighten it so your shoe fits and functions the way it should.'
WHERE slug = 'strap-repair';

UPDATE public.services SET full_description =
  'When a zipper gives out completely, we replace it with a new one matched closely to your shoe''s original style.'
WHERE slug = 'zipper-reattachment';

UPDATE public.services SET full_description =
  'We replace the zipper slider — the small piece you pull to zip — when it''s broken or missing.'
WHERE slug = 'zipper-slider-replacement';

UPDATE public.services SET full_description =
  'When a heel is missing or too damaged to save, we replace it completely — matched to your shoe so it looks and feels like it was always meant to be there.'
WHERE slug = 'heel-replacement';

UPDATE public.services SET full_description =
  'We stretch your shoes to give them a more comfortable fit — whether they''re tight around your toe, on the sides, or at the calf.'
WHERE slug = 'shoe-stretching';
