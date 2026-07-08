import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiFetch } from "@/integrations/api/client";

export type PricingRow = {
  id: string;
  slug: string;
  name: string;
  base_price_cents: number | null;
};

const fetchPricingRows = async (): Promise<PricingRow[]> => {
  const { data, error } = await supabase
    .from("services")
    .select("id, slug, name, base_price_cents")
    .order("popularity_rank", { nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as PricingRow[];
};

/**
 * Owner pricing management for service base prices. Writes are enforced by the
 * existing "Admins manage services" RLS (owners are also admins). Prices are
 * edited in whole dollars in the UI and stored as cents.
 */
export const usePricingAdmin = () => {
  const qc = useQueryClient();

  const query = useQuery({ queryKey: ["pricing-admin"], queryFn: fetchPricingRows });

  const setBasePrice = useMutation({
    mutationFn: async ({ id, cents }: { id: string; cents: number | null }) => {
      if (cents !== null && (!Number.isInteger(cents) || cents < 0)) {
        throw new Error("Price must be a whole, non-negative amount.");
      }
      await apiFetch(`/ops/services/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ base_price_cents: cents }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-admin"] });
      qc.invalidateQueries({ queryKey: ["services"] });
    },
  });

  return { ...query, setBasePrice };
};
