import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CategoryFilterBar, {
  ALL_CATEGORIES_LABEL,
  type CategoryFilter,
} from "@/components/cobbli/CategoryFilterBar";
import ServiceCard from "@/components/cobbli/ServiceCard";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import PaintConsentDialog, { PAINT_CONSENT_SLUGS } from "@/components/cobbli/PaintConsentDialog";
import SoleMaterialDialog, { SOLE_MATERIAL_SLUGS } from "@/components/cobbli/SoleMaterialDialog";
import { type Service } from "@/types/service";
import { useServices } from "@/hooks/useServices";
import { useRepairFlow } from "@/context/RepairFlowContext";

// ---------------------------------------------------------------------------
// Bundle data — homepage display order (popular first)
// ---------------------------------------------------------------------------

type HomepageBundle = {
  name: string;
  popular: boolean;
  bestFor: string;
  price: string;
};

const HOMEPAGE_BUNDLES: HomepageBundle[] = [
  {
    name: "Sole & Surface",
    popular: true,
    bestFor: "shoes with day-to-day wear on the surface and sole",
    price: "$125",
  },
  {
    name: "Sole",
    popular: true,
    bestFor: "shoes with a worn down or separated sole",
    price: "$85",
  },
  {
    name: "Surface",
    popular: true,
    bestFor: "shoes with surface damage, dullness, or discoloration",
    price: "$100",
  },
  {
    name: "Just a Shine",
    popular: true,
    bestFor: "shoes that need a quick polish and shine",
    price: "$20",
  },
  {
    name: "Sole, Surface & Interior",
    popular: false,
    bestFor: "shoes showing day-to-day wear on the surface, sole, and inside",
    price: "$200",
  },
  {
    name: "Full Service",
    popular: false,
    bestFor: "shoes that need a full revamp or are experiencing damage beyond everyday wear",
    price: "$250",
  },
  {
    name: "Interior",
    popular: false,
    bestFor: "shoes that are worn or uncomfortable on the inside",
    price: "$100",
  },
  {
    name: "Preventative Care",
    popular: false,
    bestFor: "protecting shoes you want to last",
    price: "$60",
  },
];

// ---------------------------------------------------------------------------
// Service display order — popular first
// ---------------------------------------------------------------------------

const POPULAR_SERVICE_SLUGS = new Set([
  "full-resole",
  "color-restoration",
  "leather-or-suede-conditioning",
  "insole-replacement",
  "lining-repair",
  "shoe-shine",
]);

const ORDERED_SERVICE_SLUGS: string[] = [
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

const slugOrder = (slug: string) => {
  const idx = ORDERED_SERVICE_SLUGS.indexOf(slug);
  return idx === -1 ? ORDERED_SERVICE_SLUGS.length : idx;
};

const sortServices = (list: Service[]) =>
  [...list].sort((a, b) => slugOrder(a.slug) - slugOrder(b.slug) || a.rank - b.rank);

// ---------------------------------------------------------------------------
// Bundle card (homepage)
// ---------------------------------------------------------------------------

const HomepageBundleCard = ({
  bundle,
  onAddToRepair,
}: {
  bundle: HomepageBundle;
  onAddToRepair: () => void;
}) => (
  <div
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
    <div className="px-3 pb-3">
      <button
        type="button"
        onClick={onAddToRepair}
        className="w-full rounded-md py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#3d1700" }}
      >
        Add to repair
      </button>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

const Services = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState<CategoryFilter>(ALL_CATEGORIES_LABEL);
  const { data: services, isLoading } = useServices();
  const { setPaintConsent, setSoleMaterial } = useRepairFlow();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [soleOpen, setSoleOpen] = useState(false);

  const goToPick = (slug: string) =>
    navigate(`/start-repair/pick?service=${encodeURIComponent(slug)}`);

  const handleAddToRepair = (slug: string) => {
    if (PAINT_CONSENT_SLUGS.has(slug)) {
      setPendingSlug(slug);
      setConsentOpen(true);
      return;
    }
    if (SOLE_MATERIAL_SLUGS.has(slug)) {
      setPendingSlug(slug);
      setSoleOpen(true);
      return;
    }
    goToPick(slug);
  };

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
            Choose your repair package
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
          {HOMEPAGE_BUNDLES.map((bundle) => (
            <HomepageBundleCard
              key={bundle.name}
              bundle={bundle}
              onAddToRepair={() => navigate("/start-repair/pick")}
            />
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
            Choose individual services
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
                  onAddToRepair={handleAddToRepair}
                />
              </div>
            ))}
          </div>
        )}

      </div>

      <PaintConsentDialog
        open={consentOpen}
        onOpenChange={(v) => { if (!v) { setConsentOpen(false); setPendingSlug(null); } }}
        onConfirm={(consent) => {
          if (pendingSlug) { setPaintConsent(pendingSlug, consent); goToPick(pendingSlug); }
          setPendingSlug(null);
          setConsentOpen(false);
        }}
      />
      <SoleMaterialDialog
        open={soleOpen}
        onOpenChange={(v) => { if (!v) { setSoleOpen(false); setPendingSlug(null); } }}
        onConfirm={(material) => {
          if (pendingSlug) { setSoleMaterial(pendingSlug, material); goToPick(pendingSlug); }
          setPendingSlug(null);
          setSoleOpen(false);
        }}
      />
    </section>
  );
};

export default Services;
