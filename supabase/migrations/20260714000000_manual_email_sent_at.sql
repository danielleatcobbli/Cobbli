-- Add manual_email_sent_at to reworks and assessments so the admin UI can
-- record when a staff member has manually emailed the customer after a
-- deny_rework or decline_proposal decision, or after a request_more_info.
--
-- NULL  = email not yet sent (row appears in the "Action required: Manual
--         reach out" queue until staff marks it done).
-- value = timestamp when staff confirmed they sent the email.
--
-- Both columns are nullable timestamptz; no NOT NULL default so existing rows
-- aren't affected and no backfill is needed.

ALTER TABLE public.reworks     ADD COLUMN IF NOT EXISTS manual_email_sent_at timestamptz;
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS manual_email_sent_at timestamptz;
