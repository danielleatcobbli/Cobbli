import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { QAConfig, Service, ServiceCategory, ServiceVariant } from "@/types/service";

type VariantRow = {
  variant_key: string;
  variant_label: string;
  standard_cents: number;
  premium_cents: number | null;
  rank: number;
};

type Row = {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  full_description: string | null;
  card_name: string | null;
  card_price_label: string | null;
  categories: string[] | null;
  popularity_rank: number | null;
  is_coming_soon: boolean | null;
  qa_config: QAConfig | null;
  service_variants: VariantRow[] | null;
};

const mapRow = (r: Row): Service => {
  const variants: ServiceVariant[] = (r.service_variants ?? [])
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .map((v) => ({
      key: v.variant_key,
      label: v.variant_label,
      standard: Math.round(v.standard_cents / 100),
      premium: v.premium_cents == null ? undefined : Math.round(v.premium_cents / 100),
      rank: v.rank,
    }));

  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.short_description ?? "",
    fullDescription: r.full_description ?? undefined,
    cardName: r.card_name ?? r.name,
    cardPriceLabel: r.card_price_label ?? "",
    categories: (r.categories ?? []) as ServiceCategory[],
    rank: r.popularity_rank ?? 0,
    isComingSoon: !!r.is_coming_soon,
    qa: r.qa_config ?? undefined,
    variants,
  };
};

const fetchServices = async (): Promise<Service[]> => {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, slug, name, short_description, full_description, card_name, card_price_label, categories, popularity_rank, is_coming_soon, qa_config, service_variants(variant_key, variant_label, standard_cents, premium_cents, rank)",
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
