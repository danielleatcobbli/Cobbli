// Shared service types & utilities. Service records themselves come from
// Supabase via `useServices`; this module only holds the shape and helpers.

export type ShoeType =
  | "Ankle boots"
  | "Boots"
  | "Flats"
  | "Heels"
  | "Loafers"
  | "Sandals"
  | "Sneakers";

export const SHOE_TYPES: ShoeType[] = [
  "Ankle boots",
  "Boots",
  "Flats",
  "Heels",
  "Loafers",
  "Sandals",
  "Sneakers",
];

/**
 * Simplified pricing tiers. Every service stores up to three prices — one per
 * tier. Services that cost the same across all shoe types store a single
 * price applied to all three tiers.
 */
export type PriceTier = "Other" | "Ankle boots" | "Boots";

/** Display order for the pricing table: Ankle boots / Boots / All other shoes. */
export const PRICE_TIERS_ORDERED: PriceTier[] = ["Ankle boots", "Boots", "Other"];

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  Other: "All other shoes",
  "Ankle boots": "Ankle boots",
  Boots: "Boots",
};

/** Map a specific shoe type to its pricing tier. */
export const tierForShoeType = (t: ShoeType): PriceTier => {
  if (t === "Boots") return "Boots";
  if (t === "Ankle boots") return "Ankle boots";
  return "Other";
};

export type ServiceCategory =
  | "Cleaning"
  | "Preventative care"
  | "Sole or heel repair"
  | "Strap repair"
  | "Zipper repair";

export const CATEGORIES_ORDERED: ServiceCategory[] = [
  "Cleaning",
  "Preventative care",
  "Sole or heel repair",
  "Strap repair",
  "Zipper repair",
];

export type Service = {
  slug: string;
  name: string;
  description: string;
  /** Per-tier pricing in dollars. A missing tier means the service is not eligible for that tier. */
  pricing: Partial<Record<PriceTier, number>>;
  categories: ServiceCategory[];
  /** Lower number = higher rank. */
  rank: number;
};

/** True when the service has more than one distinct tier price. */
export const isPriceRange = (s: Service) => {
  const prices = Object.values(s.pricing);
  if (prices.length <= 1) return false;
  return new Set(prices).size > 1;
};

/** Lowest price across eligible tiers, in dollars. */
export const minPrice = (s: Service) => Math.min(...Object.values(s.pricing));

export const isEligibleForTier = (s: Service, tier: PriceTier) =>
  s.pricing[tier] !== undefined;

export const isEligibleForShoeType = (s: Service, shoeType: ShoeType) =>
  isEligibleForTier(s, tierForShoeType(shoeType));

/** Price for a given shoe type, in dollars. Undefined when not eligible. */
export const priceForShoeType = (s: Service, shoeType: ShoeType) =>
  s.pricing[tierForShoeType(shoeType)];
