import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

/**
 * True when the signed-in user holds the 'owner' role in user_roles. Mirrors
 * useIsAdmin. Owner gates the Settings area (serviced zips + pricing); it is
 * additive to admin, so an owner is also an admin.
 */
export const useIsOwner = () => {
  const { user, loading: authLoading } = useAuth();
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (authLoading) return;
    if (!user) {
      setIsOwner(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .maybeSingle();
      if (cancelled) return;
      setIsOwner(!error && !!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isOwner, loading: authLoading || isOwner === null };
};
