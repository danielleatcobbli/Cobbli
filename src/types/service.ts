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

// Unified 2026-07-23 (Danielle's call): the Services page/homepage filter
// bar and the Start a Repair checklist previously used two different
// category taxonomies (this union used to carry both a set of real-catalog
// categories and a separate set of "checklist-only" ones, matched up ad hoc
// per service). She wants "one and the same" — same categories, same names,
// same icons, everywhere a category shows up. These 9 are exactly
// CHECKLIST_GROUPS' own categories (starterRepairConditions.ts), in the same
// order, and are now the only ServiceCategory values that exist — every real
// catalog service's `categories` column is tagged with these directly.
//
// Two categories from the old catalog taxonomy had no checklist equivalent
// at all (Preventative care, Fit) since waterproofing/protective soles/shoe
// stretching aren't "problems" a customer selects, they're add-ons or a fit
// adjustment. Per Danielle's explicit call, these were folded into whichever
// of the 9 fits best rather than kept as their own bucket — see the Supabase
// migration notes for exactly where each landed (Protective soles -> Sole &
// heel, Waterproofing -> Material & finish, Shoe stretching -> Material &
// finish — renamed from "Material & shape" 2026-07-27 once "Shoes losing
// shape" was removed as a condition, see starterRepairConditions.ts). Same
// for "Sole"/"Heel" as separate single-word tags and "Odor" as
// distinct from "Cleaning & odor" — both were legacy/vestigial and are gone
// now that every sole/heel service is tagged "Sole & heel" directly.
export type ServiceCategory =
  | "Sole & heel"
  // Renamed from "Scuffs & holes" 2026-07-31 (Danielle's call) — patch
  // repair and lining repair (the "holes"/lining side of this category)
  // went is_coming_soon as part of the MVP launch scope-down, leaving only
  // Scuffs and Scratches live on the checklist. Same category value used
  // for Services-page filtering, so coming-soon services tagged here still
  // show up there (with the existing coming-soon + vote treatment), just
  // under the new name.
  | "Scuffs & scratches"
  | "Color & stains"
  | "Material & finish"
  | "Insole & interior"
  // "Stitching & seams", "Straps, buckles, & hardware", and "Zipper" removed
  // 2026-07-31 (Danielle's call, MVP scope-down) — every service under all
  // three (stitching, zipper-replacement, zipper-slider-replacement) is now
  // is_coming_soon, so there are no live services left to browse or filter
  // by in any of them. Unlike the earlier pass (which only pulled these from
  // the checklist), this removes them from the Services page filter bar too
  // — no category should exist with zero live services in it. The services
  // themselves are untouched in Supabase (including their old category
  // tags); they just won't have a dedicated filter pill until one of these
  // three categories comes back. Re-add here (and to CATEGORIES_ORDERED /
  // CategoryFilterBar's CATEGORY_ICONS) once any service in a category is
  // live again.
  | "Cleaning & odor";

// Alphabetical (2026-07-23, Danielle's call — categories should be
// predictable/scannable rather than frequency-ordered; must stay in sync
// with CHECKLIST_GROUPS' own order in starterRepairConditions.ts since the
// two taxonomies are unified).
export const CATEGORIES_ORDERED: ServiceCategory[] = [
  "Cleaning & odor",
  "Color & stains",
  "Insole & interior",
  "Material & finish",
  "Scuffs & scratches",
  "Sole & heel",
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
  /** Brands this service can't currently be booked for (2026-08-11, resole
   *  brand gating) — e.g. full-resole excludes Louboutin and Maison Margiela
   *  since Cobbli doesn't have the right sole source for them yet. Empty for
   *  services with no brand restriction. */
  excludedBrands: string[];
  variants: ServiceVariant[];
  qa?: QAConfig;
  /** Representative "before" photo for this service's card/detail page.
   *  Falls back to the solid brand-color placeholder when not set. */
  imageUrl?: string;
  /** "After" photo — swaps in on hover over the card image (see
   *  BeforeAfterImage). Optional and usually unset for now (2026-07-22): we
   *  don't have real after photos yet, so hover is a no-op until one exists. */
  afterImageUrl?: string;
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

/** Every variant key full-resole can be priced by, once a customer has gone
 *  through the brand-then-sole picker (2026-08-11) — "lug" isn't its own
 *  catalog variant (it's priced the same as standard rubber, Danielle's
 *  call), so callers should resolve a "lug" pick to "rubber" before calling
 *  this. Brand keys are lowercase-kebab to match variant_key in Supabase. */
export type ResolePriceKey = "leather" | "rubber" | "birkenstock" | "golden-goose";

/** Price (in dollars) for full-resole by variant key directly — the general
 *  form of fullResolePrice above, covering the brand-specific variants
 *  (Birkenstock, Golden Goose) that a Leather/Rubber-only lookup can't
 *  reach. Returns null when the key has no matching variant yet. */
export const resolePriceForKey = (s: Service, key: ResolePriceKey): number | null => {
  const v = s.variants.find((x) => x.key === key);
  return v ? v.standard : null;
};
