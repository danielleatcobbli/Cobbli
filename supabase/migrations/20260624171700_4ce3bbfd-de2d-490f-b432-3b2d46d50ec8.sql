
-- 1. services: add new columns + relax constraints
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_coming_soon boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS card_name text,
  ADD COLUMN IF NOT EXISTS card_price_label text,
  ADD COLUMN IF NOT EXISTS qa_config jsonb,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.services
  ALTER COLUMN eligible_shoe_types SET DEFAULT ARRAY[]::text[];

-- 2. New service_variants table (replaces shoe-type-based service_pricing for display)
CREATE TABLE IF NOT EXISTS public.service_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  variant_key text NOT NULL,
  variant_label text NOT NULL DEFAULT '',
  standard_cents integer NOT NULL,
  premium_cents integer,
  rank integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, variant_key)
);

GRANT SELECT ON public.service_variants TO anon, authenticated;
GRANT ALL ON public.service_variants TO service_role;
ALTER TABLE public.service_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_variants are public readable"
  ON public.service_variants FOR SELECT
  USING (true);

-- 3. service_votes (coming-soon voting)
CREATE TABLE IF NOT EXISTS public.service_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_id, user_id)
);

GRANT SELECT ON public.service_votes TO anon, authenticated;
GRANT INSERT, DELETE ON public.service_votes TO authenticated;
GRANT ALL ON public.service_votes TO service_role;
ALTER TABLE public.service_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes are public readable for counts"
  ON public.service_votes FOR SELECT
  USING (true);

CREATE POLICY "users insert own votes on coming-soon services"
  ON public.service_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_id AND s.is_coming_soon = true
    )
  );

CREATE POLICY "users delete own votes"
  ON public.service_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 4. Clear existing services + dependent rows and reseed
DELETE FROM public.service_pricing;
DELETE FROM public.service_variants;
DELETE FROM public.services;

-- Helper temp insert via WITH chains. Doing 24 services + variants inline.
WITH ins AS (
  INSERT INTO public.services
    (slug, name, short_description, categories, popularity_rank, is_active, is_coming_soon, card_name, card_price_label, qa_config, eligible_shoe_types)
  VALUES
    -- ============ LAUNCH (active) ============
    ('protective-full-sole',
      'Protective full sole',
      'We add a thin, durable layer to the bottom of your shoe to protect it from wear. When it eventually wears down, we simply replace the protective layer — no invasive resole needed.',
      ARRAY['Bottom of shoe & heel','Preventative care'], 10, true, false,
      'Sole needs protective layer', '$55–$60', NULL, ARRAY[]::text[]),

    ('full-resole',
      'Full resole',
      'A worn sole doesn''t mean the end of a great shoe. We replace the sole completely, restoring the grip, structure, and feel you''ve been missing.',
      ARRAY['Bottom of shoe & heel'], 20, true, false,
      'Entire sole is worn or damaged', '$70–$95',
      jsonb_build_object(
        'question','What does the bottom of your shoe look like?',
        'hint','Not sure? Select let us assess — we''ll confirm the right material before any work begins.',
        'options', jsonb_build_array(
          jsonb_build_object('label','Leather','variantKey','leather'),
          jsonb_build_object('label','Rubber','variantKey','rubber'),
          jsonb_build_object('label','Let us assess — we''ll confirm before starting','variantKey','leather','priceLabel','from $70','note','held at leather rate, refunded if rubber')
        )
      ),
      ARRAY[]::text[]),

    ('high-heel-tip-replacement',
      'High heel tip replacement',
      'The small rubber or plastic cap at the very bottom of your heel takes the most wear. We replace it before it wears through to the heel itself, preventing more costly damage.',
      ARRAY['Bottom of shoe & heel'], 30, true, false,
      'Worn or missing heel tip', '$25', NULL, ARRAY[]::text[]),

    ('heel-reattachment',
      'Heel reattachment',
      'If your heel is wobbling or has come loose, we re-secure it so your shoe is stable and safe to wear again.',
      ARRAY['Bottom of shoe & heel'], 40, true, false,
      'Heel is loose or has broken off at the base', '$70–$85', NULL, ARRAY[]::text[]),

    ('color-restoration',
      'Color restoration',
      'We repair any damage or stains, condition your shoes, and — with your go-ahead — apply professional dye color-matched to your shoes to achieve a like-new appearance.',
      ARRAY['Color, scuffs, & shine'], 50, true, false,
      'Scratches & stains', '$75–$90',
      jsonb_build_object(
        'question','Can we use professional, color-matched dye on your shoes?',
        'hint','If your shoe has experienced wear, scratches, or stains, dye is the only way to fully restore it. Without it, we can improve the appearance but can''t guarantee a complete color match.',
        'options', jsonb_build_array(
          jsonb_build_object('label','Yes — do whatever it takes to get the best result'),
          jsonb_build_object('label','No — use polish or cream only, even if the result is limited')
        )
      ),
      ARRAY[]::text[]),

    ('leather-or-suede-conditioning',
      'Leather or suede conditioning',
      'We replenish the natural oils in your leather or suede to make it soft, flexible, and protected from cracking. Think of it as moisturiser for your shoes.',
      ARRAY['Cleaning','Color, scuffs, & shine'], 60, true, false,
      'Dull or dry suede or leather', '$50–$55', NULL, ARRAY[]::text[]),

    ('deep-clean',
      'Deep clean',
      'We remove dirt, stains, and surface grime from your shoes using professional-grade cleaners. Perfect when your shoes need more than a shine but don''t need a full conditioning.',
      ARRAY['Cleaning','Color, scuffs, & shine'], 70, true, false,
      'Shoes are dirty or dull', '$60–$70', NULL, ARRAY[]::text[]),

    ('shoe-shine',
      'Shoe shine',
      'We restore the gloss to your shoes, leaving them looking sharp and well-maintained.',
      ARRAY['Cleaning','Color, scuffs, & shine'], 80, true, false,
      'Shoe shine', '$20', NULL, ARRAY[]::text[]),

    ('lining-repair',
      'Lining repair',
      'We repair or replace the inner lining of your shoe, fixing tears, holes, or areas that have worn through.',
      ARRAY['Inside of shoe','Tears & holes'], 90, true, false,
      'There''s a hole or tear inside my shoe', '$65–$80', NULL, ARRAY[]::text[]),

    ('seam-repair',
      'Seam repair',
      'A split seam will keep spreading if left alone. We stitch it back together cleanly to stop further damage.',
      ARRAY['Tears & holes'], 100, true, false,
      'My shoe is separating at the seam', '$45–$60', NULL, ARRAY[]::text[]),

    ('waterproofing',
      'Waterproofing',
      'We apply a protective waterproof barrier to protect your shoes from rain and moisture.',
      ARRAY['Preventative care'], 110, true, false,
      'Shoes need to be waterproofed', '$25 / $30 / $35', NULL, ARRAY[]::text[]),

    ('buckle-repair',
      'Buckle repair',
      'Loose or detached hardware means your shoes are out of rotation. We re-secure your buckle so you can wear them again.',
      ARRAY['Straps, buckles, & hardware'], 120, true, false,
      'Buckle is loose or has come off', '$40–$50', NULL, ARRAY[]::text[]),

    ('strap-repair',
      'Strap repair',
      'A strap that''s coming away will only get worse. We re-secure it to restore the function and appearance of your shoe.',
      ARRAY['Straps, buckles, & hardware'], 130, true, false,
      'Strap is loose or has come off', '$40–$50', NULL, ARRAY[]::text[]),

    ('hardware-repair',
      'Hardware repair',
      'Loose or detached hardware means your shoes are out of rotation. We re-secure it so you can wear them again.',
      ARRAY['Straps, buckles, & hardware'], 140, true, false,
      'Hardware is loose or has come off', '$40–$50', NULL, ARRAY[]::text[]),

    ('zipper-reattachment',
      'Zipper reattachment',
      'We re-stitch or reattach a zipper that has separated from the shoe without replacing the zipper itself.',
      ARRAY['Zipper'], 150, true, false,
      'Zipper is separating from shoe', '$50–$60', NULL, ARRAY[]::text[]),

    ('zipper-slider-replacement',
      'Zipper slider replacement',
      'We replace the zipper slider — the small piece you pull to zip — when it''s broken or missing.',
      ARRAY['Zipper'], 160, true, false,
      'Zipper slider is broken or missing', '$35–$45', NULL, ARRAY[]::text[]),

    -- ============ COMING SOON ============
    ('heel-replacement',
      'Heel replacement',
      'When a heel is missing or too damaged to save, we replace it completely — matched to your shoe so it looks and feels like it was always meant to be there.',
      ARRAY['Bottom of shoe & heel'], 200, true, true,
      'Heel is cracked, broken through the body of the heel, or missing entirely', '$100–$125', NULL, ARRAY[]::text[]),

    ('full-dye',
      'Full dye',
      'We refresh your shoes by dyeing them an entirely new color.',
      ARRAY['Color, scuffs, & shine'], 210, true, true,
      'I want to change the color of my shoes', '$110–$125', NULL, ARRAY[]::text[]),

    ('deodorizing-treatment',
      'Deodorizing treatment',
      'We treat the inside of your shoes with a professional deodorizing treatment that eliminates smell at the source.',
      ARRAY['Cleaning'], 220, true, true,
      'Shoes smell', '$25', NULL, ARRAY[]::text[]),

    ('shoe-stretching',
      'Shoe stretching',
      'We stretch your shoes to give them a more comfortable fit — whether they''re tight around your toe, on the sides, or at the calf.',
      ARRAY['Fit'], 230, true, true,
      'Shoes are too tight', '$35–$45', NULL, ARRAY[]::text[]),

    ('insole-replacement',
      'Insole replacement',
      'We replace the cushioned inner sole of your shoe to restore comfort and support underfoot.',
      ARRAY['Fit','Inside of shoe','Preventative care'], 240, true, true,
      'Insole is worn or uncomfortable', '$40–$45', NULL, ARRAY[]::text[]),

    ('patch-repair-upper-repair',
      'Patch repair / upper repair',
      'Holes and tears don''t have to mean the end of the road for your shoe. We repair the damaged area to stop it from spreading and restore the structure of your shoe.',
      ARRAY['Tears & holes'], 250, true, true,
      'There''s a hole or tear on the outside of my shoe', '$75–$90', NULL, ARRAY[]::text[]),

    ('buckle-replacement',
      'Buckle replacement',
      'When a buckle is missing or beyond saving, we source and install a matching replacement to restore the look of your shoe.',
      ARRAY['Straps, buckles, & hardware'], 260, true, true,
      'Buckle is missing or damaged', '$65–$75', NULL, ARRAY[]::text[]),

    ('hardware-replacement',
      'Hardware replacement',
      'When your hardware is broken or can''t be saved, we source and install a matching replacement to restore the look and function of your shoe.',
      ARRAY['Straps, buckles, & hardware'], 270, true, true,
      'Hardware is lost or damaged', '$65–$75', NULL, ARRAY[]::text[]),

    ('zipper-replacement',
      'Zipper replacement',
      'When a zipper gives out completely, we replace it with a new one matched as closely as possible to your shoe''s original style.',
      ARRAY['Zipper'], 280, true, true,
      'Zipper won''t zip', '$70–$85', NULL, ARRAY[]::text[])
  RETURNING id, slug
)
INSERT INTO public.service_variants (service_id, variant_key, variant_label, standard_cents, premium_cents, rank)
SELECT id, v.variant_key, v.variant_label, v.standard_cents, v.premium_cents, v.rank
FROM ins
JOIN (VALUES
  -- launch
  ('protective-full-sole', 'default', '', 5500, 6000, 0),
  ('full-resole', 'leather', 'Leather', 8000, 9500, 0),
  ('full-resole', 'rubber', 'Rubber', 7000, 8500, 1),
  ('high-heel-tip-replacement', 'default', '', 2500, NULL, 0),
  ('heel-reattachment', 'default', '', 7000, 8500, 0),
  ('color-restoration', 'default', '', 7500, 9000, 0),
  ('leather-or-suede-conditioning', 'default', '', 5000, 5500, 0),
  ('deep-clean', 'default', '', 6000, 7000, 0),
  ('shoe-shine', 'default', '', 2000, NULL, 0),
  ('lining-repair', 'default', '', 6500, 8000, 0),
  ('seam-repair', 'default', '', 4500, 6000, 0),
  ('waterproofing', 'other', 'All other shoes', 2500, NULL, 0),
  ('waterproofing', 'ankle_boots', 'Ankle boots', 3000, NULL, 1),
  ('waterproofing', 'boots', 'Boots', 3500, NULL, 2),
  ('buckle-repair', 'default', '', 4000, 5000, 0),
  ('strap-repair', 'default', '', 4000, 5000, 0),
  ('hardware-repair', 'default', '', 4000, 5000, 0),
  ('zipper-reattachment', 'default', '', 5000, 6000, 0),
  ('zipper-slider-replacement', 'default', '', 3500, 4500, 0),
  -- coming soon
  ('heel-replacement', 'default', '', 10000, 12500, 0),
  ('full-dye', 'default', '', 11000, 12500, 0),
  ('deodorizing-treatment', 'default', '', 2500, NULL, 0),
  ('shoe-stretching', 'default', '', 3500, 4500, 0),
  ('insole-replacement', 'default', '', 4000, 4500, 0),
  ('patch-repair-upper-repair', 'default', '', 7500, 9000, 0),
  ('buckle-replacement', 'default', '', 6500, 7500, 0),
  ('hardware-replacement', 'default', '', 6500, 7500, 0),
  ('zipper-replacement', 'default', '', 7000, 8500, 0)
) AS v(slug, variant_key, variant_label, standard_cents, premium_cents, rank)
  ON v.slug = ins.slug;
