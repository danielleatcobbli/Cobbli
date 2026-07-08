import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";

import { Camera } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import ComingSoonSection from "@/components/cobbli/ComingSoonSection";
import CategoryFilterBar, {
  ALL_CATEGORIES_LABEL,
  FILTER_BAR_CATEGORIES,
  type CategoryFilter,
} from "@/components/cobbli/CategoryFilterBar";
import PaintConsentDialog, { PAINT_CONSENT_SLUGS } from "@/components/cobbli/PaintConsentDialog";
import SoleMaterialDialog, { SOLE_MATERIAL_SLUGS } from "@/components/cobbli/SoleMaterialDialog";
import { type Service } from "@/types/service";
import { useServices } from "@/hooks/useServices";
import { useRepairFlow } from "@/context/RepairFlowContext";
import ServiceCard from "@/components/cobbli/ServiceCard";

const ALL = ALL_CATEGORIES_LABEL;
const categories = FILTER_BAR_CATEGORIES;

// ---------------------------------------------------------------------------
// Bundle / experience data
// ---------------------------------------------------------------------------

type Bundle = {
  name: string;
  popular: boolean;
  bestFor: string;
  price: string;
};

const BUNDLES: Bundle[] = [
  {
    name: "Full Service",
    popular: false,
    bestFor: "Shoes that need a full revamp or are experiencing damage beyond everyday wear",
    price: "$250",
  },
  {
    name: "Sole, Surface & Interior",
    popular: false,
    bestFor: "Shoes showing day-to-day wear on the surface, sole, and inside",
    price: "$200",
  },
  {
    name: "Sole & Surface",
    popular: true,
    bestFor: "Shoes with day-to-day wear on the surface and sole",
    price: "$125",
  },
  {
    name: "Surface",
    popular: true,
    bestFor: "Shoes with surface damage, dullness, or discoloration",
    price: "$100",
  },
  {
    name: "Interior",
    popular: false,
    bestFor: "Shoes that are worn or uncomfortable on the inside",
    price: "$100",
  },
  {
    name: "Sole",
    popular: true,
    bestFor: "Shoes with a worn down or separated sole",
    price: "$85",
  },
  {
    name: "Preventative Care",
    popular: false,
    bestFor: "Protecting shoes you want to last or preventing more costly repairs",
    price: "$60",
  },
  {
    name: "Just a Shine",
    popular: true,
    bestFor: "Shoes that need a quick polish and shine",
    price: "$20",
  },
];

/** "$250" -> 25000 (cents) — bundles are flat-priced, not yet backed by real
 * catalog services, so this is the only price source for a bundle bag item. */
const bundlePriceToCents = (price: string): number => Math.round(parseFloat(price.replace(/[^0-9.]/g, "")) * 100);

// ---------------------------------------------------------------------------
// Popular service slugs + display order
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

const sortServices = (services: Service[]) =>
  [...services].sort((a, b) => slugOrder(a.slug) - slugOrder(b.slug) || a.rank - b.rank);

// ---------------------------------------------------------------------------
// Bundle card
// ---------------------------------------------------------------------------

const BundleCard = ({ bundle, onAddToRepair }: { bundle: Bundle; onAddToRepair: () => void }) => (
  <div className="rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all flex flex-col">
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
    <div className="px-4 pb-4">
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
// Page
// ---------------------------------------------------------------------------

const Services = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const initialActive =
    categoryParam && categories.includes(categoryParam as (typeof categories)[number])
      ? (categoryParam as (typeof categories)[number])
      : ALL;
  const [active, setActive] = useState<(typeof categories)[number]>(initialActive);
  const { data: services, isLoading, isError } = useServices();
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

          {/* Section 1 — Choose your repair package */}
          <div className="flex items-baseline justify-between gap-4 flex-wrap mb-6">
            <h1 className="text-3xl md:text-4xl font-display text-primary">
              Choose your repair package
            </h1>
            <a
              href="#individual-services"
              className="text-sm underline font-medium"
              style={{ color: "#7a5c40" }}
            >
              Or choose individual services ↓
            </a>
          </div>

          {/* Photo assessment banner */}
          <Link
            to="/start-repair/assessment"
            className="flex items-center gap-3 px-4 py-3 rounded-[10px] mb-8 border hover:shadow-sm transition-shadow"
            style={{ backgroundColor: "#fff5cc", borderColor: "#fdb600" }}
          >
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
            >
              <Camera size={16} />
            </div>
            <p className="text-sm flex-1" style={{ color: "#3d1700" }}>
              Not sure what your shoes need? Upload a photo and we'll recommend the right services.
            </p>
            <span
              className="text-sm whitespace-nowrap underline font-medium shrink-0"
              style={{ color: "#3d1700" }}
            >
              Get a recommendation →
            </span>
          </Link>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 md:gap-6">
            {BUNDLES.map((bundle) => (
              <BundleCard
                key={bundle.name}
                bundle={bundle}
                onAddToRepair={() =>
                  navigate(
                    `/start-repair/pick?bundle=${encodeURIComponent(bundle.name)}&bundlePrice=${bundlePriceToCents(bundle.price)}`,
                  )
                }
              />
            ))}
          </div>

          {/* Divider */}
          <hr className="my-16 border-border" />

          {/* Section 2 — Individual services */}
          <div id="individual-services" className="scroll-mt-20">
            <h2 className="text-3xl md:text-4xl font-display text-primary mb-6">
              Or choose individual services
            </h2>

            <CategoryFilterBar active={active} onChange={setActive} className="mb-10" />

            {isLoading ? (
              <BrandSpinner className="py-20" size="lg" />
            ) : isError ? (
              <p className="text-muted-foreground py-10">
                We couldn't load services right now. Please refresh, or{" "}
                <a href="mailto:support@cobbli.com" className="underline text-primary">
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
                <a href="mailto:support@cobbli.com" className="underline text-primary">
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
                        onAddToRepair={handleAddToRepair}
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

        </div>
      </section>

      <Footer />

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
    </main>
  );
};

export default Services;
