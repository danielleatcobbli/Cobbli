// Placeholder service data — to be replaced with finalized list, prices, and rankings.

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
  /** Per-shoe-type pricing in dollars. If a shoe type is missing, the service is not eligible. */
  pricing: Partial<Record<ShoeType, number>>;
  categories: ServiceCategory[];
  /** Lower number = higher rank. */
  rank: number;
};

// Placeholder set — names/descriptions/prices are intentionally generic.
export const SERVICES: Service[] = [
  {
    slug: "service-1",
    name: "Service name",
    description: "Service description",
    pricing: { "Heels": 0, "Flats": 0, "Loafers": 0, "Sneakers": 0, "Ankle boots": 0, "Boots": 0, "Sandals": 0 },
    categories: ["Sole or heel repair"],
    rank: 1,
  },
  {
    slug: "service-2",
    name: "Service name",
    description: "Service description",
    pricing: { "Ankle boots": 0, "Boots": 0, "Heels": 0 },
    categories: ["Sole or heel repair"],
    rank: 2,
  },
  {
    slug: "service-3",
    name: "Service name",
    description: "Service description",
    pricing: { "Ankle boots": 0, "Boots": 0 },
    categories: ["Zipper repair"],
    rank: 1,
  },
  {
    slug: "service-4",
    name: "Service name",
    description: "Service description",
    pricing: { "Sandals": 0, "Heels": 0, "Flats": 0 },
    categories: ["Strap repair"],
    rank: 1,
  },
  {
    slug: "service-5",
    name: "Service name",
    description: "Service description",
    pricing: { "Heels": 0, "Flats": 0, "Loafers": 0, "Sneakers": 0, "Ankle boots": 0, "Boots": 0, "Sandals": 0 },
    categories: ["Cleaning"],
    rank: 1,
  },
  {
    slug: "service-6",
    name: "Service name",
    description: "Service description",
    pricing: { "Heels": 0, "Flats": 0, "Loafers": 0, "Sneakers": 0, "Ankle boots": 0, "Boots": 0 },
    categories: ["Preventative care"],
    rank: 1,
  },
  {
    slug: "service-7",
    name: "Service name",
    description: "Service description",
    pricing: { "Sneakers": 0, "Loafers": 0, "Flats": 0, "Heels": 0, "Ankle boots": 0, "Boots": 0, "Sandals": 0 },
    categories: ["Cleaning", "Preventative care"],
    rank: 2,
  },
  {
    slug: "service-8",
    name: "Service name",
    description: "Service description",
    pricing: { "Heels": 0, "Loafers": 0, "Flats": 0 },
    categories: ["Sole or heel repair"],
    rank: 3,
  },
];

export const getService = (slug: string) => SERVICES.find((s) => s.slug === slug);

/** True when the service has more than one distinct shoe-type price. */
export const isPriceRange = (s: Service) => {
  const prices = Object.values(s.pricing);
  if (prices.length <= 1) return false;
  return new Set(prices).size > 1;
};

/** Lowest price across eligible shoe types, in dollars. */
export const minPrice = (s: Service) => Math.min(...Object.values(s.pricing));

export const isEligibleForShoeType = (s: Service, shoeType: ShoeType) =>
  s.pricing[shoeType] !== undefined;
