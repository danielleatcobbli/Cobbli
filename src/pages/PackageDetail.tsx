/**
 * PackageDetail
 *
 * Detail page for a repair "package" (bundle) — the click-through target for
 * the package cards on the Services page. Mirrors ServiceDetail.tsx's layout
 * (image left, title/description/price/CTA right) so packages and individual
 * services feel like the same product.
 *
 * Also includes, per Danielle's spec:
 * - An Included / Not included breakdown for this specific package, built
 *   from the 5 standard categories in src/data/bundles.ts (Not included is
 *   always the complement of Included — never hand-maintained separately).
 * - A cross-package comparison table ("what's included vs not across
 *   repairs") with this package's column highlighted, so a customer landing
 *   on any package's page can see how it stacks up against the others.
 * - The same dye/paint consent question used for individual services,
 *   gating "Start a repair" for the packages that need it.
 * - The same "brands not currently supported" disclosure pattern as
 *   ServiceDetail, per-package.
 *
 * The main image block is still a plain brand-color placeholder — no
 * before/after photos exist for packages yet — but is structured the same
 * way ServiceDetail's image block is, so swapping in a real photo (or the
 * BeforeAfterSlider, once real photo pairs exist) is a drop-in change later.
 *
 * Route: /packages/:slug
 */

import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, Navigate, useParams } from "react-router-dom";
import { ChevronLeft, Check } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import PaintConsentDialog from "@/components/cobbli/PaintConsentDialog";
import UnsupportedBrandsAccordion from "@/components/cobbli/UnsupportedBrandsAccordion";
import { useRepairFlow } from "@/context/RepairFlowContext";
import {
  BUNDLES,
  bundleBySlug,
  bundlePriceToCents,
  INCLUDED_CATEGORIES,
  type IncludedCategoryKey,
} from "@/data/bundles";
import { trackEvent } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Cross-package comparison table
//
// "Just a Shine" is deliberately excluded from this table entirely (not just
// its own row) — Danielle's call: a standalone polish doesn't meaningfully
// compare against the 5-category repair packages, so including its column
// (which would otherwise show as all-empty) is more confusing than helpful.
// ---------------------------------------------------------------------------

const COMPARISON_ROWS: { key: IncludedCategoryKey; label: string }[] = INCLUDED_CATEGORIES.map((c) => ({
  key: c.key,
  label: c.label,
}));

const COMPARISON_BUNDLES = BUNDLES.filter((b) => !b.includesJustAShine && !b.hidden);

const ComparisonTable = ({ activeSlug }: { activeSlug: string }) => {
  const labelWidth = 20;
  const colWidth = (100 - labelWidth) / COMPARISON_BUNDLES.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm table-fixed">
        <thead>
          <tr>
            <th className="p-2 text-left" style={{ width: `${labelWidth}%` }} />
            {COMPARISON_BUNDLES.map((b) => {
              const active = b.slug === activeSlug;
              return (
                <th
                  key={b.slug}
                  className="p-2 text-center text-xs font-medium align-bottom break-words"
                  style={{
                    width: `${colWidth}%`,
                    ...(active
                      ? { backgroundColor: "#fff5cc", color: "#3d1700", borderRadius: "6px 6px 0 0" }
                      : { color: "#7a5c40" }),
                  }}
                >
                  {b.name}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="p-2 text-xs font-medium break-words" style={{ color: "#3d1700", width: `${labelWidth}%` }}>
                {row.label}
              </td>
              {COMPARISON_BUNDLES.map((b) => {
                const active = b.slug === activeSlug;
                const included = b.includedCategories.includes(row.key);
                return (
                  <td
                    key={b.slug}
                    className="p-2 text-center"
                    style={active ? { backgroundColor: "#fff5cc" } : undefined}
                  >
                    {included ? <Check size={16} style={{ color: "#166534" }} className="inline" /> : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const PackageDetail = () => {
  const { slug = "" } = useParams();
  const bundle = bundleBySlug(slug);
  const { setPaintConsent, openPairFlow } = useRepairFlow();
  const [consentOpen, setConsentOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);

  usePageMeta({
    title: bundle ? `${bundle.name} — Cobbli` : "Repair package — Cobbli",
    description: bundle
      ? `${bundle.bestFor}. Book the ${bundle.name.toLowerCase()} package with Cobbli's NYC door-to-door shoe repair service.`
      : "Cobbli's repair packages, with transparent pricing and door-to-door pickup and return across NYC.",
  });

  if (!bundle) return <Navigate to="/services" replace />;

  const included = INCLUDED_CATEGORIES.filter((c) => bundle.includedCategories.includes(c.key));

  // Opens the shared pair popup (PairFlowDialog, mounted in App.tsx) with
  // this bundle as a single flat-priced line item, instead of navigating to
  // a separate page — same change as ServiceDetail.tsx's goToPick.
  const goToPick = () => {
    const bundleSlug = `bundle-${bundle.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
    openPairFlow([{ id: bundleSlug, name: bundle.name, price: bundlePriceToCents(bundle.price) }]);
  };

  const onStart = () => {
    trackEvent("service_added", { bundle: bundle.name, source: "package_detail" });
    if (bundle.requiresPaintConsent) {
      setConsentOpen(true);
      return;
    }
    goToPick();
  };

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />

      <section className="flex-1 py-10 md:py-12">
        <div className="container max-w-5xl">
          <Link
            to="/services"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6"
          >
            <ChevronLeft size={16} /> Back
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">

            {/* Image — placeholder today; swap in a real photo (or the
                before/after slider) once package photos exist. */}
            <div className="aspect-[4/5] rounded-xl relative overflow-hidden" style={{ backgroundColor: "#3d1700" }}>
              {bundle.popular && (
                <span
                  className="absolute top-3 left-3 text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                >
                  Popular
                </span>
              )}
            </div>

            {/* Content */}
            <div>
              <h1 className="font-display text-3xl text-primary">{bundle.name}</h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                <span className="font-bold" style={{ color: "#3d1700" }}>Best for</span>{" "}
                {bundle.bestFor}
              </p>
              <p className="mt-2 text-muted-foreground leading-relaxed">{bundle.description}</p>

              <div className="my-6 border-t border-border" />

              {/* Included */}
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Included</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {bundle.includesJustAShine && (
                    <li><span className="font-bold" style={{ color: "#3d1700" }}>Just a shine</span></li>
                  )}
                  {included.map((c) => (
                    <li key={c.key}>
                      <span className="font-bold" style={{ color: "#3d1700" }}>{c.label}:</span> {c.items}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-bold leading-none" style={{ color: "#3d1700" }}>
                    {bundle.price}
                  </span>
                  <span className="text-sm text-muted-foreground">per pair</span>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={onStart}
                className="w-full"
                style={{ backgroundColor: "#3d1700", color: "white" }}
              >
                Start a repair
              </Button>

              {bundle.unsupportedBrands.length > 0 && (
                <div className="mt-4">
                  <UnsupportedBrandsAccordion
                    brands={bundle.unsupportedBrands}
                    open={brandsOpen}
                    onToggle={() => setBrandsOpen((o) => !o)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Cross-package comparison — this package's column highlighted.
              Skipped entirely on Just a Shine's own page, since it isn't
              part of this comparison (see ComparisonTable above). */}
          {!bundle.includesJustAShine && (
            <div className="mt-14">
              <h2 className="font-display text-2xl text-primary mb-2">Compare packages</h2>
              <p className="text-sm text-muted-foreground mb-4">
                See what's included across every package — {bundle.name} is highlighted below.
              </p>
              <ComparisonTable activeSlug={bundle.slug} />
            </div>
          )}
        </div>
      </section>

      <Footer />

      <PaintConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        confirmLabel="Start a repair"
        onConfirm={(consent) => {
          setPaintConsent(bundle.slug, consent);
          goToPick();
        }}
      />
    </main>
  );
};

export default PackageDetail;
