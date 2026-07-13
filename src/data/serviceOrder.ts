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
 */

import { type Service } from "@/types/service";

export const POPULAR_SERVICE_SLUGS = new Set([
  "full-resole",
  "color-restoration",
  "leather-or-suede-conditioning",
  "insole-replacement",
  "lining-repair",
  "shoe-shine",
]);

export const ORDERED_SERVICE_SLUGS: string[] = [
  // Popular
  "full-resole",
  "color-restoration",
  "leather-or-suede-conditioning",
  "insole-replacement",
  "lining-repair",
  "shoe-shine",
  // Non-popular
  "protective-full-sole",
  "waterproofing",
  "high-heel-tip-replacement",
  "heel-reattachment",
  "seam-repair",
  "strap-repair",
  "hardware-repair",
  "zipper-replacement",
  "zipper-slider-replacement",
  "deodorizing-treatment",
];

export const slugOrder = (slug: string): number => {
  const idx = ORDERED_SERVICE_SLUGS.indexOf(slug);
  return idx === -1 ? ORDERED_SERVICE_SLUGS.length : idx;
};

export const sortServices = (list: Service[]): Service[] =>
  [...list].sort((a, b) => slugOrder(a.slug) - slugOrder(b.slug) || a.rank - b.rank);
