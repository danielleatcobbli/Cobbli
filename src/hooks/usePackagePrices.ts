import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LEGACY_PACKAGE_ALIASES: Record<string, string> = {
  "standard-repair-sole-upper-interior": "standard-service",
  "exterior-repair-sole-upper": "full-exterior-repair",
};

export const canonicalPackageSlug = (slug: string) =>
  LEGACY_PACKAGE_ALIASES[slug] ?? slug;

const fetchPackagePrices = async (): Promise<Record<string, number>> => {
  const { data, error } = await supabase
    .from("repair_packages")
    .select("slug, price_cents")
    .eq("is_active", true);
  if (error) throw error;

  const prices: Record<string, number> = {};
  for (const row of data ?? []) {
    if (typeof row.slug === "string" && typeof row.price_cents === "number") {
      prices[row.slug] = row.price_cents;
    }
  }
  return prices;
};

export const usePackagePrices = () =>
  useQuery({
    queryKey: ["repair-package-prices"],
    queryFn: fetchPackagePrices,
    staleTime: 60_000,
  });
