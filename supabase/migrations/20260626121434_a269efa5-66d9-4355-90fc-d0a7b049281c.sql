
-- Allow guest assessments
ALTER TABLE public.assessments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS guest_email TEXT;

GRANT INSERT ON public.assessments TO anon;

CREATE POLICY "Guests insert assessments"
ON public.assessments FOR INSERT
TO anon
WITH CHECK (user_id IS NULL AND guest_email IS NOT NULL);

-- Allow guests to upload/read assessment files under guest/ prefix
CREATE POLICY "Guests upload assessment files"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'assessment-uploads' AND (storage.foldername(name))[1] = 'guest');

CREATE POLICY "Guests read assessment files"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'assessment-uploads' AND (storage.foldername(name))[1] = 'guest');
