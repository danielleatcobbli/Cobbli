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
  categoryMatches,
  type CategoryFilter,
} from "@/components/cobbli/CategoryFilterBar";
import { useServices } from "@/hooks/useServices";
import ServiceCard from "@/components/cobbli/ServiceCard";
import { trackEvent } from "@/lib/analytics";
import { POPULAR_SERVICE_SLUGS, sortServices } from "@/data/serviceOrder";
import { addressesLine } from "@/data/starterRepairConditions";

const ALL = ALL_CATEGORIES_LABEL;
const categories = FILTER_BAR_CATEGORIES;

// ---------------------------------------------------------------------------
// Page
//
// Packages section removed (2026-07-23, Danielle's call, same day as
// disabling package selection in computeRecommendation over in
// starterRepairConditions.ts — see that file for the full reasoning). With
// Starter repair never recommending a package anymore, leaving a "Or see if
// a package saves you more" promise on this page would've been actively
// wrong. BUNDLES/PackageDetail.tsx and the /packages/:slug routes are left
// alone, not deleted — just unlinked from here — since Danielle may want
// packages back in some form (flat SKUs again, or an automatic "bundle and
// save" discount instead — undecided, revisit later).
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
    const byCat = filtered.filter((s) => categoryMatches(s.categories, active));
    return sortServices(byCat);
  }, [list, active]);

  const comingSoonServices = useMemo(() => {
    const filtered = list.filter((s) => s.isComingSoon);
    const byCat = filtered.filter((s) => categoryMatches(s.categories, active));
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

          {/* Individual services catalog (Danielle's call, 2026-07-15,
              reaffirmed 2026-07-23): most customers arrive condition-first
              (the Starter repair checklist or a photo assessment), not by
              browsing bundles, so the single-service catalog — now framed by
              the condition it addresses where one exists — is the more
              useful thing to see here. No packages promise below anymore. */}
          <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-display text-primary">
                Services
              </h1>
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

        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Services;
