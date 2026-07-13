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
 * On confirm, the finalized list is handed to StartRepairPick.tsx (via
 * RepairFlowContext's pendingRecommendedItems) so the customer picks/creates
 * the actual shoe pair this applies to there — shoe detail is intentionally
 * asked for after the recommendation, not before (Danielle's call).
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
import { CHECKLIST_GROUPS, ADDONS, computeRecommendation } from "@/data/starterRepairConditions";
import { CATEGORY_ICONS } from "@/components/cobbli/CategoryFilterBar";
import { trackEvent } from "@/lib/analytics";

type CartLine = { id: string; name: string; price: number; kind: "package" | "service"; slug: string };

const LABEL_TO_SLUG = new Map<string, string>();
CHECKLIST_GROUPS.forEach((group) => group.conditions.forEach((c) => LABEL_TO_SLUG.set(c.label, c.slug)));

const StartRepair = () => {
  const navigate = useNavigate();
  const { data: services, isLoading } = useServices();
  const { setPendingRecommendedItems } = useRepairFlow();

  const [step, setStep] = useState<"checklist" | "results">("checklist");
  const [checkedLabels, setCheckedLabels] = useState<Set<string>>(new Set());
  const [checkedAddons, setCheckedAddons] = useState<Set<string>>(new Set());
  const [notOffered, setNotOffered] = useState<{ slug: string; name: string }[]>([]);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);

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
    checkedLabels.forEach((label) => {
      const slug = LABEL_TO_SLUG.get(label);
      if (slug) requiredSlugs.add(slug);
    });
    checkedAddons.forEach((slug) => requiredSlugs.add(slug));

    const result = computeRecommendation(checkedLabels, requiredSlugs, services);
    trackEvent("starter_repair_recommendation", {
      condition_count: checkedLabels.size,
      addon_count: checkedAddons.size,
      package: result.package?.bundleSlug ?? null,
      not_offered_count: result.notOffered.length,
    });

    const lines: CartLine[] = [];
    if (result.package) {
      lines.push({
        id: `bundle-${result.package.bundleSlug}`,
        name: result.package.name,
        price: Math.round(parseFloat(result.package.price.replace(/[^0-9.]/g, "")) * 100),
        kind: "package",
        slug: result.package.bundleSlug,
      });
    }
    result.individual.forEach((s) => {
      lines.push({ id: s.slug, name: s.name, price: s.price, kind: "service", slug: s.slug });
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
    setPendingRecommendedItems(items);
    navigate("/start-repair/pick");
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
                  column on mobile, unchanged. */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {CHECKLIST_GROUPS.map((group) => (
                  <div key={group.serviceCategory}>
                    <div className="flex items-center gap-2 mb-3">
                      <img
                        src={CATEGORY_ICONS[group.serviceCategory]}
                        alt=""
                        aria-hidden="true"
                        className="h-6 w-6"
                      />
                      <h2 className="text-base font-semibold text-primary">{group.serviceCategory}</h2>
                    </div>
                    <div className="rounded-xl border border-border p-4">
                      <div className="flex flex-col gap-2">
                        {group.conditions.map((cond, idx) => {
                          const id = `cond-${group.serviceCategory}-${cond.slug}-${idx}`;
                          return (
                            <label key={id} htmlFor={id} className="flex items-start gap-2 text-sm text-primary/90 cursor-pointer">
                              <Checkbox
                                id={id}
                                checked={checkedLabels.has(cond.label)}
                                onCheckedChange={() => toggleCondition(cond.label)}
                                className="mt-0.5"
                              />
                              {cond.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                <p className="text-sm font-semibold text-primary mb-3">Add-ons (optional)</p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {ADDONS.map((addon) => {
                    const id = `addon-${addon.slug}`;
                    return (
                      <label key={addon.slug} htmlFor={id} className="flex items-center gap-2 text-sm text-primary/90 cursor-pointer">
                        <Checkbox
                          id={id}
                          checked={checkedAddons.has(addon.slug)}
                          onCheckedChange={() => toggleAddon(addon.slug)}
                        />
                        {addon.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => { trackEvent("start_repair", { source: "starter_repair_skip" }); navigate("/services"); }}
                  className="text-sm underline text-muted-foreground hover:text-primary"
                >
                  Skip — browse all services
                </button>
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
