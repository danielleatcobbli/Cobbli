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
 * Fully restructured 2026-07-22 per Danielle's categorization pass —
 * supersedes the previous Sole & heel / Color, scuffs, & shine / Inside of
 * shoe / Tears & holes / Zipper / Straps, buckles, & hardware / Odor
 * grouping. New groups (Scuffs & holes, Color & stains, Material & shape,
 * Insole & interior, Stitching & seams, Cleaning & odor) are checklist-only
 * display categories — see the ServiceCategory union in types/service.ts —
 * same pattern as the old "Odor" category: they don't need to match a real
 * catalog category tag, since a service can be filed under whichever
 * checklist group(s) make sense to a customer regardless of how it's tagged
 * for the Services page filter bar.
 *
 * Dropped in earlier passes, confirmed intentional by Danielle: "Loose
 * insole" (replaced by "Loose or detached insole"), "Broken or missing
 * strap/hardware/buckle" (these come back post-launch as their own
 * conditions once the replacement services below are live), and "Broken
 * heel" (-> heel-replacement, not currently offered).
 *
 * Bug fixed 2026-07-22: "Broken or detached zipper" previously pointed to a
 * slug ("zipper-reattachment") that doesn't exist anywhere in the real
 * catalog — the live service is actually "zipper-replacement" ("Zipper
 * replacement"). Fixed by pointing at the correct slug.
 *
 * Fully re-mapped again 2026-07-27, per Danielle and Alex's joint review of
 * the whole checklist -> service mapping:
 * - Strap repair, Hardware repair, Buckle repair, and Seam repair (each
 *   $50/pair) are consolidated into one new "Stitching" service
 *   (stitching), same price. "Loose or detached strap/hardware/buckle" and
 *   "Loose seam" all point here now. Zipper repair stays its own separate
 *   service — not folded in.
 * - "Stains" and the new "Water stains" condition both point at
 *   color-restoration now, not the separate Stain repair service (which is
 *   deactivated).
 * - "Damage on heel tab" (Scuffs & holes) now points at a new "Patch
 *   repair" service instead of Lining repair. "Damage on inner lining"
 *   (renamed from the old shared "Damage on heel tab" label under Insole &
 *   interior) still points at Lining repair. "Hole on outside of shoe" is
 *   new, also -> Patch repair. Danielle's own conditional business rule for
 *   Patch repair (only bookable alongside a resole, toe-area only in that
 *   case) isn't encoded here yet — she's adding that logic separately.
 * - "Sole separating from shoe" now points at the new Gluing service
 *   (sole is fine, just unglued) instead of full-resole.
 * - "Sole worn at the heel" now points at a new "Partial resole" service
 *   (placeholder $60 pricing, real logic — likely brand-specific — still
 *   being worked out) instead of the old placeholder slug
 *   "sole-on-heel-repair". New condition "Sole worn on front"
 *   also -> Partial resole.
 * - Heel replacement, Shoe dyeing, and Shoe stretching are deactivated —
 *   not part of the current checklist mapping at all.
 *
 * Follow-up pass, same day (2026-07-27), per Danielle's photo review:
 * - "Damage on heel tab" removed from the checklist entirely — not
 *   supporting it initially, coming back later. Its old photo turned out to
 *   actually depict inner lining damage, not a heel tab, so it was moved to
 *   "Damage on inner lining" instead of being replaced.
 * - "Broken zipper" and "Zipper separating from shoe" removed from the
 *   checklist for the same reason — zipper-replacement itself is now
 *   is_coming_soon in Supabase. "Broken or detached zipper slider" is
 *   unaffected (separate service, stays supported).
 * "Shoes losing shape" removed entirely 2026-07-27 (Danielle's call) — it
 * was a placeholder with no real catalog service behind it (shape-restoration
 * was never a real, bookable repair), and she considers it a byproduct of
 * other issues rather than its own condition worth offering. With it gone,
 * "Material & shape" only ever had one condition anyway ("Material is dull
 * or dry"), so the category itself was renamed to "Material & finish" to
 * match — see CATEGORIES_ORDERED in types/service.ts.
 */

import { minPrice, type Service, type ServiceCategory } from "@/types/service";
import { BUNDLES, bundleBySlug, type IncludedCategoryKey } from "@/data/bundles";
import iconOdor from "@/assets/category-icons/odor.svg";

export type Condition = {
  label: string;
  slug: string;
  /** "Before" photo/illustration for this specific condition, shown next to
   *  the checkbox on the "What's going on with your shoes?" checklist. Falls
   *  back to the category icon (CATEGORY_ICONS in CategoryFilterBar.tsx) when
   *  not set — no real per-condition photography exists yet, so every
   *  condition renders with its category's icon until real images are added
   *  here one at a time. */
  imageUrl?: string;
  /** "After" photo — swaps in on hover (see BeforeAfterImage). Optional and
   *  usually unset for now (2026-07-22): no real after photos exist yet, so
   *  hover is a no-op until one is added here. */
  afterImageUrl?: string;
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
 * Heel groups too, until those merged into one "Sole & heel" group on
 * 2026-07-16 — merging removed the need for that particular duplicate.)
 */
export type ChecklistGroup = { serviceCategory: ServiceCategory; conditions: Condition[] };

// Group contents (2026-07-22, Danielle's call — full recategorization, most
// recently re-mapped 2026-07-27). A condition can legitimately appear in more
// than one group on purpose — e.g. the three "Loose or detached ___"
// conditions plus "Zipper separating from shoe" show under both Stitching &
// seams and their own part-specific group — Danielle confirmed the
// duplication is intentional. Checking a condition in one group also checks
// it in the other, since both checkboxes are keyed off the same label in
// shared state.
//
// Group ORDER is alphabetical by category name (2026-07-23, Danielle's
// call — she wants categories predictable/scannable on both this checklist
// and the Services page rather than frequency-ordered). This doesn't cost
// the earlier "surface what's common first" goal: COMMON_CONDITION_LABELS
// below still floats the actually-frequent conditions to the front of
// whatever's visible, independent of category order — this array only
// controls the category pills' own order and the fallback sort for
// non-common items (see CHECKLIST_ORDERED_SLUGS below).
export const CHECKLIST_GROUPS: ChecklistGroup[] = [
  { serviceCategory: "Cleaning & odor", conditions: [
    { label: "Shoes are dirty", slug: "deep-clean", imageUrl: "/condition-photos/shoes-are-dirty.jpg" },
    // "Shoes smell" keeps Danielle's custom stink-lines icon (commissioned
    // 2026-07-16) as its own condition photo rather than the shared category
    // icon, now that the category icon itself has to represent both dirt and
    // odor.
    { label: "Shoes smell", slug: "deodorizing-treatment", imageUrl: iconOdor } ] },
  { serviceCategory: "Color & stains", conditions: [
    { label: "Faded or streaky color", slug: "color-restoration", imageUrl: "/condition-photos/faded-or-streaky-color.png" },
    { label: "Stains", slug: "color-restoration", imageUrl: "/condition-photos/stains.jpg", afterImageUrl: "/condition-photos/stains-after.jpg" },
    // "Water stains" removed 2026-07-31 (MVP scope-down, Danielle's call).
    // Different from the other removals in this pass: color-restoration
    // itself is NOT marked is_coming_soon, since Faded or streaky color,
    // Stains, and Scratches all still route to it live — only this specific
    // condition entry point is being pulled, not the underlying service.
  ] },
  { serviceCategory: "Insole & interior", conditions: [
    { label: "Worn or damaged insole", slug: "insole-replacement", imageUrl: "/condition-photos/worn-or-damaged-insole.jpg" },
    // "Damage on inner lining" removed 2026-07-31 (MVP scope-down, Danielle's
    // call) — lining-repair is now is_coming_soon. Note this makes the
    // "interior-repair" PACKAGE_RULES custom rule below unreachable (it
    // required this label); harmless since PACKAGES_ENABLED is already
    // false, but flagging for whenever that gets revisited.
    // "Loose or detached insole" removed 2026-08-12 (Danielle's call) — it
    // routed to Gluing, which isn't being offered at launch. Note "Sole
    // separating from shoe" (under Sole & heel, below) also routes to
    // Gluing and is still on the checklist — flagged separately.
  ] },
  // Distinct from Color & stains on purpose — this is about the material's
  // physical condition (drying out, losing its finish), not its color, and
  // maps to the real leather-or-suede-conditioning service (a more involved
  // treatment than the color-restoration/shoe-shine services above), per
  // Danielle's explanation of the distinction. Renamed from "Material &
  // shape" to "Material & finish" 2026-07-27 after "Shoes losing shape" (the
  // category's only other condition) was removed — see the file header.
  { serviceCategory: "Material & finish", conditions: [
    { label: "Material is dull or dry", slug: "leather-or-suede-conditioning", imageUrl: "/condition-photos/material-is-dull-or-dry.jpg" } ] },
  // Renamed from "Scuffs & holes" 2026-07-31 (Danielle's call, MVP
  // scope-down) — "Hole on outside of shoe" (patch-repair) is removed below
  // now that patch-repair is is_coming_soon, leaving only Scuffs and
  // Scratches, so "holes" no longer fits. See ServiceCategory in
  // types/service.ts for the full rename (applies to the Services page too).
  { serviceCategory: "Scuffs & scratches", conditions: [
    // Scuffs and Scratches stay separate, selectable conditions on the
    // checklist (2026-08-12, Danielle's follow-up call) — she still wants to
    // know which one a customer has, that's just no longer what determines
    // the service. Both now route to the same "Scuff and scratch repair"
    // service (still slug scuff-repair) instead of Scratches going to Color
    // correction, since in practice customers often have both and a deep
    // scratch can need some of the same filling work a scuff does.
    { label: "Scuffs", slug: "scuff-repair", imageUrl: "/condition-photos/scuffs-or-scratches.jpg" },
    { label: "Scratches", slug: "scuff-repair", imageUrl: "/condition-photos/scratches.jpg" } ] },
  { serviceCategory: "Sole & heel", conditions: [
    // Swapped to Danielle's brown-booties before/after photos, 2026-08-12.
    { label: "Worn or damaged sole", slug: "full-resole", imageUrl: "/condition-photos/worn-or-damaged-sole-before.jpg", afterImageUrl: "/condition-photos/worn-or-damaged-sole-after.jpg" },
    { label: "Sole separating from shoe", slug: "gluing", imageUrl: "/condition-photos/sole-separating-from-shoe.jpg" },
    // "Sole worn at the heel" and "Sole worn on front" removed 2026-08-12
    // (Danielle's call) -- both folded into "Worn or damaged sole" once the
    // brand + sole-type picker (SoleSelectionDialog) shipped, which asks
    // about sole type/construction directly rather than needing separate
    // checklist conditions for where on the sole it's worn. These two had
    // been pointing at "Partial resole" (see the 2026-07-27 note above) from
    // before that flow existed and were never cleaned up when it landed.
    // "Loose or detached heel" removed 2026-07-31 (MVP scope-down, Danielle's
    // call) — heel-reattachment is now is_coming_soon, and it was only ever
    // reached from this one condition.
    // Danielle renamed the source file to the before/after convention
    // 2026-08-12 (worn-or-missing-heel-tip.jpg -> -before.jpg, plus a new
    // -after.jpg) — updated to match, same pattern as "Stains" above.
    { label: "Worn or missing heel tip", slug: "high-heel-tip-replacement", imageUrl: "/condition-photos/worn-or-missing-heel-tip-before.jpg", afterImageUrl: "/condition-photos/worn-or-missing-heel-tip-after.jpg" } ] },
  // "Stitching & seams" and "Straps, buckles, & hardware" groups removed
  // entirely 2026-07-31 (MVP scope-down, Danielle's call) — every condition
  // in both routed to "stitching", which is now is_coming_soon. Both
  // categories still exist in ServiceCategory (types/service.ts) and stay
  // browsable/votable on the Services page; they're just no longer reachable
  // from this checklist since nothing under them is bookable right now.
  //
  // "Zipper" group removed too, same reasoning — "Broken zipper" and
  // "Zipper separating from shoe" were already removed 2026-07-27 when
  // zipper-replacement went coming-soon; "Broken or detached zipper slider"
  // (zipper-slider-replacement) was the last live condition here and is now
  // coming-soon as well, so the whole category is gone from the checklist.
];

/** Conditions Danielle has seen come up most often in real repairs to date,
 *  in that order (2026-07-23, from her own review of completed orders — not
 *  a guess). Surfaced first on the checklist (see StartRepair.tsx) with a
 *  "Common" tag, ahead of everything else, whether the customer is viewing
 *  "All" or has filtered down to a single category. Called "Common" rather
 *  than "Popular" per her explicit note: a problem isn't something customers
 *  like, it's just something that comes up a lot. */
export const COMMON_CONDITION_LABELS: string[] = [
  "Worn or damaged sole",
  "Scuffs",
  "Worn or damaged insole",
  "Shoes are dirty",
  "Worn or missing heel tip",
];

const FIRST_SLUG_FOR_LABEL: Map<string, string> = (() => {
  const map = new Map<string, string>();
  CHECKLIST_GROUPS.forEach((group) =>
    group.conditions.forEach((c) => {
      if (!map.has(c.label)) map.set(c.label, c.slug);
    }),
  );
  return map;
})();

/** The real catalog slugs behind COMMON_CONDITION_LABELS, in the same order,
 *  deduped, and skipping any label whose slug isn't a real catalog service
 *  yet (a placeholder like "gluing" or "deep-clean" — see the file header).
 *  This is the single source of truth for which services get a "Popular" tag
 *  on the Services page/homepage (2026-07-23, Danielle's call): a service is
 *  only ever Popular because the condition it fixes is Common — never the
 *  other way around, and never hand-maintained as a separate list that could
 *  drift out of sync with COMMON_CONDITION_LABELS. See serviceOrder.ts. */
export const COMMON_SERVICE_SLUGS: string[] = (() => {
  const seen = new Set<string>();
  const slugs: string[] = [];
  COMMON_CONDITION_LABELS.forEach((label) => {
    const slug = FIRST_SLUG_FOR_LABEL.get(label);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      slugs.push(slug);
    }
  });
  return slugs;
})();

/** Every real-catalog slug reachable from the checklist, ordered Common-first
 *  (COMMON_SERVICE_SLUGS, her real-order data) then by CHECKLIST_GROUPS order
 *  for everything else — i.e. the exact same order a customer sees on the
 *  Start a Repair "All" grid. Services page/homepage display order is built
 *  from this (see serviceOrder.ts) so the two surfaces can't drift apart —
 *  Danielle's call (2026-07-23): "everything stored in the same way we have
 *  it sorted on the conditions page, since there's essentially a mapping
 *  between conditions and services." */
export const CHECKLIST_ORDERED_SLUGS: string[] = (() => {
  const seen = new Set<string>();
  const slugs: string[] = [];
  COMMON_SERVICE_SLUGS.forEach((slug) => {
    seen.add(slug);
    slugs.push(slug);
  });
  CHECKLIST_GROUPS.forEach((group) =>
    group.conditions.forEach((c) => {
      if (!seen.has(c.slug)) {
        seen.add(c.slug);
        slugs.push(c.slug);
      }
    }),
  );
  return slugs;
})();

/** slug -> every distinct checklist condition label that maps to it. Shared
 *  by the checklist's own recommendation screen ("Fixes: …") and by the
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

/** slug -> the checklist photo for the first condition (in CHECKLIST_GROUPS
 *  order) that maps to it and actually has an imageUrl. Lets the Services
 *  page/ServiceCard and ServiceDetail show the exact same "before" photo as
 *  the matching condition tile on the Starter repair checklist — Danielle's
 *  call (2026-07-23): "resole and Worn or damaged sole should use the same
 *  photo," same logic as addressesLine() above but for the image instead of
 *  the description. When a slug maps to more than one condition with a photo
 *  (e.g. hardware-repair covers both "Loose or detached hardware" and "Loose
 *  or detached buckle"), the first one in CHECKLIST_GROUPS order wins — same
 *  tie-break that makes full-resole resolve to "Worn or damaged sole" rather
 *  than "Sole separating from shoe," matching her example exactly. Only used
 *  as a fallback when the service's own catalog image_url is empty (real
 *  photography, if ever added in Supabase, always takes priority). */
export const SLUG_TO_CONDITION_IMAGE: Map<string, { imageUrl?: string; afterImageUrl?: string }> = (() => {
  const map = new Map<string, { imageUrl?: string; afterImageUrl?: string }>();
  CHECKLIST_GROUPS.forEach((group) =>
    group.conditions.forEach((c) => {
      if (!c.imageUrl) return;
      if (map.has(c.slug)) return;
      map.set(c.slug, { imageUrl: c.imageUrl, afterImageUrl: c.afterImageUrl });
    }),
  );
  return map;
})();

/** "Fixes: worn, damaged, or separating sole" — or undefined when this slug
 *  isn't part of the checklist at all. Renamed from "Addresses:" 2026-07-27
 *  (Danielle's call — reads more like plain speech). Deliberately no "For a
 *  …" article-based phrasing here: some labels are singular shoe parts ("a
 *  broken heel") and some are plural/uncountable ("surface scuffs or
 *  scratches"), so a single template can't get the grammar right for both.
 *  The colon-prefixed form already reads fine either way and matches the
 *  phrasing already shipped on the recommendation screen. */
export function addressesLine(slug: string): string | undefined {
  const labels = SLUG_TO_CONDITION_LABELS.get(slug);
  if (!labels || labels.length === 0) return undefined;
  return `Fixes: ${labels.join(", ").toLowerCase()}`;
}

/** Canonical slug -> package category mapping, used only for the
 *  package-vs-individual-services recommendation logic below. Kept separate
 *  from CHECKLIST_GROUPS (display) on purpose: a condition's package
 *  category is a fixed catalog fact, independent of which group(s) it's
 *  visually shown under — e.g. heel tip is "sole" for pricing/package
 *  purposes even though it's displayed in both the Sole and Heel groups. */
const CONDITION_PKG_CAT: Record<string, IncludedCategoryKey> = {
  "full-resole": "sole",
  "partial-resole": "sole",
  "high-heel-tip-replacement": "sole",
  "heel-reattachment": "stitching",
  "insole-replacement": "interior",
  "gluing": "interior",
  "lining-repair": "interior",
  "patch-repair": "surface",
  "color-restoration": "surface",
  "scuff-repair": "surface",
  "leather-or-suede-conditioning": "surface",
  "stitching": "stitching",
  "zipper-replacement": "stitching",
  "zipper-slider-replacement": "stitching",
};

export type Addon = { label: string; slug: string; pkgCat: IncludedCategoryKey | null; description: string };

export const ADDONS: Addon[] = [
  // Lace replacement removed 2026-07-31 (Danielle's call) — pulled entirely
  // for now (no lace source lined up yet) and marked is_coming_soon in
  // Supabase rather than staying listed here. It never really fit this
  // section anyway ("laces are worn or dirty" reads as something being
  // wrong, not preventative care) — see the section heading note below.
  { label: "Shoe shine", slug: "shoe-shine", pkgCat: null, description: "Restores shine and conditions the leather to help prevent drying and cracking" },
  { label: "Waterproofing", slug: "waterproofing", pkgCat: "preventative", description: "Protects shoes from rain and moisture" },
  { label: "Protective soles", slug: "protective-full-sole", pkgCat: "preventative", description: "Guards against wear so your soles last longer" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Package selection rules — evaluated in this order; first match wins.
// Sole repair and Just a Shine are never auto-selected (Danielle's call —
// they're priced the same as their one underlying service, so there's no
// benefit to routing through the package).
//
// PACKAGES_ENABLED (2026-07-23): flipped off — see the note at its use site
// in computeRecommendation below for why. Left as a single flag rather than
// ripping the logic out so re-enabling (or building the "bundle and save"
// discount idea on top of it later) doesn't mean reconstructing this from
// scratch.
// ─────────────────────────────────────────────────────────────────────────────

const PACKAGES_ENABLED = false;

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
      checked.has("Material is dull or dry") &&
      (checked.has("Faded or streaky color") || checked.has("Scuffs") || checked.has("Scratches")),
  },
  {
    bundleSlug: "interior-repair",
    cats: ["interior"],
    custom: (checked) => checked.has("Worn or damaged insole") && checked.has("Damage on inner lining"),
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

export type RecommendationResult = {
  /** Services the customer effectively asked for that exist in the catalog
   *  but are isComingSoon. Deliberately does NOT include conditions whose
   *  slug has no catalog entry at all — see the file header note and the
   *  `if (!svc) continue` below (Danielle's call, 2026-07-22). */
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
    if (!svc) {
      // No real catalog service exists for this slug yet — a placeholder
      // from the checklist (e.g. gluing, deep-clean). Danielle's call
      // (2026-07-22): don't call these out as "not offered" like a real
      // coming-soon catalog gap; just quietly drop them from the
      // recommendation until she maps them to a real service.
      continue;
    }
    if (svc.isComingSoon) {
      notOffered.push({ slug, name: svc.name });
    } else {
      offered.push(slug);
    }
  }

  const offeredSet = new Set(offered);
  let chosen: RecommendedPackage | null = null;
  let coveredSlugs: string[] = [];

  // Packages disabled in the Starter repair recommendation (2026-07-23,
  // Danielle's call): she wants to hold off on packages altogether while she
  // makes sure the rest of the site is right first, and is separately
  // weighing whether packages should even come back as flat-priced SKUs at
  // all versus an automatic "bundle and save" discount applied on top of
  // individual pricing (undecided, revisit later). Every selection now
  // always surfaces as individual services — PACKAGE_RULES, the matching
  // loop below, and bundles.ts are all left fully intact, not deleted, so
  // this is a one-line revert (just remove this guard) if packages come
  // back in their current form.
  if (PACKAGES_ENABLED) for (const rule of PACKAGE_RULES) {
    const bundle = bundleBySlug(rule.bundleSlug);
    if (!bundle) continue;

    // Every category actually represented among the offered items must be
    // one this package covers — not just "some overlap" — before it can
    // qualify (2026-07-23 fix, Danielle's call). Previously this only
    // filtered offered down to the items whose category matched rule.cats
    // and checked whether THEIR sum exceeded the package price, ignoring
    // whatever else was offered. Since Full restoration's cats list spans
    // all five categories, that made it match ANY selection whose total
    // price crossed $250 regardless of which categories were actually
    // involved — e.g. someone who only ever selected stitching + interior
    // issues (never touched sole or surface) could still get recommended a
    // $250 "Full restoration" that nominally bundles in sole/surface work
    // they never asked for, and — because it's evaluated first — that could
    // preempt a cheaper, better-fitting package like Standard repair or
    // Exterior repair. Requiring full category coverage means a package is
    // only ever recommended when it's a genuine match for what the customer
    // actually selected.
    const offeredCategories = new Set(
      offered
        .map((slug) => slugToPkgCat.get(slug))
        .filter((cat): cat is IncludedCategoryKey => !!cat),
    );
    if (offeredCategories.size === 0) continue;
    const allCategoriesCovered = Array.from(offeredCategories).every((cat) => rule.cats.includes(cat));
    if (!allCategoriesCovered) continue;

    const inScope = offered;
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
