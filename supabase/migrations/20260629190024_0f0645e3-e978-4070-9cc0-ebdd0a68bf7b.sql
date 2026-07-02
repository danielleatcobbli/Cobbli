
UPDATE public.services SET short_description = 'We replenish the natural oils in your leather or suede to make it soft, flexible, and protect it from cracking. Think of it as moisturizer for your shoes.' WHERE slug = 'leather-or-suede-conditioning';

UPDATE public.services SET short_description = 'We re-attach loose or detached hardware so you can wear your shoes again.' WHERE slug = 'hardware-repair';

UPDATE public.services SET short_description = 'We replace the cushioned inner sole of your shoe to restore comfort and support your foot.' WHERE slug = 'insole-replacement';

UPDATE public.services SET short_description = 'When a zipper gives out completely, we replace it with a new one matched to your shoe''s original style.' WHERE slug = 'zipper-replacement';

UPDATE public.services SET qa_config = NULL WHERE slug = 'full-resole';
