-- Enable pg_net for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper: invoke a Supabase Edge Function asynchronously
CREATE OR REPLACE FUNCTION public._invoke_edge_function(_name text, _payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _req_id bigint;
  _url text := 'https://hqcdsjznvyywmoylmjur.supabase.co/functions/v1/' || _name;
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxY2Rzanpudnl5d21veWxtanVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjYzMTEsImV4cCI6MjA5NDEwMjMxMX0.Y6DsKXj647Zw1bKat9yIYuV1fAZqJsOSvpVRtRHQQeM';
BEGIN
  SELECT net.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', _anon,
      'Authorization', 'Bearer ' || _anon
    ),
    body := _payload
  ) INTO _req_id;
  RETURN _req_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'edge function invoke failed (%): %', _name, SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._invoke_edge_function(text, jsonb) FROM anon, authenticated;

-- 1) Order confirmation trigger (door-to-door only)
CREATE OR REPLACE FUNCTION public.notify_order_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivery_method = 'door-to-door' THEN
    PERFORM public._invoke_edge_function(
      'send-order-confirmation',
      jsonb_build_object('record', to_jsonb(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_send_confirmation ON public.orders;
CREATE TRIGGER trg_orders_send_confirmation
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_confirmation();

-- 2) Account-locked: extend record_failed_signin to fire email when newly locked
CREATE OR REPLACE FUNCTION public.record_failed_signin(_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID;
  _attempts INT;
  _locked TIMESTAMPTZ;
  _was_locked BOOLEAN;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email LIMIT 1;
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('locked', false, 'attempts', 0);
  END IF;

  SELECT locked_at IS NOT NULL INTO _was_locked
    FROM public.user_security WHERE user_id = _uid;

  INSERT INTO public.user_security (user_id, failed_attempts, last_failed_at)
  VALUES (_uid, 1, now())
  ON CONFLICT (user_id) DO UPDATE
    SET failed_attempts = public.user_security.failed_attempts + 1,
        last_failed_at = now()
  RETURNING failed_attempts, locked_at INTO _attempts, _locked;

  IF _attempts >= 5 AND _locked IS NULL THEN
    UPDATE public.user_security SET locked_at = now() WHERE user_id = _uid
      RETURNING locked_at INTO _locked;
    -- Newly locked: fire email
    PERFORM public._invoke_edge_function(
      'send-account-locked',
      jsonb_build_object('user_id', _uid)
    );
  END IF;

  RETURN jsonb_build_object('locked', _locked IS NOT NULL, 'attempts', _attempts);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_failed_signin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_failed_signin(text) TO anon, authenticated;

-- 3) Walk-up welcome: extend handle_new_user to fire email when admin-created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'phone'
  );
  INSERT INTO public.user_security (user_id) VALUES (NEW.id);

  IF NEW.raw_user_meta_data ->> 'created_by' = 'admin' THEN
    PERFORM public._invoke_edge_function(
      'send-walkup-welcome',
      jsonb_build_object('user_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;