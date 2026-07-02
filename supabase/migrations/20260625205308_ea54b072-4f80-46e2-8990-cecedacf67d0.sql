
UPDATE public.services SET card_price_label='$35–$40' WHERE slug IN ('buckle-repair','strap-repair','hardware-repair');
UPDATE public.services SET card_price_label='$45–$55' WHERE slug='zipper-reattachment';
UPDATE public.services SET card_price_label='$25–$30' WHERE slug='zipper-slider-replacement';
UPDATE public.services SET card_price_label='$65–$75' WHERE slug='zipper-replacement';

UPDATE public.service_variants v SET standard_cents=3500, premium_cents=4000
  FROM public.services s WHERE v.service_id=s.id AND s.slug IN ('buckle-repair','strap-repair','hardware-repair');
UPDATE public.service_variants v SET standard_cents=4500, premium_cents=5500
  FROM public.services s WHERE v.service_id=s.id AND s.slug='zipper-reattachment';
UPDATE public.service_variants v SET standard_cents=6500, premium_cents=7500
  FROM public.services s WHERE v.service_id=s.id AND s.slug='zipper-replacement';
UPDATE public.service_variants v SET standard_cents=2500, premium_cents=3000
  FROM public.services s WHERE v.service_id=s.id AND s.slug='zipper-slider-replacement';
