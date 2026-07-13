/**
 * Repair packages ("bundles") shown at the top of the Services page and on
 * their own detail pages (/packages/:slug).
 *
 * Not backed by real catalog services yet — each package is a flat, hand-set
 * price rather than a sum of underlying service line items. `includedCategories`
 * exists purely to drive the "what's included" comparison table on
 * PackageDetail.tsx; it doesn't affect pricing or what actually gets booked
 * (that's still just the flat bundle price, added to the bag as one line item
 * — see StartRepairPick.tsx's bundle path).
 *
 * Shared between Services.tsx (the grid of cards) and PackageDetail.tsx (the
 * page a card's image/title link into), so renaming or re-pricing a package
 * only needs to happen in one place.
 */

/** The 5 standard repair categories used to build the "included / not
 *  included" comparison across packages. "Just a Shine" is deliberately not
 *  one of these — see `includesJustAShine` below — since Danielle's spec
 *  treats it as its own standalone offering, not a slice of these 5. */
export type IncludedCategoryKey = "surface" | "sole" | "interior" | "stitching" | "preventative";

export type IncludedCategory = {
  key: IncludedCategoryKey;
  label: string;
  /** What that category covers, in the same "Label: items" phrasing used in
   *  both the Included and Not included lists on a package's detail page. */
  items: string;
};

export const INCLUDED_CATEGORIES: IncludedCategory[] = [
  { key: "surface", label: "Surface restoration", items: "Cleaning & conditioning, Scuff, stain, & color restoration" },
  { key: "sole", label: "Sole repair", items: "Resole (includes heel tip repair if applicable)" },
  { key: "interior", label: "Interior repair", items: "Insole replacement, Lining repair" },
  { key: "stitching", label: "Stitching & securing", items: "Heel, hardware, buckle, zipper, and seam repair" },
  { key: "preventative", label: "Preventative care", items: "Waterproofing, Protective soles" },
];

export type Bundle = {
  /** Stable URL slug for /packages/:slug — independent of the display name,
   *  so renaming a package (see Danielle's naming passes) doesn't change or
   *  break its URL. */
  slug: string;
  name: string;
  popular: boolean;
  bestFor: string;
  /** Longer copy shown on the package's own detail page, under "Best for". */
  description: string;
  price: string;
  /** Which of the 5 standard categories this package covers. "Not included"
   *  is always the complement of this against INCLUDED_CATEGORIES — never
   *  stored separately, so the two lists can't drift out of sync. */
  includedCategories: IncludedCategoryKey[];
  /** True only for "Just a Shine" — a standalone shine/polish offering, not
   *  a slice of the 5 categories above. Adds its own "Just a shine" line to
   *  the Included list and its own row in the cross-package comparison
   *  table, without participating in the 5-category complement logic. */
  includesJustAShine?: boolean;
  /** Whether choosing this package should ask the dye/paint consent question
   *  before proceeding — mirrors PAINT_CONSENT_SLUGS for individual services. */
  requiresPaintConsent: boolean;
  /** Brands Cobbli can't currently service under this package. Empty when
   *  the package doesn't touch anything those brands restrict. */
  unsupportedBrands: string[];
};

export const BUNDLES: Bundle[] = [
  {
    slug: "full-restoration",
    name: "Full restoration",
    popular: false,
    bestFor: "Shoes that need a full revamp or are experiencing damage beyond everyday wear",
    description:
      "We assess your shoes top to bottom and take care of everything they need. The only things not included are purely elective changes, like dyeing your shoes a new color.",
    price: "$250",
    includedCategories: ["surface", "sole", "interior", "stitching", "preventative"],
    requiresPaintConsent: true,
    unsupportedBrands: ["Christian Louboutin", "Golden Goose", "Maison Margiela"],
  },
  {
    slug: "standard-service",
    name: "Standard repair (sole, upper, & interior)",
    popular: false,
    bestFor: "Shoes showing day-to-day wear on the sole, surface, and inside of the shoe",
    description:
      "We address surface damage, worn soles, and interior wear so your shoes look and feel refreshed. Seam repair, hardware and zipper repairs, and preventative care aren't included.",
    price: "$200",
    includedCategories: ["surface", "sole", "interior"],
    requiresPaintConsent: true,
    unsupportedBrands: ["Christian Louboutin", "Golden Goose", "Maison Margiela"],
  },
  {
    slug: "full-exterior-repair",
    name: "Exterior repair (sole & upper)",
    popular: true,
    bestFor: "Shoes with day-to-day wear on the surface and sole",
    description:
      "We resole your shoes, repair surface damage, and clean and condition your shoes so they look and feel refreshed.",
    price: "$125",
    includedCategories: ["surface", "sole"],
    requiresPaintConsent: true,
    unsupportedBrands: ["Christian Louboutin", "Golden Goose", "Maison Margiela"],
  },
  {
    slug: "upper-repair",
    name: "Upper repair",
    popular: true,
    bestFor: "Shoes with surface damage, dullness, and/or discoloration",
    description:
      "We clean, condition, and restore the exterior of your shoes so the surface looks its best and material is restored.",
    price: "$100",
    includedCategories: ["surface"],
    requiresPaintConsent: true,
    unsupportedBrands: [],
  },
  {
    slug: "interior-repair",
    name: "Interior repair",
    popular: false,
    bestFor: "Shoes with interior wear",
    description:
      "We replace your insole and patch any damage to your shoe's inner lining so your shoes feel comfortable and the interior is protected from further deterioration.",
    price: "$100",
    includedCategories: ["interior"],
    requiresPaintConsent: false,
    unsupportedBrands: ["Christian Louboutin", "Golden Goose", "Maison Margiela"],
  },
  {
    slug: "sole-repair",
    name: "Sole repair",
    popular: true,
    bestFor: "Shoes that have a worn down or separated sole",
    description:
      "We replace the sole completely, restoring the grip, structure, and feel you've been missing.",
    price: "$85",
    includedCategories: ["sole"],
    requiresPaintConsent: false,
    unsupportedBrands: [],
  },
  {
    slug: "preventative-care",
    name: "Preventative care",
    popular: false,
    bestFor: "Protecting shoes you want to last or preventing more costly repairs down the line",
    description:
      "We waterproof your shoes and apply protective soles to shield against moisture and wear. When a protective sole eventually wears down, we can simply replace the protective layer — no invasive resole needed.",
    price: "$60",
    includedCategories: ["preventative"],
    requiresPaintConsent: false,
    unsupportedBrands: [],
  },
  {
    slug: "just-a-shine",
    name: "Just a Shine",
    popular: true,
    bestFor: "Shoes that need a quick polish and shine",
    description: "We restore the gloss to your shoes, leaving them looking sharp and well-maintained.",
    price: "$20",
    includedCategories: [],
    includesJustAShine: true,
    requiresPaintConsent: false,
    unsupportedBrands: [],
  },
];

export const bundleBySlug = (slug: string): Bundle | undefined =>
  BUNDLES.find((b) => b.slug === slug);

/** The complement of a package's includedCategories against the fixed list —
 *  the single source of truth for "Not included," so it can never drift out
 *  of sync with what's actually marked included. */
export const notIncludedCategories = (bundle: Bundle): IncludedCategory[] =>
  INCLUDED_CATEGORIES.filter((c) => !bundle.includedCategories.includes(c.key));

/** "$250" -> 25000 (cents) — bundles are flat-priced, not yet backed by real
 * catalog services, so this is the only price source for a bundle bag item. */
export const bundlePriceToCents = (price: string): number =>
  Math.round(parseFloat(price.replace(/[^0-9.]/g, "")) * 100);
