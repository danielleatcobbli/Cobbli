-- Add an 'owner' role above 'admin' for the Owner-only Settings area.
--
-- 'owner' is additive: existing admins keep 'admin', and both Danielle-owned
-- accounts are granted 'owner' as well. Every existing has_role(..., 'admin')
-- RLS policy therefore continues to work unchanged; 'owner' simply unlocks the
-- new Settings surfaces on top.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block and the
-- new label must be committed before it can be used, so the enum change and the
-- grant are intentionally separate statements. Both are idempotent.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';

-- Grant 'owner' to every current admin (both accounts are Danielle's).
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'owner'::public.app_role
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;
