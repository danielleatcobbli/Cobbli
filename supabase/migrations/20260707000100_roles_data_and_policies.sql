-- Part 2 of the role migration (run after the enum values are committed).

-- display_name: manually populated when staff are invited, so Danielle can
-- read names instead of user IDs.
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Migrate legacy data:
--   'user'  -> 'customer'
UPDATE public.user_roles SET role = 'customer' WHERE role = 'user';

--   'owner' -> consolidate into 'admin'. Every owner already has an 'admin'
--   row, so delete the redundant owner rows rather than duplicate. Guarded so
--   we never strip admin from someone who somehow lacks it.
DELETE FROM public.user_roles ur
WHERE ur.role = 'owner'
  AND EXISTS (
    SELECT 1 FROM public.user_roles a
    WHERE a.user_id = ur.user_id AND a.role = 'admin'
  );

-- Repoint the two owner-gated policies to admin (owners are now admins).
DROP POLICY IF EXISTS "Owners manage service areas" ON public.service_areas;
CREATE POLICY "Admins manage service areas" ON public.service_areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners manage pricing config" ON public.pricing_config;
CREATE POLICY "Admins manage pricing config" ON public.pricing_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Give Danielle a display_name on her admin row.
UPDATE public.user_roles ur
SET display_name = 'Danielle Olsen'
FROM public.profiles p
WHERE p.user_id = ur.user_id
  AND ur.role = 'admin'
  AND p.email = 'danielleamiotolsen@gmail.com';
