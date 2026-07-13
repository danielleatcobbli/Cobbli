/**
 * "What's going on with your shoes?" — the Starter repair condition
 * checklist. Maps each condition a customer can select to a real catalog
 * service slug, and drives the package-vs-individual-services recommendation
 * logic, per Danielle's spec (reviewed and approved as an interactive mockup
 * before this was wired up).
 *
 * Slugs are matched against the live Supabase service catalog (via
 * useServices()) at recommendation time — see computeRecommendation() below
 * — so pricing, names, and "coming soon" status always reflect the real
 * catalog, never a hardcoded snapshot.
 *
 * Known catalog gaps (flagged to Danielle, not silently invented):
 * - "Broken or missing strap" has no matching real service at all (no
 *   strap-replacement slug exists yet) — treated as not-offered, same as a
 *   coming-soon service, until a real service exists to map it to.
 * - "Broken or missing hardware" has no matching real service either (no
 *   hardware-replacement slug — only buckle-replacement exists, and that one
 *   is coming-soon) — also treated as not-offered.
 * - "Broken heel" (-> heel-replacement) and "Broken or missing buckle"
 *   (-> buckle-replacement) both map to real slugs that exist but are
 *   isComingSoon — correctly treated as not-offered rather than a special case.
 */

import { minPrice, type Service, type ServiceCategory } from "@/types/service";
import { BUNDLES, bundleBySlug, type IncludedCategoryKey } from "@/data/bundles";

export type Condition = { label: string; slug: string };

/**
 * A single display group on the "What's going on with your shoes?" checklist.
 * Each group corresponds 1:1 to a real, catalog-wide service category (see
 * CATEGORIES_ORDERED in types/service.ts and the icons in
 * CategoryFilterBar.tsx) so the checklist and the Services page always use
 * the exact same category names and icons — no separate sub-category labels
 * nested inside (Danielle's call, to keep the checklist "tight").
 *
 * A condition can legitimately appear in more than one group — e.g. "Worn or
 * missing heel tip" shows under both Sole and Heel, and the three "Loose or
 * detached ___" conditions show under both Straps/buckles/hardware and Tears
 * & holes — Danielle confirmed the duplication is intentional. Checking a
 * condition in one group also checks it in the other, since both checkboxes
 * are keyed off the same label in shared state.
 */
export type ChecklistGroup = { serviceCategory: ServiceCategory; conditions: Condition[] };

export const CHECKLIST_GROUPS: ChecklistGroup[] = [
  { serviceCategory: "Sole", conditions: [
    { label: "Worn or damaged sole", slug: "full-resole" },
    { label: "Worn or missing heel tip", slug: "high-heel-tip-replacement" } ] },
  { serviceCategory: "Heel", conditions: [
    { label: "Loose or separated heel", slug: "heel-reattachment" },
    { label: "Broken heel", slug: "heel-replacement" },
    { label: "Worn or missing heel tip", slug: "high-heel-tip-replacement" } ] },
  { serviceCategory: "Color, scuffs, & shine", conditions: [
    { label: "Surface scuffs or scratches", slug: "color-restoration" },
    { label: "Faded or streaky color", slug: "color-restoration" },
    { label: "Dull or dry material", slug: "color-restoration" } ] },
  { serviceCategory: "Inside of shoe", conditions: [
    { label: "Worn or damaged insole", slug: "insole-replacement" },
    { label: "Holes inside of shoe", slug: "lining-repair" } ] },
  { serviceCategory: "Straps, buckles, & hardware", conditions: [
    { label: "Loose or detached strap", slug: "strap-repair" },
    { label: "Broken or missing strap", slug: "strap-replacement" },
    { label: "Loose or detached hardware", slug: "hardware-repair" },
    { label: "Broken or missing hardware", slug: "hardware-replacement" },
    { label: "Loose or detached buckle", slug: "buckle-repair" },
    { label: "Broken or missing buckle", slug: "buckle-replacement" } ] },
  { serviceCategory: "Tears & holes", conditions: [
    { label: "Loose stitching", slug: "seam-repair" },
    { label: "Loose or detached strap", slug: "strap-repair" },
    { label: "Loose or detached hardware", slug: "hardware-repair" },
    { label: "Loose or detached buckle", slug: "buckle-repair" } ] },
  { serviceCategory: "Zipper", conditions: [
    { label: "Broken or detached zipper", slug: "zipper-reattachment" },
    { label: "Broken or detached zipper slider", slug: "zipper-slider-replacement" } ] },
];

/** Canonical slug -> package category mapping, used only for the
 *  package-vs-individual-services recommendation logic below. Kept separate
 *  from CHECKLIST_GROUPS (display) on purpose: a condition's package
 *  category is a fixed catalog fact, independent of which group(s) it's
 *  visually shown under — e.g. heel tip is "sole" for pricing/package
 *  purposes even though it's displayed in both the Sole and Heel groups. */
const CONDITION_PKG_CAT: Record<string, IncludedCategoryKey> = {
  "full-resole": "sole",
  "high-heel-tip-replacement": "sole",
  "heel-reattachment": "stitching",
  "heel-replacement": "stitching",
  "insole-replacement": "interior",
  "lining-repair": "interior",
  "color-restoration": "surface",
  "strap-repair": "stitching",
  "strap-replacement": "stitching",
  "hardware-repair": "stitching",
  "hardware-replacement": "stitching",
  "buckle-repair": "stitching",
  "buckle-replacement": "stitching",
  "seam-repair": "stitching",
  "zipper-reattachment": "stitching",
  "zipper-slider-replacement": "stitching",
};

export type Addon = { label: string; slug: string; pkgCat: IncludedCategoryKey | null };

export const ADDONS: Addon[] = [
  { label: "Shoe shine", slug: "shoe-shine", pkgCat: null },
  { label: "Waterproofing", slug: "waterproofing", pkgCat: "preventative" },
  { label: "Protective soles", slug: "protective-full-sole", pkgCat: "preventative" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Package selection rules — evaluated in this order; first match wins.
// Sole repair and Just a Shine are never auto-selected (Danielle's call —
// they're priced the same as their one underlying service, so there's no
// benefit to routing through the package).
// ─────────────────────────────────────────────────────────────────────────────

type PackageRule = {
  bundleSlug: string;
  cats: IncludedCategoryKey[];
  /** Custom condition-based rule (checked against condition *labels*, plus
   *  the resolved set of required service slugs for rules like Preventative
   *  care that key off add-ons rather than checklist conditions). Omitted
   *  for the three "value exceeds price" packages, which use cats + prices
   *  instead. */
  custom?: (checkedLabels: Set<string>, requiredSlugs: Set<string>) => boolean;
};

export const PACKAGE_RULES: PackageRule[] = [
  { bundleSlug: "full-restoration", cats: ["sole", "surface", "interior", "stitching", "preventative"] },
  { bundleSlug: "standard-service", cats: ["surface", "sole", "interior"] },
  { bundleSlug: "full-exterior-repair", cats: ["surface", "sole"] },
  {
    bundleSlug: "upper-repair",
    cats: ["surface"],
    custom: (checked) =>
      checked.has("Dull or dry material") &&
      (checked.has("Faded or streaky color") || checked.has("Surface scuffs or scratches")),
  },
  {
    bundleSlug: "interior-repair",
    cats: ["interior"],
    custom: (checked) => checked.has("Worn or damaged insole") && checked.has("Holes inside of shoe"),
  },
  {
    bundleSlug: "preventative-care",
    cats: ["preventative"],
    custom: (_checked, required) => required.has("waterproofing") && required.has("protective-full-sole"),
  },
];

const slugToPkgCat = new Map<string, IncludedCategoryKey | null>(Object.entries(CONDITION_PKG_CAT));
ADDONS.forEach((a) => { if (!slugToPkgCat.has(a.slug)) slugToPkgCat.set(a.slug, a.pkgCat); });

export type RecommendedPackage = {
  bundleSlug: string;
  name: string;
  price: string;
  /** Required slugs this package's price/rule was evaluated against. */
  covers: string[];
};

/** Display names for slugs referenced by this checklist that don't exist in
 *  the catalog at all yet (as opposed to existing-but-isComingSoon, which
 *  already has a real name to fall back on). See the file header note on
 *  known catalog gaps. */
const FALLBACK_SERVICE_NAMES: Record<string, string> = {
  "strap-replacement": "Strap replacement",
  "hardware-replacement": "Hardware replacement",
};

export type RecommendationResult = {
  /** Services the customer effectively asked for that Cobbli doesn't
   *  currently offer (missing from the catalog entirely, or isComingSoon). */
  notOffered: { slug: string; name: string }[];
  /** The package to recommend instead of (some of) the itemized services, if any. */
  package: RecommendedPackage | null;
  /** Individually-priced services to show — either everything (no package
   *  matched) or whatever the chosen package doesn't cover. */
  individual: { slug: string; name: string; price: number }[];
};

/**
 * Computes the recommendation for a given set of checked condition labels +
 * addon slugs, against the live service catalog (so pricing/availability is
 * always current).
 */
export function computeRecommendation(
  checkedConditionLabels: Set<string>,
  requiredSlugsRaw: Set<string>,
  services: Service[],
): RecommendationResult {
  const bySlug = new Map(services.map((s) => [s.slug, s]));
  const requiredSlugs = Array.from(requiredSlugsRaw);

  const notOffered: { slug: string; name: string }[] = [];
  const offered: string[] = [];
  for (const slug of requiredSlugs) {
    const svc = bySlug.get(slug);
    if (!svc || svc.isComingSoon) {
      notOffered.push({ slug, name: svc?.name ?? FALLBACK_SERVICE_NAMES[slug] ?? slug });
    } else {
      offered.push(slug);
    }
  }

  const offeredSet = new Set(offered);
  let chosen: RecommendedPackage | null = null;
  let coveredSlugs: string[] = [];

  for (const rule of PACKAGE_RULES) {
    const bundle = bundleBySlug(rule.bundleSlug);
    if (!bundle) continue;
    const inScope = offered.filter((slug) => rule.cats.includes(slugToPkgCat.get(slug) as IncludedCategoryKey));
    if (inScope.length === 0) continue;

    const qualifies = rule.custom
      ? rule.custom(checkedConditionLabels, offeredSet)
      : inScope.reduce((sum, slug) => {
          const svc = bySlug.get(slug);
          return sum + (svc ? priceCentsFor(svc) : 0);
        }, 0) > bundlePriceCents(bundle.price);

    if (qualifies) {
      chosen = { bundleSlug: bundle.slug, name: bundle.name, price: bundle.price, covers: inScope };
      coveredSlugs = inScope;
      break;
    }
  }

  const leftoverSlugs = chosen ? offered.filter((s) => !coveredSlugs.includes(s)) : offered;
  const individual = leftoverSlugs.map((slug) => {
    const svc = bySlug.get(slug);
    return { slug, name: svc?.name ?? slug, price: svc ? priceCentsFor(svc) : 0 };
  });

  return { notOffered, package: chosen, individual };
}

/** Price in cents for a service, using its lowest standard variant — matches
 *  the simple "one price per pair" display used on this checklist's results
 *  screen (live per-shoe-type/premium pricing still applies later, when the
 *  item is actually added to a specific pair in the bag — see
 *  useLivePricedBag, which re-derives the real price from the slug). */
function priceCentsFor(s: Service): number {
  return minPrice(s) * 100;
}

function bundlePriceCents(price: string): number {
  return Math.round(parseFloat(price.replace(/[^0-9.]/g, "")) * 100);
}

/** Every bundle referenced by PACKAGE_RULES must exist in bundles.ts — a
 *  cheap sanity check so a future rename that misses this file fails loudly
 *  (via a console warning) instead of silently never recommending a package. */
PACKAGE_RULES.forEach((r) => {
  if (!BUNDLES.some((b) => b.slug === r.bundleSlug)) {
    console.warn(`starterRepairConditions: no bundle found for slug "${r.bundleSlug}"`);
  }
});
