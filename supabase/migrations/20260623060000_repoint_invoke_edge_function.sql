-- Repoint _invoke_edge_function() at the new self-managed project.
--
-- The original definition (in 20260512142152_*.sql) hardcoded the OLD Lovable
-- Cloud project (hqcdsjznvyywmoylmjur). After migrating ownership to the
-- self-managed project (vzyrzhfxdrtgyhpddvlj), DB triggers were still POSTing
-- to the dead project's edge functions, breaking:
--   - send-order-confirmation (notify_order_confirmation trigger on orders)
--   - send-account-locked     (record_failed_signin)
--   - send-walkup-welcome     (handle_new_user when created_by='admin')
--
-- This rewrites the helper to point at the new project + new publishable key.
-- The publishable key is safe in committed code (it's the client-bundle key);
-- the service-role key is NOT used here.
--
-- TODO(post-fastapi-deploy): once backend/ is live on Vercel with a stable
-- URL, replace the edge-function call here with a POST to the FastAPI URL
-- so DB triggers hit the new backend directly. Endpoints have different
-- paths (e.g. send-order-confirmation -> /email/order-confirmation), so
-- the _name -> path mapping needs a CASE statement at that point.

CREATE OR REPLACE FUNCTION public._invoke_edge_function(_name text, _payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _req_id bigint;
  _url text := 'https://vzyrzhfxdrtgyhpddvlj.supabase.co/functions/v1/' || _name;
  _anon text := 'sb_publishable_MP1CxrG_PdmfAKIIG_AaBw_odcAbC9m';
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
