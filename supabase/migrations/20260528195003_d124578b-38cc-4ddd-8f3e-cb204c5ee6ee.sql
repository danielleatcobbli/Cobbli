
INSERT INTO storage.buckets (id, name, public)
VALUES ('pair-photos', 'pair-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users view own pair photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'pair-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own pair photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'pair-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own pair photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'pair-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own pair photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'pair-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
