-- Repoint _invoke_edge_function() at the FastAPI backend on Vercel.
--
-- DB triggers (notify_order_confirmation, record_failed_signin,
-- handle_new_user) were previously calling Supabase Edge Functions.
-- Now they POST to the FastAPI backend. The function names from the
-- old Edge Function world are mapped to the new FastAPI paths via a
-- CASE statement.
--
-- Set this secret before running:
--   supabase secrets set BACKEND_API_URL=https://your-backend.vercel.app
-- or add it to Supabase Vault if preferred.
--
-- CORS_ALLOW_ORIGINS on the backend must include the Supabase project
-- domain (or "*") since these calls come from the DB, not a browser.

CREATE OR REPLACE FUNCTION public._invoke_edge_function(_name text, _payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _req_id  bigint;
  _api_url text := current_setting('app.backend_api_url', true);
  _path    text;
BEGIN
  -- Fall back to env secret if GUC not set
  IF _api_url IS NULL OR _api_url = '' THEN
    _api_url := extensions.pgvault_secret('BACKEND_API_URL');
  END IF;

  -- Map legacy edge-function names → FastAPI paths
  _path := CASE _name
    WHEN 'send-order-confirmation'  THEN '/email/order-confirmation'
    WHEN 'send-account-locked'      THEN '/email/account-locked'
    WHEN 'send-walkup-welcome'      THEN '/email/walkup-welcome'
    WHEN 'send-password-updated'    THEN '/email/password-updated'
    WHEN 'send-service-unavailable' THEN '/email/service-unavailable'
    ELSE '/' || _name
  END;

  SELECT net.http_post(
    url     := _api_url || _path,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := _payload
  ) INTO _req_id;

  RETURN _req_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_invoke_edge_function failed (% → %): %', _name, _path, SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._invoke_edge_function(text, jsonb) FROM anon, authenticated;
