
ALTER TABLE public.assessments
  ADD COLUMN IF NOT EXISTS deposit_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS deposit_amount_cents integer,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS assessments_stripe_session_id_key
  ON public.assessments(stripe_session_id) WHERE stripe_session_id IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key
  ON public.orders(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
