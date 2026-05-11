DROP POLICY "Anyone can join waitlist" ON public.waitlist;

CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(email) <= 254
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND source IN ('coming_soon_page')
  );