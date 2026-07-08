-- Update service names, descriptions, card_price_label, and card_name
-- to reflect the new flat-pricing design and consolidated naming.
-- Also activates insole-replacement and deodorizing-treatment (was coming-soon).

-- ── Active services ──────────────────────────────────────────────────────────

UPDATE public.services SET
  name               = 'Protective Soles',
  short_description  = 'We apply protective soles to extend the life of your shoe',
  card_name          = 'Protective Soles',
  card_price_label   = '$50'
WHERE slug = 'protective-full-sole';

UPDATE public.services SET
  name               = 'Resole',
  short_description  = 'We replace worn or damaged soles',
  card_name          = 'Resole',
  card_price_label   = '$85'
WHERE slug = 'full-resole';

UPDATE public.services SET
  name               = 'Heel Tip Repair',
  short_description  = 'We replace worn or missing heel tips',
  card_name          = 'Heel Tip Repair',
  card_price_label   = '$35'
WHERE slug = 'high-heel-tip-replacement';

UPDATE public.services SET
  name               = 'Heel Repair',
  short_description  = 'We reattach and reinforce a loose or detached heel',
  card_name          = 'Heel Repair',
  card_price_label   = '$100'
WHERE slug = 'heel-reattachment';

UPDATE public.services SET
  name               = 'Scuff, stain & color restoration',
  short_description  = 'We repair any damage or stains and, if you approve it, apply color-matched paint or dye for a like-new appearance',
  card_name          = 'Scuff, stain & color restoration',
  card_price_label   = '$80'
WHERE slug = 'color-restoration';

UPDATE public.services SET
  name               = 'Cleaning & Conditioning',
  short_description  = 'We clean and replenish the natural oils in your leather or suede',
  card_name          = 'Cleaning & Conditioning',
  card_price_label   = '$65'
WHERE slug = 'leather-or-suede-conditioning';

-- Activated: was coming-soon, now live
UPDATE public.services SET
  name               = 'Deodorizing Treatment',
  short_description  = 'We eliminate smell at the source with professional deodorizing treatment',
  card_name          = 'Deodorizing Treatment',
  card_price_label   = '$50',
  is_coming_soon     = false
WHERE slug = 'deodorizing-treatment';

UPDATE public.services SET
  name               = 'Shoe Shine',
  short_description  = 'We polish and shine your shoes to restore gloss',
  card_name          = 'Shoe Shine',
  card_price_label   = '$20'
WHERE slug = 'shoe-shine';

-- Activated: was coming-soon, now live
UPDATE public.services SET
  name               = 'Insole Replacement',
  short_description  = 'We replace worn or uncomfortable insoles',
  card_name          = 'Insole Replacement',
  card_price_label   = '$50',
  is_coming_soon     = false
WHERE slug = 'insole-replacement';

UPDATE public.services SET
  name               = 'Lining Repair',
  short_description  = 'We patch areas of wear on the inside of your shoe',
  card_name          = 'Lining Repair',
  card_price_label   = '$75'
WHERE slug = 'lining-repair';

UPDATE public.services SET
  name               = 'Seam Repair',
  short_description  = 'We repair frayed or broken stitching',
  card_name          = 'Seam Repair',
  card_price_label   = '$50'
WHERE slug = 'seam-repair';

UPDATE public.services SET
  short_description  = 'We apply a protective barrier to protect from rain or moisture',
  card_price_label   = '$30'
WHERE slug = 'waterproofing';

UPDATE public.services SET
  name               = 'Hardware or Buckle Repair',
  short_description  = 'We re-secure whatever has come free',
  card_name          = 'Hardware or Buckle Repair',
  card_price_label   = '$45'
WHERE slug = 'hardware-repair';

UPDATE public.services SET
  name               = 'Zipper Repair',
  short_description  = 'We reattach or replace a broken zipper',
  card_name          = 'Zipper Repair',
  card_price_label   = '$75'
WHERE slug = 'zipper-reattachment';

-- Also clear qa_config — zipper-slider-replacement no longer uses a Q&A picker
UPDATE public.services SET
  name               = 'Zipper Slider Repair',
  short_description  = 'We replace a broken or missing zipper slider',
  card_name          = 'Zipper Slider Repair',
  card_price_label   = '$45',
  qa_config          = NULL
WHERE slug = 'zipper-slider-replacement';

-- ── Coming soon services ─────────────────────────────────────────────────────

UPDATE public.services SET
  name               = 'Dye My Shoes',
  short_description  = 'We refresh your shoes by dyeing them an entirely new color',
  card_name          = 'Dye My Shoes',
  card_price_label   = '$125'
WHERE slug = 'full-dye';

UPDATE public.services SET
  name               = 'Shoe Stretching',
  short_description  = 'We stretch shoes in the foot or calf area to give them a more comfortable fit',
  card_name          = 'Shoe Stretching',
  card_price_label   = '$40'
WHERE slug = 'shoe-stretching';

-- Both buckle-replacement and hardware-replacement represent the same
-- customer-facing "Hardware or Buckle Replacement" coming-soon service.
UPDATE public.services SET
  name               = 'Hardware or Buckle Replacement',
  short_description  = 'We replace your buckle or hardware with the closest match we can source',
  card_name          = 'Hardware or Buckle Replacement',
  card_price_label   = '$80'
WHERE slug IN ('buckle-replacement', 'hardware-replacement');

UPDATE public.services SET
  name               = 'Heel Replacement',
  short_description  = 'We replace a heel that is damaged beyond repair',
  card_name          = 'Heel Replacement',
  card_price_label   = '$150'
WHERE slug = 'heel-replacement';
