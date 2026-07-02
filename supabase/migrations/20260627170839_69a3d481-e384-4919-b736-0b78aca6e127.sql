UPDATE public.services
SET qa_config = jsonb_set(
  qa_config,
  '{options}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN opt->>'label' LIKE 'Let us assess%' THEN opt - 'priceLabel'
        ELSE opt
      END
    )
    FROM jsonb_array_elements(qa_config->'options') AS opt
  )
)
WHERE slug = 'full-resole' AND qa_config IS NOT NULL;