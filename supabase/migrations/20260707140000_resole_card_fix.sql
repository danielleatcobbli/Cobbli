-- Fix: update the full-resole service card to display as "Resole"
-- with a one-line short description and flat $85 price.

UPDATE public.services SET
  name               = 'Resole',
  short_description  = 'We replace worn or damaged soles',
  card_name          = 'Resole',
  card_price_label   = '$85'
WHERE slug = 'full-resole';
