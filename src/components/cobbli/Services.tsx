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
    <section id="services" className="relative overflow-hidden" style={{ backgroundColor: "#fff5cc" }}>
      {/* Cream section (Danielle's exact "cobbli cream" hex, #fff5cc) with an
          amber wave divider at the bottom leading into How it works, and
          amber cards (ServiceCard theme="amber") — matches her homepage
          mockup and her cream-section/yellow-accent, yellow-section/cream-
          accent rule, 2026-08-26. Filter bar and card grid logic are
          unchanged; only ServiceCard's color theme differs here. */}
      <div className="container py-14 md:py-20">

        {/* Heading enlarged + uppercased 2026-08-26 (Danielle's call) to
            match the consistent big-heading treatment across every homepage
            section now (Services/How it works/Reviews/Get to know us all
            text-5xl md:text-7xl uppercase). Left-aligned (Danielle's call —
            not every homepage heading needs to be centered; other section
            headings stay centered). "View all" sits in the same row,
            vertically centered against the heading text via items-center,
            rather than stacked above it. */}
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-left text-5xl md:text-7xl uppercase"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
          >
            Services
          </h2>
          <Link
            to={viewAllServicesHref}
            className="text-sm underline font-medium shrink-0"
            style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif" }}
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
          theme="amber"
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
              // Widened 160 -> 280 2026-08-26 (Danielle's call, matches her
              // Canva mockup's larger tiles) — ServiceCard's photo box is
              // aspect-[4/5], so it scales up with the wider card automatically.
              <div key={s.slug} className="shrink-0" style={{ width: 280 }}>
                <ServiceCard
                  s={s}
                  isPopular={POPULAR_SERVICE_SLUGS.has(s.slug)}
                  addresses={addressesLine(s.slug)}
                  theme="amber"
                />
              </div>
            ))}
          </div>
        )}

      </div>

      <svg
        className="block w-full absolute -bottom-px left-0"
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        style={{ height: 40 }}
        aria-hidden="true"
      >
        <path
          d="M0,60 C240,15 480,15 720,38 C960,60 1200,60 1440,25 L1440,60 L0,60 Z"
          fill="#fdb600"
        />
      </svg>
    </section>
  );
};

export default Services;
