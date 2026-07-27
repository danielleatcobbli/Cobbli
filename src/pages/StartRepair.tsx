/**
 * StartRepair — "What's going on with your shoes?"
 *
 * The Starter repair entry point: a symptom checklist + optional add-ons,
 * followed by a recommendation screen that either proposes a package (when
 * it's a better fit than buying the underlying services separately — see
 * src/data/starterRepairConditions.ts for the exact rules) or itemizes the
 * individual services needed. Any service the checklist maps to that isn't
 * currently offered (not in the catalog yet, or isComingSoon) is called out
 * separately rather than silently included.
 *
 * Approved as an interactive mockup with Danielle before being wired up here
 * — the checklist categories, add-ons, and package rules below match that
 * mockup exactly, now driven by the live Supabase service catalog instead of
 * hardcoded prices.
 *
 * On confirm, the finalized list is handed to PairFlowDialog.tsx (via
 * RepairFlowContext.openPairFlow) — a popup, not a separate page (Danielle's
 * call, 2026-07-15) — so the customer describes the pair this applies to
 * without leaving this screen. Shoe detail is intentionally asked for after
 * the recommendation, not before.
 *
 * Route: /start-repair
 */

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { X, Camera, ArrowRight } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useServices } from "@/hooks/useServices";
import { useRepairFlow } from "@/context/RepairFlowContext";
import type { BagService } from "@/context/BagContext";
import { formatPrice } from "@/context/BagContext";
import { formatPairLabel, usePairs } from "@/context/PairsContext";
import { CHECKLIST_GROUPS, ADDONS, computeRecommendation } from "@/data/starterRepairConditions";
import { CATEGORY_ICONS, categoryDisplayLabel } from "@/components/cobbli/CategoryFilterBar";
import { trackEvent } from "@/lib/analytics";

type CartLine = {
  id: string;
  name: string;
  price: number;
  kind: "package" | "service";
  slug: string;
  /** Checked condition labels this line addresses — shown as "Addresses: …"
   *  above the name so a recommended service/package always traces back to
   *  the symptom(s) that produced it. Empty for lines that only came from an
   *  add-on (e.g. waterproofing), which isn't tied to a condition. */
  addresses: string[];
};

const LABEL_TO_SLUG = new Map<string, string>();
CHECKLIST_GROUPS.forEach((group) => group.conditions.forEach((c) => LABEL_TO_SLUG.set(c.label, c.slug)));

const StartRepair = () => {
  const navigate = useNavigate();
  const { data: services, isLoading } = useServices();
  const { selectedPairId, openPairFlow } = useRepairFlow();
  const { getPair } = usePairs();
  // Set only when looping back here from "anything else for this pair?" —
  // shows which pair additional selections will be added to, so it's clear
  // this isn't starting a new pair over again.
  const activePair = selectedPairId ? getPair(selectedPairId) : undefined;
  const activePairLabel = activePair ? formatPairLabel(activePair) : null;

  const [step, setStep] = useState<"checklist" | "results">("checklist");
  const [checkedLabels, setCheckedLabels] = useState<Set<string>>(new Set());
  const [checkedAddons, setCheckedAddons] = useState<Set<string>>(new Set());
  const [notOffered, setNotOffered] = useState<{ slug: string; name: string }[]>([]);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);

  // slug -> service, so each condition's checklist thumbnail can reuse the
  // exact photo shown on that service's card/detail page on /services —
  // Danielle's call: the same repair should look like the same repair
  // everywhere, rather than maintaining a second, separate image per
  // condition. Falls back to cond.imageUrl (a manual override, if ever set)
  // then the category icon when neither the service nor the condition has a
  // photo yet.
  const serviceBySlug = useMemo(() => {
    const map = new Map<string, { imageUrl?: string }>();
    (services ?? []).forEach((s) => map.set(s.slug, s));
    return map;
  }, [services]);

  // Two-column split, computed here instead of left to CSS. We tried CSS
  // multi-column (`columns-2` + `break-inside-avoid`) to dodge Grid's
  // row-height-matching dead-space bug, but its native `column-fill: balance`
  // doesn't fill left-to-right in document order — it balances total height
  // across both columns, which put the short trailing "Odor" group in the
  // right column instead of the left where there was actually room
  // (Danielle's report, 2026-07-16: "I think what we wanna do is fill
  // space"). This greedily assigns each group, in order, to whichever column
  // currently has fewer total conditions (a proxy for rendered height), so
  // short groups land wherever there's real room rather than wherever CSS's
  // balancing algorithm happens to put them.
  const [leftGroups, rightGroups] = useMemo(() => {
    const left: typeof CHECKLIST_GROUPS = [];
    const right: typeof CHECKLIST_GROUPS = [];
    let leftCount = 0;
    let rightCount = 0;
    CHECKLIST_GROUPS.forEach((group) => {
      if (leftCount <= rightCount) {
        left.push(group);
        leftCount += group.conditions.length;
      } else {
        right.push(group);
        rightCount += group.conditions.length;
      }
    });
    return [left, right];
  }, []);

  const renderGroup = (group: (typeof CHECKLIST_GROUPS)[number]) => (
    <div key={group.serviceCategory} className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <img
          src={CATEGORY_ICONS[group.serviceCategory]}
          alt=""
          aria-hidden="true"
          className="h-6 w-6"
        />
        <h2 className="text-base font-semibold text-primary">{categoryDisplayLabel(group.serviceCategory)}</h2>
      </div>
      <div className="rounded-xl border border-border p-4">
        <div className="flex flex-col gap-3">
          {group.conditions.map((cond, idx) => {
            const id = `cond-${group.serviceCategory}-${cond.slug}-${idx}`;
            return (
              <label key={id} htmlFor={id} className="flex items-center gap-3 text-sm text-primary/90 cursor-pointer">
                <img
                  src={
                    serviceBySlug.get(cond.slug)?.imageUrl ??
                    cond.imageUrl ??
                    CATEGORY_ICONS[group.serviceCategory]
                  }
                  alt=""
                  aria-hidden="true"
                  className="h-16 w-16 rounded-lg object-cover shrink-0"
                  style={{ backgroundColor: "#f5f0e8" }}
                />
                <Checkbox
                  id={id}
                  checked={checkedLabels.has(cond.label)}
                  onCheckedChange={() => toggleCondition(cond.label)}
                />
                {cond.label}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );

  usePageMeta({
    title: "Starter repair — Cobbli",
    description:
      "Tell us what's going on with your shoes and we'll recommend the right services or repair package.",
  });

  const toggleCondition = (label: string) => {
    setCheckedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleAddon = (slug: string) => {
    setCheckedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const anyChecked = checkedLabels.size > 0 || checkedAddons.size > 0;

  const seeRecommendations = () => {
    if (!services || !anyChecked) return;
    const requiredSlugs = new Set<string>();
    // slug -> every checked condition label that maps to it, so each
    // resulting service/package line can show which symptom(s) it addresses.
    const slugToLabels = new Map<string, string[]>();
    checkedLabels.forEach((label) => {
      const slug = LABEL_TO_SLUG.get(label);
      if (slug) {
        requiredSlugs.add(slug);
        const existing = slugToLabels.get(slug);
        if (existing) existing.push(label);
        else slugToLabels.set(slug, [label]);
      }
    });
    checkedAddons.forEach((slug) => requiredSlugs.add(slug));

    const result = computeRecommendation(checkedLabels, requiredSlugs, services);
    trackEvent("starter_repair_recommendation", {
      condition_count: checkedLabels.size,
      addon_count: checkedAddons.size,
      package: result.package?.bundleSlug ?? null,
      not_offered_count: result.notOffered.length,
    });

    const addressesFor = (slugs: string[]): string[] => {
      const seen = new Set<string>();
      slugs.forEach((slug) => (slugToLabels.get(slug) ?? []).forEach((label) => seen.add(label)));
      return Array.from(seen);
    };

    const lines: CartLine[] = [];
    if (result.package) {
      lines.push({
        id: `bundle-${result.package.bundleSlug}`,
        name: result.package.name,
        price: Math.round(parseFloat(result.package.price.replace(/[^0-9.]/g, "")) * 100),
        kind: "package",
        slug: result.package.bundleSlug,
        addresses: addressesFor(result.package.covers),
      });
    }
    result.individual.forEach((s) => {
      lines.push({ id: s.slug, name: s.name, price: s.price, kind: "service", slug: s.slug, addresses: addressesFor([s.slug]) });
    });

    setNotOffered(result.notOffered);
    setCartLines(lines);
    setStep("results");
  };

  const removeLine = (id: string) => setCartLines((prev) => prev.filter((l) => l.id !== id));

  const total = useMemo(() => cartLines.reduce((sum, l) => sum + l.price, 0), [cartLines]);

  const onContinue = () => {
    if (cartLines.length === 0) return;
    const items: BagService[] = cartLines.map((l) => ({ id: l.id, name: l.name, price: l.price }));
    trackEvent("service_added", { source: "starter_repair", item_count: items.length });
    openPairFlow(items);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white flex flex-col">
        <Header />
        <section className="flex-1 flex items-center justify-center py-20">
          <BrandSpinner size="lg" />
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <section className="flex-1 py-12 md:py-16">
        <div className={`container ${step === "checklist" ? "max-w-4xl" : "max-w-2xl"}`}>
          {step === "checklist" ? (
            <>
              {activePairLabel && (
                <p className="mb-2 text-sm font-medium" style={{ color: "#7a5c40" }}>
                  Adding more services for: {activePairLabel}
                </p>
              )}
              <h1 className="font-display text-3xl md:text-4xl text-primary">What's going on with your shoes?</h1>
              <p className="mt-2 text-primary/80">
                Select everything that applies — we'll recommend the right services.
              </p>

              {/* Photo-flow callout — promoted to a prominent spot at the top
                  of the page (not a footnote) per Danielle's request: she's
                  actively doing friends-and-family repairs and wants to keep
                  steering people toward the photo option early on to see
                  where they go, alongside the checklist below. Approved via
                  mockup before building. */}
              <div
                className="mt-6 flex items-start gap-3.5 rounded-[10px] border p-4"
                style={{ backgroundColor: "#fff5cc", borderColor: "#fdb600" }}
              >
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#fdb600" }}
                >
                  <Camera size={18} style={{ color: "#3d1700" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium" style={{ color: "#3d1700" }}>
                    Want us to take a look instead?
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "#3d1700" }}>
                    Send photos/videos of your shoes and we'll personally review them and recommend the right repair.
                  </p>
                  <Link
                    to="/start-repair/assessment"
                    onClick={() => trackEvent("start_repair", { source: "starter_repair_photo_callout" })}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium"
                    style={{ backgroundColor: "#3d1700", color: "#fff5cc" }}
                  >
                    Send us photos or videos
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>

              {/* Two columns on desktop so the wider container above is
                  actually put to use and there's less scrolling — single
                  column on mobile, unchanged. Each column is an explicit,
                  JS-computed list (see leftGroups/rightGroups above) rather
                  than CSS multi-column, so short groups fill real empty
                  space instead of wherever the browser's column-balancing
                  algorithm happens to put them. Columns still won't align
                  card-for-card between each other (Danielle's earlier call
                  — worth it to kill dead space). */}
              <div className="mt-8 flex flex-col md:flex-row gap-8">
                <div className="flex-1 min-w-0">{leftGroups.map(renderGroup)}</div>
                <div className="flex-1 min-w-0">{rightGroups.map(renderGroup)}</div>
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-sm font-semibold text-primary mb-3">Add-ons (optional)</p>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                  {ADDONS.map((addon) => {
                    const id = `addon-${addon.slug}`;
                    return (
                      <label key={addon.slug} htmlFor={id} className="flex items-start gap-2 text-sm text-primary/90 cursor-pointer">
                        <Checkbox
                          id={id}
                          checked={checkedAddons.has(addon.slug)}
                          onCheckedChange={() => toggleAddon(addon.slug)}
                          className="mt-0.5"
                        />
                        <span>
                          {addon.label}
                          <span className="block text-[12px] text-muted-foreground">{addon.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* No "skip / browse all services" escape hatch here on purpose
                  (Danielle's call, 2026-07-16) — the checklist is meant to be
                  the primary path, not something to route people around, and
                  anyone who wants the full catalog can already reach /services
                  directly (nav, a service link, etc.) without this page
                  pointing them there. */}
              <div className="mt-6 flex items-center justify-end gap-4">
                <Button
                  type="button"
                  size="lg"
                  onClick={seeRecommendations}
                  disabled={!anyChecked}
                  className={!anyChecked ? "opacity-50 cursor-not-allowed" : ""}
                >
                  See my recommendations
                </Button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("checklist")}
                className="text-sm text-muted-foreground hover:text-primary mb-6"
              >
                ← Back to checklist
              </button>
              <h1 className="font-display text-3xl md:text-4xl text-primary">Here's what we recommend</h1>
              <p className="mt-2 text-primary/80">You can remove anything below before continuing.</p>

              {notOffered.length > 0 && (
                <div className="mt-6 flex flex-col gap-3">
                  {notOffered.map((s) => (
                    <div key={s.slug} className="rounded-lg border p-3 text-sm" style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" }}>
                      <strong>{s.name} isn't offered yet.</strong> We don't currently support this repair at launch — we'll follow up by email as soon as we do.
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {cartLines.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6">
                    Nothing left to add — go back to the checklist to select something, or browse all services.
                  </p>
                ) : (
                  cartLines.map((line) => (
                    <div key={line.id} className="rounded-lg border border-border p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        {line.addresses.length > 0 && (
                          <p className="text-xs text-muted-foreground mb-1">
                            Addresses: {line.addresses.join(", ").toLowerCase()}
                          </p>
                        )}
                        <p className="font-medium text-primary">
                          {line.name}
                          {line.kind === "package" && <span className="ml-2 text-xs font-medium text-muted-foreground">(package)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-medium text-primary">{formatPrice(line.price)}</span>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          aria-label={`Remove ${line.name}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated total</span>
                <span className="text-xl font-semibold text-primary">{formatPrice(total)}</span>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Button
                  type="button"
                  size="lg"
                  onClick={onContinue}
                  disabled={cartLines.length === 0}
                  className={cartLines.length === 0 ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Continue
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => navigate("/services")}>
                  Browse full services list
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default StartRepair;
