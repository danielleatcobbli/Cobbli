import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Owner mutations for the serviced-ZIP list. Writes are enforced by the
 * owner/admin RLS policy on service_areas — a non-owner call is rejected by
 * the database regardless of the client-side gate. Cache is invalidated so the
 * checkout/account validators pick up changes.
 */
export const useServiceAreaMutations = () => {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["service-areas"] });

  const addZip = useMutation({
    mutationFn: async (zip: string) => {
      const trimmed = zip.trim();
      if (!/^\d{5}$/.test(trimmed)) throw new Error("Enter a valid 5-digit ZIP code.");
      const { error } = await supabase
        .from("service_areas")
        .upsert({ zip: trimmed, is_active: true }, { onConflict: "zip" });
      if (error) throw error;
      return trimmed;
    },
    onSuccess: invalidate,
  });

  const removeZip = useMutation({
    mutationFn: async (zip: string) => {
      const { error } = await supabase.from("service_areas").delete().eq("zip", zip);
      if (error) throw error;
      return zip;
    },
    onSuccess: invalidate,
  });

  return { addZip, removeZip };
};
