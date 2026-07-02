
DROP POLICY IF EXISTS "Guests insert assessments" ON public.assessments;
DROP POLICY IF EXISTS "Users insert own assessments" ON public.assessments;

CREATE POLICY "Anyone can insert assessments"
ON public.assessments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (user_id IS NULL AND guest_email IS NOT NULL)
);

GRANT INSERT ON public.assessments TO anon;
