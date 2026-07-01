import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Serviced ZIP codes, sourced from the Supabase `service_areas` table (owner-
 * managed) instead of the former hardcoded set.
 *
 * Validation is intentionally three-state, not a bare boolean: while the list
 * is loading or if the query fails, we must NOT declare a ZIP unserviceable —
 * that would false-fail a valid address at checkout. `isServiceable(zip)`
 * returns:
 *   - true  -> ZIP is in the active service list
 *   - false -> list is loaded and the ZIP is definitively not covered
 *   - null  -> not yet known (loading or errored); caller should not block
 */
const fetchServiceableZips = async (): Promise<Set<string>> => {
  const { data, error } = await supabase
    .from("service_areas")
    .select("zip")
    .eq("is_active", true);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.zip));
};

export const useServiceableZips = () => {
  const query = useQuery({
    queryKey: ["service-areas"],
    queryFn: fetchServiceableZips,
    staleTime: 5 * 60_000,
  });

  const ready = query.isSuccess && query.data !== undefined;

  const isServiceable = (zip: string): boolean | null => {
    if (!ready || !query.data) return null;
    return query.data.has(zip.trim());
  };

  return { ...query, isServiceable, ready };
};
