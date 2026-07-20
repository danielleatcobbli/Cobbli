import { useMemo, useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";

import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import ComingSoonSection from "@/components/cobbli/ComingSoonSection";
import { Button } from "@/components/ui/button";
import CategoryFilterBar, {
  ALL_CATEGORIES_LABEL,
  FILTER_BAR_CATEGORIES,
  type CategoryFilter,
} from "@/components/cobbli/CategoryFilterBar";
import { type Service } from "@/types/service";
import { useServices } from "@/hooks/useServices";
import ServiceCard from "@/components/cobbli/ServiceCard";
import { trackEvent } from "@/lib/analytics";
import { BUNDLES, type Bundle } from "@/data/bundles";
import { POPULAR_SERVICE_SLUGS, sortServices } from "@/data/serviceOrder";
import { addressesLine } from "@/data/starterRepairConditions";

const ALL = ALL_CATEGORIES_LABEL;
const categories = FILTER_BAR_CATEGORIES;

// ---------------------------------------------------------------------------
// Bundle card — no "Add to repair" button (Danielle's call: card click-through
// to the package detail page is the only action here now, matching how
// Shopify-style catalog pages work; "Start a repair" lives on the detail
// page instead, and the Starter repair checklist flow is the promoted path
// for anyone who doesn't already know exactly what they want).
// ---------------------------------------------------------------------------

const BundleCard = ({ bundle }: { bundle: Bundle }) => (
  <Link
    to={`/packages/${bundle.slug}`}
    className="rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all flex flex-col"
  >
    <div className="aspect-[4/5] relative" style={{ backgroundColor: "#3d1700" }}>
      {bundle.popular && (
        <span
          className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
        >
          Popular
        </span>
      )}
    </div>
    <div className="p-4 flex flex-col gap-1 flex-1">
      <h3 className="font-display text-[14px] font-bold leading-snug" style={{ color: "#3d1700" }}>
        {bundle.name}
      </h3>
      <p className="text-[12px] leading-snug mt-0.5" style={{ color: "#7a5c40" }}>
        <span className="font-bold" style={{ color: "#3d1700" }}>
          Best for
        </span>{" "}
        {bundle.bestFor}
      </p>
      <p className="text-[13px] font-bold mt-auto pt-2" style={{ color: "#3d1700" }}>
        {bundle.price}
      </p>
    </div>
  </Link>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const Services = () => {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const initialActive =
    categoryParam && categories.includes(categoryParam as (typeof categories)[number])
      ? (categoryParam as (typeof categories)[number])
      : ALL;
  const [active, setActive] = useState<(typeof categories)[number]>(initialActive);
  const { data: services, isLoading, isError } = useServices();

  useEffect(() => {
    const category = searchParams.get("category");
    if (category && categories.includes(category as (typeof categories)[number])) {
      setActive(category as (typeof categories)[number]);
    }
  }, [searchParams]);

  usePageMeta({
    title: "Services — Cobbli",
    description:
      "Browse Cobbli's NYC shoe repair services: sole and heel repair, zipper and strap fixes, cleaning and preventative care. Transparent pricing, fast turnaround.",
  });

  const list = services ?? [];

  const activeServices = useMemo(() => {
    const filtered = list.filter((s) => !s.isComingSoon);
    const byCat =
      active === ALL
        ? filtered
        : filtered.filter((s) =>
            s.categories.includes(active as Service["categories"][number]),
          );
    return sortServices(byCat);
  }, [list, active]);

  const comingSoonServices = useMemo(() => {
    const filtered = list.filter((s) => s.isComingSoon);
    const byCat =
      active === ALL
        ? filtered
        : filtered.filter((s) =>
            s.categories.includes(active as Service["categories"][number]),
          );
    return [...byCat].sort((a, b) => a.rank - b.rank);
  }, [list, active]);

  const serviceIdBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of list) map[s.slug] = s.id;
    return map;
  }, [list]);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />

      <section className="flex-1 py-16 md:py-20">
        <div className="container">

          {/* Section 1 — Individual services, promoted to the top (Danielle's
              call, 2026-07-15): most customers arrive condition-first (the
              Starter repair checklist or a photo assessment), not by
              browsing bundles, so the single-service catalog — now framed by
              the condition it addresses where one exists — is the more
              useful first thing to see. Packages moved below as a secondary
              "bundle and save" section rather than being removed outright. */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-display text-primary">
                Individual services
              </h1>
              <a
                href="#packages"
                className="mt-1 inline-block text-sm underline font-medium"
                style={{ color: "#7a5c40" }}
              >
                Or see if a package saves you more ↓
              </a>
            </div>
            <Button asChild size="lg" className="shrink-0">
              <Link to="/start-repair" onClick={() => trackEvent("start_repair", { source: "services_header" })}>
                Start a repair
              </Link>
            </Button>
          </div>

            <CategoryFilterBar active={active} onChange={setActive} className="mb-10" />

            {isLoading ? (
              <BrandSpinner className="py-20" size="lg" />
            ) : isError ? (
              <p className="text-muted-foreground py-10">
                We couldn't load services right now. Please refresh, or{" "}
                <a
                  href="mailto:support@cobbli.com"
                  className="underline text-primary"
                  onClick={() => trackEvent("consultation_email_clicked", { source: "services_error" })}
                >
                  support@cobbli.com
                </a>{" "}
                if it keeps happening.
              </p>
            ) : activeServices.length === 0 && comingSoonServices.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-xl text-primary mb-2">No services in this category yet</p>
                <p className="text-muted-foreground mb-6">
                  Try another category, or get in touch and we'll recommend the right repair.
                </p>
                <a
                  href="mailto:support@cobbli.com"
                  className="underline text-primary"
                  onClick={() => trackEvent("consultation_email_clicked", { source: "services_no_category" })}
                >
                  support@cobbli.com
                </a>
              </div>
            ) : (
              <>
                {activeServices.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
                    {activeServices.map((s) => (
                      <ServiceCard
                        key={s.slug}
                        s={s}
                        fromCategory={active}
                        isPopular={POPULAR_SERVICE_SLUGS.has(s.slug)}
                        addresses={addressesLine(s.slug)}
                      />
                    ))}
                  </div>
                )}

                <ComingSoonSection
                  services={comingSoonServices}
                  serviceIdBySlug={serviceIdBySlug}
                />
              </>
            )}

          {/* Section 2 — Packages, now secondary: still worth surfacing for
              anyone who needs several services done at once (the package
              price only ever gets recommended when it beats the itemized
              total — see computeRecommendation in starterRepairConditions.ts),
              just no longer the first thing on the page. */}
          <hr className="my-16 border-border" />
          <div id="packages" className="scroll-mt-20">
            <h2 className="text-3xl md:text-4xl font-display text-primary mb-2">
              Packages
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Bundle multiple repairs together and save.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
              {BUNDLES.map((bundle) => (
                <BundleCard key={bundle.name} bundle={bundle} />
              ))}
            </div>
          </div>

        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Services;
