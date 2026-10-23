-- Durable lifecycle notifications. No network calls inside customer transactions.
-- No backfill: historical requests must never receive a burst of old emails.
CREATE SCHEMA IF NOT EXISTS repair_notifications;
REVOKE ALL ON SCHEMA repair_notifications FROM PUBLIC, anon, authenticated;

CREATE TABLE public.repair_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('assessment','order')),
  entity_id uuid NOT NULL,
  kind text NOT NULL,
  event_key text NOT NULL UNIQUE,
  appointment_version text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','blocked','suppressed','uncertain')),
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  message_id text,
  error_code text
);
ALTER TABLE public.repair_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.repair_email_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.repair_email_outbox TO service_role;
CREATE INDEX repair_email_pending ON public.repair_email_outbox(created_at) WHERE status='pending';

-- Server-owned integration context. Never store this in customer-editable JSON.
-- Staff question/explanation and real booking links are supplied by the owning
-- workflow before changing the status. Missing fields block sending for review.
CREATE TABLE public.repair_email_context (
  entity_type text NOT NULL CHECK (entity_type IN ('assessment','order')),
  entity_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY(entity_type,entity_id)
);
ALTER TABLE public.repair_email_context ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.repair_email_context FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.repair_email_context TO service_role;

CREATE FUNCTION repair_notifications.enqueue(entity text, row_id uuid, event_kind text,
  event_version text, booking_version text DEFAULT NULL) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  INSERT INTO public.repair_email_outbox(entity_type,entity_id,kind,event_key,appointment_version)
  VALUES(entity,row_id,event_kind,entity||':'||row_id||':'||event_kind||':'||event_version,booking_version)
  ON CONFLICT(event_key) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION repair_notifications.enqueue(text,uuid,text,text,text) FROM PUBLIC;

CREATE FUNCTION repair_notifications.capture() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous jsonb := '{}'::jsonb; current_row jsonb := to_jsonb(NEW);
  event_kind text; entity text; booking_kind text; version text; old_version text;
BEGIN
  -- This function is trigger-only. It cannot be invoked to choose arbitrary
  -- recipients, URLs or templates. Customer writes still pass existing RLS.
  IF TG_OP='UPDATE' THEN previous := to_jsonb(OLD); END IF;
  entity := CASE WHEN TG_TABLE_NAME='assessments' THEN 'assessment' ELSE 'order' END;
  IF entity='assessment' THEN
    IF TG_OP='INSERT' AND NEW.status='pending' THEN event_kind:='request_received';
    ELSIF current_row->>'status' IS DISTINCT FROM previous->>'status' THEN
      event_kind := CASE NEW.status
        WHEN 'needs_more_info' THEN 'more_information'
        WHEN 'quote_ready' THEN CASE WHEN previous->>'status'='waitlisted' THEN 'capacity_available' ELSE 'recommendations_ready' END
        WHEN 'waitlisted' THEN 'waitlisted'
        WHEN 'service_unavailable' THEN 'request_declined'
        WHEN 'declined' THEN 'request_declined'
        WHEN 'closed' THEN 'request_closed' ELSE NULL END;
    END IF;
  ELSE
    IF current_row->>'status' IS DISTINCT FROM previous->>'status' THEN
      event_kind := CASE NEW.status
        WHEN 'picked-up' THEN 'bag_collected'
        WHEN 'ready-for-return' THEN 'return_ready'
        WHEN 'cancelled' THEN 'repair_canceled'
        WHEN 'canceled' THEN 'repair_canceled' ELSE NULL END;
    END IF;
    FOREACH booking_kind IN ARRAY ARRAY['pickup','return'] LOOP
      version := concat_ws('|',current_row->>(booking_kind||'_calendly_event_uri'),current_row->>(booking_kind||'_date'),current_row->>(booking_kind||'_time_label'));
      old_version := concat_ws('|',previous->>(booking_kind||'_calendly_event_uri'),previous->>(booking_kind||'_date'),previous->>(booking_kind||'_time_label'));
      IF nullif(current_row->>(booking_kind||'_calendly_event_uri'),'') IS NOT NULL
        AND nullif(current_row->>(booking_kind||'_date'),'') IS NOT NULL
        AND nullif(current_row->>(booking_kind||'_time_label'),'') IS NOT NULL
        AND ((booking_kind='pickup' AND NEW.status IN ('placed','confirmed','pickup-scheduled'))
          OR (booking_kind='return' AND NEW.status IN ('ready-for-return','return-scheduled')))
        AND (version IS DISTINCT FROM old_version OR previous->>'status'='pending_payment') THEN
        PERFORM repair_notifications.enqueue(entity,NEW.id,booking_kind||'_confirmed',version,version);
      END IF;
    END LOOP;
  END IF;
  IF event_kind IS NOT NULL THEN
    -- txid distinguishes deliberate later transitions; a no-op update enqueues nothing.
    PERFORM repair_notifications.enqueue(entity,NEW.id,event_kind,txid_current()::text);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION repair_notifications.capture() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER repair_email_assessments AFTER INSERT OR UPDATE ON public.assessments
FOR EACH ROW EXECUTE FUNCTION repair_notifications.capture();
CREATE TRIGGER repair_email_orders AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION repair_notifications.capture();

-- Called by a secret-protected worker. No SECURITY DEFINER: service_role only.
CREATE FUNCTION public.claim_repair_emails(batch_size integer DEFAULT 20)
RETURNS SETOF public.repair_email_outbox LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
  WITH pending AS (
    SELECT id FROM public.repair_email_outbox WHERE status='pending'
    ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT greatest(1,least(batch_size,50))
  ) UPDATE public.repair_email_outbox q SET status='sending',claimed_at=now()
    FROM pending WHERE q.id=pending.id RETURNING q.*;
$$;
REVOKE ALL ON FUNCTION public.claim_repair_emails(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_repair_emails(integer) TO service_role;

CREATE FUNCTION public.queue_repair_reminders() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r record; k text; v text;
BEGIN
  IF extract(hour FROM now() AT TIME ZONE 'America/New_York') < 9 THEN RETURN; END IF;
  FOR r IN SELECT * FROM public.orders WHERE status IN
    ('placed','confirmed','pickup-scheduled','ready-for-return','return-scheduled') LOOP
    FOREACH k IN ARRAY ARRAY['pickup','return'] LOOP
      IF ((k='pickup' AND r.status IN ('placed','confirmed','pickup-scheduled')) OR
          (k='return' AND r.status IN ('ready-for-return','return-scheduled')))
        AND (to_jsonb(r)->>(k||'_date'))::date = (now() AT TIME ZONE 'America/New_York')::date+1
        AND nullif(to_jsonb(r)->>(k||'_calendly_event_uri'),'') IS NOT NULL THEN
        v:=concat_ws('|',to_jsonb(r)->>(k||'_calendly_event_uri'),to_jsonb(r)->>(k||'_date'),to_jsonb(r)->>(k||'_time_label'));
        PERFORM repair_notifications.enqueue('order',r.id,k||'_reminder',v,v);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_repair_reminders() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_repair_reminders() TO service_role;
GRANT USAGE ON SCHEMA repair_notifications TO service_role;
GRANT EXECUTE ON FUNCTION repair_notifications.enqueue(text,uuid,text,text,text) TO service_role;

-- Retire obsolete repair senders. Account/security triggers are unaffected.
DROP TRIGGER IF EXISTS notify_proposal_received_trigger ON public.assessments;
DROP TRIGGER IF EXISTS notify_order_confirmation_trigger ON public.orders;
DROP TRIGGER IF EXISTS trg_orders_send_confirmation ON public.orders;
