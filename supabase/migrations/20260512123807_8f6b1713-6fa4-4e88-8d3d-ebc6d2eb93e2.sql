
-- Internal/trigger-only — not callable from the client API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_single_default_address() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_single_default_pm() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.generate_order_number() FROM anon, authenticated, public;

-- Reset only makes sense for signed-in users
REVOKE EXECUTE ON FUNCTION public.reset_failed_attempts(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.reset_failed_attempts(uuid) TO authenticated;

-- has_role: keep callable so RLS policies can invoke it; restrict raw client calls to authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- record_failed_signin / is_account_locked must remain callable pre-auth
GRANT EXECUTE ON FUNCTION public.record_failed_signin(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_locked(text) TO anon, authenticated;
