import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CategoryFilterBar, {
  ALL_CATEGORIES_LABEL,
  type CategoryFilter,
} from "@/components/cobbli/CategoryFilterBar";
import ServiceCard from "@/components/cobbli/ServiceCard";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { type Service } from "@/types/service";
import { useServices } from "@/hooks/useServices";
import { BUNDLES, type Bundle } from "@/data/bundles";
import { POPULAR_SERVICE_SLUGS, sortServices } from "@/data/serviceOrder";
import { addressesLine } from "@/data/starterRepairConditions";

// ---------------------------------------------------------------------------
// Bundle card (homepage) — same data as pages/Services.tsx (src/data/bundles.ts),
// just sized/laid out for the homepage's horizontal-scroll row instead of a grid.
// No "Add to repair" button (Danielle's call, matching pages/Services.tsx) —
// the card is click-through only to the package detail page, which has its
// own "Start a repair" button.
// ---------------------------------------------------------------------------

const HomepageBundleCard = ({ bundle }: { bundle: Bundle }) => (
  <Link
    to={`/packages/${bundle.slug}`}
    className="shrink-0 rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all flex flex-col"
    style={{ width: 200 }}
  >
    <div className="relative" style={{ aspectRatio: "4/5", backgroundColor: "#3d1700" }}>
      {bundle.popular && (
        <span
          className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
        >
          Popular
        </span>
      )}
    </div>
    <div className="p-3 flex flex-col gap-1 flex-1">
      <h3 className="font-display text-[14px] font-bold leading-snug" style={{ color: "#3d1700" }}>
        {bundle.name}
      </h3>
      <p className="text-[11px] leading-snug mt-0.5" style={{ color: "#7a5c40" }}>
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
// Section
// ---------------------------------------------------------------------------

const Services = () => {
  const [active, setActive] = useState<CategoryFilter>(ALL_CATEGORIES_LABEL);
  const { data: services, isLoading } = useServices();

  const visibleServices = useMemo(() => {
    const list = (services ?? []).filter((s) => !s.isComingSoon);
    const filtered =
      active === ALL_CATEGORIES_LABEL
        ? list
        : list.filter((s) =>
            s.categories.includes(active as Service["categories"][number]),
          );
    return sortServices(filtered);
  }, [services, active]);

  const viewAllServicesHref =
    active === ALL_CATEGORIES_LABEL
      ? "/services#individual-services"
      : `/services?category=${encodeURIComponent(active)}`;

  return (
    <section id="services" className="py-20 md:py-28 bg-white overflow-hidden">
      <div className="container">

        {/* ── Section 1: experiences ── */}
        <div className="flex items-baseline justify-between gap-4 mb-1">
          <h2 className="text-2xl md:text-3xl font-display text-primary">
            Packages
          </h2>
          <Link
            to="/services"
            className="text-sm underline font-medium shrink-0"
            style={{ color: "#7a5c40" }}
          >
            View all →
          </Link>
        </div>

        <a
          href="#individual-services-home"
          className="block text-xs mb-5 underline"
          style={{ color: "#7a5c40" }}
        >
          or choose individual services ↓
        </a>

        <div className="flex gap-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1">
          {BUNDLES.map((bundle) => (
            <HomepageBundleCard key={bundle.slug} bundle={bundle} />
          ))}
        </div>

        {/* ── Divider ── */}
        <hr
          className="my-7"
          style={{ borderColor: "#f0ece4", marginLeft: 28, marginRight: 28 }}
        />

        {/* ── Section 2: individual services ── */}
        <div id="individual-services-home" className="flex items-baseline justify-between gap-4 mb-4 scroll-mt-20">
          <h2 className="text-2xl md:text-3xl font-display text-primary">
            Individual services
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
