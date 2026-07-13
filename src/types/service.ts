// Shared service types & utilities. Service records come from Supabase via
// `useServices`. This module only holds the shape and helpers used by the UI.

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

export type ServiceCategory =
  | "Sole"
  | "Heel"
  | "Cleaning"
  | "Color, scuffs, & shine"
  | "Inside of shoe"
  | "Preventative care"
  | "Straps, buckles, & hardware"
  | "Tears & holes"
  | "Zipper"
  | "Fit";

export const CATEGORIES_ORDERED: ServiceCategory[] = [
  "Sole",
  "Heel",
  "Cleaning",
  "Color, scuffs, & shine",
  "Inside of shoe",
  "Preventative care",
  "Straps, buckles, & hardware",
  "Tears & holes",
  "Zipper",
];

/** Premium brands shown in the "Which brands are premium?" expandable on detail pages. */
export const PREMIUM_BRANDS = [
  "Amina Muaddi",
  "Aquazzura",
  "Balenciaga",
  "Bottega Veneta",
  "Chanel",
  "Christian Louboutin",
  "Golden Goose",
  "Gucci",
  "Hermès",
  "Jimmy Choo",
  "Maison Margiela",
  "Manolo Blahnik",
  "Miu Miu",
  "Prada",
  "Saint Laurent",
  "Valentino",
] as const;

export type ServiceVariant = {
  key: string;
  label: string;
  standard: number;
  premium?: number;
  rank: number;
};

export type QAOption = {
  label: string;
  hint?: string;
  variantKey?: string;
  priceLabel?: string;
  note?: string;
};

export type QAConfig = {
  question: string;
  hint?: string;
  options: QAOption[];
};

export type Service = {
  id: string;
  slug: string;
  name: string;
  /** Short text shown on service cards. */
  description: string;
  /** Longer richly-worded description shown on the service detail page.
   *  Falls back to `description` when not set. */
  fullDescription?: string;
  cardName: string;
  cardPriceLabel: string;
  categories: ServiceCategory[];
  rank: number;
  isComingSoon: boolean;
  variants: ServiceVariant[];
  qa?: QAConfig;
  /** Representative "before" photo for this service's card/detail page.
   *  Falls back to the solid brand-color placeholder when not set. */
  imageUrl?: string;
};

/** Lowest standard variant price (dollars), used by the repair flow back-compat. */
export const minPrice = (s: Service) =>
  s.variants.length === 0 ? 0 : Math.min(...s.variants.map((v) => v.standard));

/** True when the service has any premium variant or multiple standard prices. */
export const hasPremiumColumn = (s: Service) =>
  s.variants.some((v) => v.premium !== undefined && v.premium !== v.standard);

/**
 * Back-compat helper used by the existing repair flow's `SelectServices` page.
 * Picks the variant best matching the shoe type (for waterproofing-style
 * shoe-type variants), otherwise returns the first variant's standard price.
 */
export const priceForShoeType = (s: Service, shoeType: ShoeType): number => {
  if (s.variants.length === 0) return 0;
  const lookup: Record<string, string> = {
    Boots: "boots",
    "Ankle boots": "ankle_boots",
  };
  const wanted = lookup[shoeType] ?? "other";
  const byShoe = s.variants.find((v) => v.key === wanted);
  if (byShoe) return byShoe.standard;
  return s.variants[0].standard;
};

/** All services are now eligible for all shoe types — final eligibility is determined at assessment. */
export const isEligibleForShoeType = (_s: Service, _shoeType: ShoeType) => true;

/**
 * Price (in dollars) for the full-resole service given a known sole material and
 * care tier. Returns null when the material isn't recognised in the catalog.
 */
export const fullResolePrice = (
  s: Service,
  premium: boolean,
  material: "Leather" | "Rubber",
): number | null => {
  const v = s.variants.find((x) => x.key === material.toLowerCase());
  if (!v) return null;
  return premium && v.premium !== undefined ? v.premium : v.standard;
};
