import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CategoryFilterBar, {
  ALL_CATEGORIES_LABEL,
  categoryMatches,
  type CategoryFilter,
} from "@/components/cobbli/CategoryFilterBar";
import ServiceCard from "@/components/cobbli/ServiceCard";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { useServices } from "@/hooks/useServices";
import { POPULAR_SERVICE_SLUGS, sortServices } from "@/data/serviceOrder";
import { addressesLine } from "@/data/starterRepairConditions";

// ---------------------------------------------------------------------------
// Section
//
// Packages removed from the homepage entirely (2026-07-23, Danielle's call
// after weighing packages vs. individual services vs. the Starter repair
// flow out loud). Reasoning: Start a Repair is already the primary hero CTA,
// and computeRecommendation() in starterRepairConditions.ts already
// recommends a package automatically whenever it's a genuine match — a
// separate "browse packages" section here just duplicated a decision the
// guided flow already makes, and led with it ahead of individual services,
// which /services stopped doing back on 2026-07-15 for the same reason
// ("most customers arrive condition-first, not by browsing bundles"). This
// component now only shows individual services; packages are still
// browsable on /services for anyone who clicks through, and still get
// recommended automatically from Start a Repair.
// ---------------------------------------------------------------------------

const Services = () => {
  const [active, setActive] = useState<CategoryFilter>(ALL_CATEGORIES_LABEL);
  const { data: services, isLoading } = useServices();

  const visibleServices = useMemo(() => {
    const list = (services ?? []).filter((s) => !s.isComingSoon);
    const filtered = list.filter((s) => categoryMatches(s.categories, active));
    return sortServices(filtered);
  }, [services, active]);

  const viewAllServicesHref =
    active === ALL_CATEGORIES_LABEL
      ? "/services"
      : `/services?category=${encodeURIComponent(active)}`;

  return (
    <section id="services" className="py-20 md:py-28 bg-white overflow-hidden">
      <div className="container">

        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 className="text-2xl md:text-3xl font-display text-primary">
            Services
          </h2>
          <Link
            to={viewAllServicesHref}
            className="text-sm underline font-medium shrink-0"
            style={{ color: "#7a5c40" }}
          >
            View all →
          </Link>
        </div>

        <CategoryFilterBar
          active={active}
          onChange={setActive}
          scrollable
          iconSize={22}
          className="mb-5"
        />

        {isLoading ? (
          <BrandSpinner className="py-12" size="lg" />
        ) : visibleServices.length === 0 ? (
          <p className="text-muted-foreground py-8 text-sm">
            No services in this category yet.
          </p>
        ) : (
          <div className="flex gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1">
            {visibleServices.map((s) => (
              <div key={s.slug} className="shrink-0" style={{ width: 160 }}>
                <ServiceCard
                  s={s}
                  isPopular={POPULAR_SERVICE_SLUGS.has(s.slug)}
                  addresses={addressesLine(s.slug)}
                />
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
};

export default Services;
