import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/integrations/api/client";
import type { PricingConfigKey } from "@/hooks/usePricingConfig";

/**
 * Owner mutation for the flat-fee config. Writes go through the FastAPI /ops
 * gateway, which authorizes the caller server-side (staff/admin) with RLS as a
 * backstop. Values are edited in whole dollars in the UI and stored as cents.
 * Invalidates both the admin editor and the public fee query.
 */
export const usePricingConfigMutations = () => {
  const qc = useQueryClient();

  const setFee = useMutation({
    mutationFn: async ({ key, cents }: { key: PricingConfigKey; cents: number }) => {
      if (!Number.isInteger(cents) || cents < 0) {
        throw new Error("Fee must be a whole, non-negative amount.");
      }
      await apiFetch(`/ops/pricing-config/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value_cents: cents }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-config"] });
    },
  });

  return { setFee };
};
