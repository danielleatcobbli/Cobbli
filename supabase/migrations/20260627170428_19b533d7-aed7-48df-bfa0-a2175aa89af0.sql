UPDATE public.services
SET qa_config = jsonb_build_object(
  'question', 'What type of zipper does your shoe have?',
  'hint', 'Not sure? Check whether the zipper teeth and surrounding tape are made of metal/nylon (standard) or leather or suede (specialty).',
  'options', jsonb_build_array(
    jsonb_build_object('label', 'Metal or nylon zipper', 'priceLabel', '$40', 'variantKey', 'standard'),
    jsonb_build_object('label', 'Leather or suede zipper', 'priceLabel', '$60', 'variantKey', 'leather-suede')
  )
)
WHERE slug = 'zipper-slider-replacement';