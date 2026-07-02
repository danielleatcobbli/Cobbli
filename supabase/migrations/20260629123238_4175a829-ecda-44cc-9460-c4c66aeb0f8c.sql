CREATE TABLE public.reworks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  description text NOT NULL,
  services_in_scope jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.reworks TO authenticated;
GRANT ALL ON public.reworks TO service_role;

ALTER TABLE public.reworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own reworks"
  ON public.reworks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create their own reworks"
  ON public.reworks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_reworks_updated_at
  BEFORE UPDATE ON public.reworks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();