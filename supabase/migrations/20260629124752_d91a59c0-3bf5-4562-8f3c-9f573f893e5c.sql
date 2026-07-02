CREATE TABLE public.coverage_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zip_code TEXT NOT NULL CHECK (zip_code ~ '^[0-9]{5}$'),
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.coverage_requests TO anon, authenticated;
GRANT ALL ON public.coverage_requests TO service_role;
ALTER TABLE public.coverage_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a coverage request"
  ON public.coverage_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);