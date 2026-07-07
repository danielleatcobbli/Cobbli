import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

// The three roles the app enforces. Ordered by privilege for convenience.
// NOTE: the Postgres app_role enum also still carries the legacy 'owner' and
// 'user' labels (kept for backwards-compat during migration) — they map to
// 'admin' and 'customer' respectively and are treated as such here.
export type Role = "customer" | "staff" | "admin";

const LEGACY_MAP: Record<string, Role> = {
  owner: "admin",
  user: "customer",
};

const normalizeRole = (raw: string): Role => {
  if (raw === "admin" || raw === "staff" || raw === "customer") return raw;
  return LEGACY_MAP[raw] ?? "customer";
};

// Highest-privilege role wins when a user holds several rows.
const RANK: Record<Role, number> = { customer: 0, staff: 1, admin: 2 };

const bestRole = (roles: string[]): Role =>
  roles
    .map(normalizeRole)
    .reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "customer" as Role);

// Exposed for unit tests — the pure role-resolution logic.
export const __roleTestables = { normalizeRole, bestRole };

/**
 * Resolves the signed-in user's effective role from user_roles. A signed-out
 * user resolves to null. A signed-in user with no explicit role row is treated
 * as a customer (the default for all end users).
 */
export const useRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setRole(null);
      setResolved(true);
      return;
    }
    setResolved(false);
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        // Signed in but no role row (or read failed) → customer by default.
        setRole("customer");
        setResolved(true);
        return;
      }
      setRole(bestRole(data.map((r) => r.role as string)));
      setResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const loading = authLoading || !resolved;
  return {
    role,
    loading,
    isAdmin: role === "admin",
    isStaff: role === "staff",
    isCustomer: role === "customer",
    // Convenience: can this user reach the shared ops area (orders/reworks)?
    isStaffOrAdmin: role === "staff" || role === "admin",
  };
};
