import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Owner-editable flat fees, sourced from the Supabase `pricing_config` table.
 *
 * Falls back to the historical hardcoded values if a key is missing or the
 * query hasn't resolved, so the checkout/assessment flow behaves identically
 * whether or not the table has been provisioned/seeded yet. All values are in
 * cents.
 */
export const PRICING_CONFIG_DEFAULTS = {
  courier_fee_cents: 1500,
  free_courier_threshold_cents: 10000,
  assessment_deposit_cents: 2000,
} as const;

export type PricingConfigKey = keyof typeof PRICING_CONFIG_DEFAULTS;

const fetchPricingConfig = async (): Promise<Record<string, number>> => {
  const { data, error } = await supabase
    .from("pricing_config")
    .select("key, value_cents");
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of data ?? []) out[row.key] = row.value_cents;
  return out;
};

export const usePricingConfig = () => {
  const query = useQuery({
    queryKey: ["pricing-config"],
    queryFn: fetchPricingConfig,
    staleTime: 5 * 60_000,
  });

  // Resolve a single fee, preferring the fetched value and falling back to the
  // default. Always returns a usable number so callers never see undefined.
  const fee = (key: PricingConfigKey): number => {
    const fetched = query.data?.[key];
    return typeof fetched === "number" ? fetched : PRICING_CONFIG_DEFAULTS[key];
  };

  return { ...query, fee };
};
