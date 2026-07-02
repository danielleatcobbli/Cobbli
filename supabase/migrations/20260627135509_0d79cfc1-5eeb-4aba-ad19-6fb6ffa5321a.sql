
ALTER TABLE public.service_votes ALTER COLUMN user_id DROP NOT NULL;

GRANT SELECT, INSERT ON public.service_votes TO anon;

CREATE POLICY "anon can insert votes on coming-soon services"
ON public.service_votes
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL AND EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = service_votes.service_id AND s.is_coming_soon = true
  )
);
