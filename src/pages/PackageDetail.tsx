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
import { formatPrice } from "@/context/BagContext";
import { usePackagePrices } from "@/hooks/usePackagePrices";

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
                    fontFamily: "'Instrument Sans', sans-serif",
                    // Active column swapped from cream-on-white to amber-on-
                    // cream 2026-08-26 (Danielle's call, page bg is now cream
                    // itself, so the old cream highlight would've disappeared).
                    ...(active
                      ? { backgroundColor: "#fdb600", color: "#fff5cc", borderRadius: "6px 6px 0 0" }
                      : { color: "#fdb600", opacity: 0.7 }),
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
            <tr key={row.key} style={{ borderTop: "1px solid #fdb600" }}>
              <td
                className="p-2 text-xs font-medium break-words"
                style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif", width: `${labelWidth}%` }}
              >
                {row.label}
              </td>
              {COMPARISON_BUNDLES.map((b) => {
                const active = b.slug === activeSlug;
                const included = b.includedCategories.includes(row.key);
                return (
                  <td
                    key={b.slug}
                    className="p-2 text-center"
                    style={active ? { backgroundColor: "#fdb600" } : undefined}
                  >
                    {included ? (
                      <Check size={16} style={{ color: active ? "#fff5cc" : "#166534" }} className="inline" />
                    ) : (
                      <span style={{ color: active ? "#fff5cc" : "#c9b896", opacity: active ? 0.6 : 1 }}>—</span>
                    )}
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
  const packagePrices = usePackagePrices();
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
  const authoritativePrice = packagePrices.data?.[bundle.slug];
  const displayedPrice =
    typeof authoritativePrice === "number"
      ? formatPrice(authoritativePrice)
      : bundle.price;
  const packageUnavailable =
    !packagePrices.isLoading
    && !packagePrices.isError
    && typeof authoritativePrice !== "number";

  // Opens the shared pair popup (PairFlowDialog, mounted in App.tsx) with
  // this bundle as a single flat-priced line item, instead of navigating to
  // a separate page — same change as ServiceDetail.tsx's goToPick.
  const goToPick = () => {
    if (packageUnavailable) return;
    openPairFlow([{
      id: `bundle-${bundle.slug}`,
      name: bundle.name,
      price: authoritativePrice ?? bundlePriceToCents(bundle.price),
    }]);
  };

  const onStart = () => {
    trackEvent("service_added", { bundle: bundle.name, source: "package_detail" });
    if (bundle.requiresPaintConsent) {
      setConsentOpen(true);
      return;
    }
    goToPick();
  };

  // Restyled 2026-08-26 (Danielle's call) — same cream/amber pattern +
  // price/CTA-stays-brown scoping rule as ServiceDetail.tsx.
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />

      <section className="flex-1 py-10 md:py-12">
        <div className="container max-w-5xl">
          <Link
            to="/services"
            className="inline-flex items-center gap-1 text-sm mb-6 hover:opacity-80"
            style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}
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
              {/* Only the package name stays amber 2026-08-27 (Danielle's
                  call, same treatment as ServiceDetail.tsx: "the text on the
                  pages brown and just the service name is yellow") —
                  everything else below switched to Cobbli brown. */}
              <h1
                className="text-3xl md:text-4xl uppercase"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
              >
                {bundle.name}
              </h1>
              <p className="mt-3 leading-relaxed" style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}>
                <span className="font-bold">Best for</span>{" "}
                {bundle.bestFor}
              </p>
              <p className="mt-2 leading-relaxed" style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}>{bundle.description}</p>

              <div className="my-6" style={{ borderTop: "1px solid #3d1700" }} />

              {/* Included */}
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}>Included</p>
                <ul className="space-y-1 text-sm" style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}>
                  {bundle.includesJustAShine && (
                    <li><span className="font-bold">Just a shine</span></li>
                  )}
                  {included.map((c) => (
                    <li key={c.key}>
                      <span className="font-bold">{c.label}:</span> {c.items}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-bold leading-none" style={{ color: "#3d1700" }}>
                    {displayedPrice}
                  </span>
                  <span className="text-sm" style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}>per pair</span>
                </div>
              </div>

              <Button
                type="button"
                size="lg"
                onClick={onStart}
                disabled={packageUnavailable}
                className="w-full"
                style={{ backgroundColor: "#3d1700", color: "#ffffff" }}
              >
                {packageUnavailable ? "Currently unavailable" : "Start a repair"}
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
              <h2
                className="text-2xl md:text-3xl uppercase mb-2"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#3d1700" }}
              >
                Compare packages
              </h2>
              <p className="text-sm mb-4" style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}>
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
