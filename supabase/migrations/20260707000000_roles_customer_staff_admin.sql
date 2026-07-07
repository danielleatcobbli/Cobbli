-- Role model → {customer, staff, admin} per the founder's RBAC spec.
--
-- Approach is ADDITIVE, not a destructive enum rebuild. Postgres cannot drop
-- enum values while policies/columns reference the type without dropping and
-- recreating the type + all 18 RLS policies + has_role() — high-risk on a live
-- DB. Instead we:
--   1. add 'customer' and 'staff' to app_role,
--   2. migrate data: user→customer, and drop redundant 'owner' rows (every
--      owner already holds 'admin', so admin access is preserved),
--   3. repoint the 2 owner-gated policies to 'admin',
--   4. add user_roles.display_name,
--   5. default new signups to 'customer'.
-- The legacy 'owner'/'user' labels remain in the enum, unused. Harmless.
--
-- ALTER TYPE ... ADD VALUE cannot run in a txn and must be committed before
-- use, so the enum additions are separate statements run first.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';
