-- Store the Calendly event URI for each booked pickup/return so the
-- reschedule flow can cancel the old event before booking a new one.
-- Without these columns a reschedule would create a duplicate Calendly event
-- alongside the original.
--
-- Nullable because:
--   • Orders booked before this migration have no stored URI.
--   • Orders where calendly-book fell back to a scheduling link (non-direct
--     booking plan) never receive a URI.
--   • Return slots are scheduled by staff later, not at checkout.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_calendly_event_uri text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS return_calendly_event_uri text;
