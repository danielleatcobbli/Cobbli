ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS proposed_services jsonb NOT NULL DEFAULT '[]'::jsonb;