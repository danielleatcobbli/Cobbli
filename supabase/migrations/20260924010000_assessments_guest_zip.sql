-- Adds a delivery zip code to the photo-submission intake (AssessmentUpload.tsx),
-- matching the mocked-up form (2026-09-24, Danielle's call) that asks for zip
-- alongside photos/notes/email, so we know up front whether we service the
-- customer's area. Same additive pattern as guest_email (20260626121434).
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS guest_zip TEXT;
