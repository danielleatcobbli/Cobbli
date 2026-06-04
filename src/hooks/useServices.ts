import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  type PriceTier,
  type Service,
  type ServiceCategory,
  type ShoeType,
  tierForShoeType,
} from "@/types/service";

type Row = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  categories: string[] | null;
  popularity_rank: number | null;
  service_pricing: { shoe_type: string; price_cents: number }[] | null;
};

const mapRow = (r: Row): Service => {
  const pricing: Partial<Record<PriceTier, number>> = {};
  for (const p of r.service_pricing ?? []) {
    const tier = tierForShoeType(p.shoe_type as ShoeType);
    // All shoe types within a tier should share a price; if multiple rows exist
    // for a tier, the lowest wins (consistent with "From $X" display).
    const dollars = Math.round(p.price_cents / 100);
    if (pricing[tier] === undefined || dollars < (pricing[tier] as number)) {
      pricing[tier] = dollars;
    }
  }
  return {
    slug: r.slug,
    name: r.name,
    description: r.short_description ?? "",
    pricing,
    categories: (r.categories ?? []) as ServiceCategory[],
    rank: r.popularity_rank ?? 0,
  };
};

const fetchServices = async (): Promise<Service[]> => {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, slug, name, short_description, categories, popularity_rank, service_pricing(shoe_type, price_cents)",
    )
    .eq("is_active", true);
  if (error) throw error;
  return (data as unknown as Row[]).map(mapRow);
};

export const useServices = () =>
  useQuery({
    queryKey: ["services"],
    queryFn: fetchServices,
    staleTime: 60_000,
  });

export const useService = (slug: string) => {
  const q = useServices();
  return { ...q, service: q.data?.find((s) => s.slug === slug) };
};
