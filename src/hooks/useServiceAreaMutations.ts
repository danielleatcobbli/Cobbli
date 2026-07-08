import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/integrations/api/client";

/**
 * Owner mutations for the serviced-ZIP list. Writes go through the FastAPI
 * /ops gateway, which authorizes the caller server-side (staff/admin) with RLS
 * as a backstop. Cache is invalidated so the checkout/account validators pick
 * up changes.
 */
export const useServiceAreaMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["service-areas"] });

  const addZip = useMutation({
    mutationFn: async (zip: string) => {
      const trimmed = zip.trim();
      if (!/^\d{5}$/.test(trimmed)) throw new Error("Enter a valid 5-digit ZIP code.");
      await apiFetch(`/ops/service-areas/${trimmed}`, {
        method: "PUT",
        body: JSON.stringify({ is_active: true }),
      });
      return trimmed;
    },
    onSuccess: invalidate,
  });

  const removeZip = useMutation({
    mutationFn: async (zip: string) => {
      await apiFetch(`/ops/service-areas/${zip}`, { method: "DELETE" });
      return zip;
    },
    onSuccess: invalidate,
  });

  return { addZip, removeZip };
};
