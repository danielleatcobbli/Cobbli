/**
 * Individual-service display order + "Popular" tagging — shared between the
 * homepage services section (components/cobbli/Services.tsx) and the full
 * Services page (pages/Services.tsx). Previously duplicated verbatim in both
 * files; extracted so a change to which services are popular or how they're
 * ordered only has to happen once, per Danielle's request that a single
 * update be reflected everywhere the data is shown.
 *
 * The underlying service records themselves already come from one place
 * (Supabase, via useServices()) on both pages — this file only covers the
 * display-order/popularity layer on top of that shared data.
 *
 * Both POPULAR_SERVICE_SLUGS and ORDERED_SERVICE_SLUGS are now derived
 * entirely from starterRepairConditions.ts (2026-07-23, Danielle's call: "if
 * the condition doesn't have a common tag, the service shouldn't have a
 * popular tag" — and display order should be "stored in the same way we have
 * it sorted on the conditions page"). Neither is hand-maintained here
 * anymore, so the checklist and the Services page/homepage can't drift out
 * of sync with each other the way they previously could.
 */

import { type Service } from "@/types/service";
import { COMMON_SERVICE_SLUGS, CHECKLIST_ORDERED_SLUGS } from "@/data/starterRepairConditions";

export const POPULAR_SERVICE_SLUGS = new Set(COMMON_SERVICE_SLUGS);

// Services with no checklist condition behind them at all (Add-ons) —
// appended after everything the checklist covers, in the same relative order
// they've always shown in. Never "Popular" (see above), since nothing
// "common" maps to them. Lace replacement added 2026-07-27.
const NON_CHECKLIST_SERVICE_SLUGS: string[] = ["shoe-shine", "protective-full-sole", "waterproofing", "lace-replacement"];

export const ORDERED_SERVICE_SLUGS: string[] = [...CHECKLIST_ORDERED_SLUGS, ...NON_CHECKLIST_SERVICE_SLUGS];

export const slugOrder = (slug: string): number => {
  const idx = ORDERED_SERVICE_SLUGS.indexOf(slug);
  return idx === -1 ? ORDERED_SERVICE_SLUGS.length : idx;
};

export const sortServices = (list: Service[]): Service[] =>
  [...list].sort((a, b) => slugOrder(a.slug) - slugOrder(b.slug) || a.rank - b.rank);
