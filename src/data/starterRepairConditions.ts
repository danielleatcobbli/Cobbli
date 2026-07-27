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
 * - "Broken heel" (-> heel-replacement) and "Broken or missing hardware" /
 *   "Broken or missing buckle" (both -> hardware-replacement) map to real
 *   slugs that exist but are isComingSoon — correctly treated as not-offered
 *   rather than a special case.
 *
 * Hardware and buckle repair/replacement are each ONE real catalog service
 * ("Hardware or buckle repair" / "Hardware or buckle replacement", slugs
 * hardware-repair / hardware-replacement) — there's no separate buckle-repair
 * or buckle-replacement slug (a live-data check on 2026-07-15 confirmed this;
 * an earlier version of this file pointed the buckle conditions at those
 * non-existent slugs, which incorrectly showed them as not-offered). The
 * hardware and buckle checklist rows are kept as separate, visually distinct
 * conditions on purpose — same pattern as the three color-restoration rows
 * below — even though they resolve to the same underlying service, since a
 * customer identifying their issue is looking for the photo that matches it,
 * not the slug behind it.
 */

import { minPrice, type Service, type ServiceCategory } from "@/types/service";
import { BUNDLES, bundleBySlug, type IncludedCategoryKey } from "@/data/bundles";

export type Condition = {
  label: string;
  slug: string;
  /** Optional photo/illustration for this specific condition, shown next to
   *  the checkbox on the "What's going on with your shoes?" checklist. Falls
   *  back to the category icon (CATEGORY_ICONS in CategoryFilterBar.tsx) when
   *  not set — no real per-condition photography exists yet, so every
   *  condition renders with its category's icon until real images are added
   *  here one at a time. */
  imageUrl?: string;
};

/**
 * A single display group on the "What's going on with your shoes?" checklist.
 * Each group corresponds 1:1 to a real, catalog-wide service category (see
 * CATEGORIES_ORDERED in types/service.ts and the icons in
 * CategoryFilterBar.tsx) so the checklist and the Services page always use
 * the exact same category names and icons — no separate sub-category labels
 * nested inside (Danielle's call, to keep the checklist "tight").
 *
 * A condition can legitimately appear in more than one group — e.g. the three
 * "Loose or detached ___" conditions show under both Straps/buckles/hardware
 * and Tears, holes, & stitching — Danielle confirmed the duplication is
 * intentional. Checking a condition in one group also checks it in the
 * other, since both checkboxes are keyed off the same label in shared state.
 * ("Worn or missing heel tip" used to be duplicated across separate Sole and
 * Heel groups too, until those merged into one "Sole & Heel" group on
 * 2026-07-16 — merging removed the need for that particular duplicate.)
 */
export type ChecklistGroup = { serviceCategory: ServiceCategory; conditions: Condition[] };

// Group order (2026-07-16, Danielle's call): Sole & Heel, Color/scuffs/shine,
// Insole, Tears/holes/stitching, Zipper, Straps/buckles/hardware — the
// natural consequence of merging Sole+Heel into one group (removing the
// separate "Heel" slot) while keeping her original ordering intent from
// 2026-07-15 otherwise intact. Uses the same "Sole & Heel" ServiceCategory
// as the Services page filter bar (see CategoryFilterBar.tsx) — it's a
// UI-only grouping value, never a real per-service tag, so reusing it here
// costs nothing and keeps the icon (the sole icon) consistent everywhere.
// "Insole" and "Tears, holes, & stitching" are display-only renames of the
// real "Inside of shoe"/"Tears & holes" categories — see
// categoryDisplayLabel() in CategoryFilterBar.tsx — so this file still uses
// the real category names below; StartRepair.tsx renders the display name.
export const CHECKLIST_GROUPS: ChecklistGroup[] = [
  { serviceCategory: "Sole & Heel", conditions: [
    { label: "Worn or damaged sole", slug: "full-resole" },
    { label: "Sole separating from shoe", slug: "full-resole" },
    { label: "Worn or missing heel tip", slug: "high-heel-tip-replacement" },
    { label: "Loose or separated heel", slug: "heel-reattachment" },
    { label: "Broken heel", slug: "heel-replacement" } ] },
  { serviceCategory: "Color, scuffs, & shine", conditions: [
    { label: "Scuffs or scratches", slug: "color-restoration" },
    { label: "Faded or streaky color", slug: "color-restoration" },
    { label: "Dull or dry material", slug: "color-restoration" } ] },
  // Displayed as "Insole" (see categoryDisplayLabel) — narrower and more
  // concrete than "Inside of shoe" now that "Holes inside of shoe" has moved
  // to living solely in Tears, holes, & stitching below: everything left
  // here is specifically about the insole itself, not the shoe's interior
  // generally.
  { serviceCategory: "Inside of shoe", conditions: [
    { label: "Worn or damaged insole", slug: "insole-replacement" },
    { label: "Loose insole", slug: "insole-replacement" } ] },
  // Displayed as "Tears, holes, & stitching" (see categoryDisplayLabel) —
  // Danielle's call: a separated seam doesn't read as a "tear" to most
  // customers, so the category name says stitching outright instead of
  // relying on "holes" to imply it.
  { serviceCategory: "Tears & holes", conditions: [
    { label: "Loose stitching", slug: "seam-repair" },
    { label: "Loose or detached strap", slug: "strap-repair" },
    { label: "Loose or detached hardware", slug: "hardware-repair" },
    { label: "Loose or detached buckle", slug: "hardware-repair" },
    { label: "Holes inside of shoe", slug: "lining-repair" } ] },
  { serviceCategory: "Zipper", conditions: [
    { label: "Broken or detached zipper", slug: "zipper-reattachment" },
    { label: "Broken or detached zipper slider", slug: "zipper-slider-replacement" } ] },
  { serviceCategory: "Straps, buckles, & hardware", conditions: [
    { label: "Loose or detached strap", slug: "strap-repair" },
    { label: "Broken or missing strap", slug: "strap-replacement" },
    { label: "Loose or detached hardware", slug: "hardware-repair" },
    { label: "Broken or missing hardware", slug: "hardware-replacement" },
    { label: "Loose or detached buckle", slug: "hardware-repair" },
    { label: "Broken or missing buckle", slug: "hardware-replacement" } ] },
  // New (2026-07-16, Danielle's call) now that deodorizing-treatment is a
  // real offered service — placed last since it's a less common concern
  // than the structural repair categories above it. "Odor" is checklist-only
  // (see the ServiceCategory union in types/service.ts); the underlying
  // catalog tag for this service is still "Cleaning".
  { serviceCategory: "Odor", conditions: [
    { label: "Shoes smell", slug: "deodorizing-treatment" } ] },
];

/** slug -> every distinct checklist condition label that maps to it. Shared
 *  by the checklist's own recommendation screen ("Addresses: …") and by the
 *  Services page/ServiceCard, so a service is described the same way — by
 *  the condition it fixes — everywhere it shows up, not just in the
 *  Starter repair flow. Services with no checklist mapping at all (Cleaning,
 *  Preventative care) simply aren't in this map; callers fall back to the
 *  service's own catalog description in that case. */
export const SLUG_TO_CONDITION_LABELS: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  CHECKLIST_GROUPS.forEach((group) =>
    group.conditions.forEach((c) => {
      const existing = map.get(c.slug);
      if (existing) {
        if (!existing.includes(c.label)) existing.push(c.label);
      } else {
        map.set(c.slug, [c.label]);
      }
    }),
  );
  return map;
})();

/** "Addresses: worn, damaged, or separating sole" — or undefined when this
 *  slug isn't part of the checklist at all. Deliberately no "For a …"
 *  article-based phrasing here: some labels are singular shoe parts ("a
 *  broken heel") and some are plural/uncountable ("surface scuffs or
 *  scratches"), so a single template can't get the grammar right for both.
 *  The colon-prefixed form already reads fine either way and matches the
 *  phrasing already shipped on the recommendation screen. */
export function addressesLine(slug: string): string | undefined {
  const labels = SLUG_TO_CONDITION_LABELS.get(slug);
  if (!labels || labels.length === 0) return undefined;
  return `Addresses: ${labels.join(", ").toLowerCase()}`;
}

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
  "seam-repair": "stitching",
  "zipper-reattachment": "stitching",
  "zipper-slider-replacement": "stitching",
};

export type Addon = { label: string; slug: string; pkgCat: IncludedCategoryKey | null; description: string };

export const ADDONS: Addon[] = [
  { label: "Shoe shine", slug: "shoe-shine", pkgCat: null, description: "Restores gloss" },
  { label: "Waterproofing", slug: "waterproofing", pkgCat: "preventative", description: "Protects from rain and moisture" },
  { label: "Protective soles", slug: "protective-full-sole", pkgCat: "preventative", description: "Guards against wear so your sole lasts longer" },
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
