import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PricingConfigKey } from "@/hooks/usePricingConfig";

/**
 * Owner mutation for the flat-fee config. Enforced by the owner/admin RLS on
 * pricing_config. Values are edited in whole dollars in the UI and stored as
 * cents. Invalidates both the admin editor and the public fee query.
 */
export const usePricingConfigMutations = () => {
  const qc = useQueryClient();

  const setFee = useMutation({
    mutationFn: async ({ key, cents }: { key: PricingConfigKey; cents: number }) => {
      if (!Number.isInteger(cents) || cents < 0) {
        throw new Error("Fee must be a whole, non-negative amount.");
      }
      const { error } = await supabase
        .from("pricing_config")
        .upsert({ key, value_cents: cents }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-config"] });
    },
  });

  return { setFee };
};
