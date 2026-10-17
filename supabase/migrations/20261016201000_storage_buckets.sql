-- The repair form uploads to assessment-uploads (AssessmentUpload.tsx, 50MB
-- photos). Blog cover images use blog-images. Policies for both buckets
-- were added earlier, but the buckets themselves were created outside the
-- migration files. pair-photos is the only bucket those files create, so a
-- fresh database accepts the rules and then rejects the upload.
--
-- ON CONFLICT leaves an existing bucket alone, including files already
-- stored in it and whether it is public.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('assessment-uploads', 'assessment-uploads', false, 52428800),
  ('blog-images', 'blog-images', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- The assessments screen is open to staff as well as admins, and it signs
-- URLs for these photos. The earlier read policy allows only the owning
-- customer and admins, so a staff account could not open the files.
DROP POLICY IF EXISTS "Staff read assessment uploads" ON storage.objects;
CREATE POLICY "Staff read assessment uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'assessment-uploads'
    AND public.is_staff_or_admin(auth.uid())
  );
