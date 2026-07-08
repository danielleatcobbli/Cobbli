import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronUp } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import PaintConsentDialog, { PAINT_CONSENT_SLUGS } from "@/components/cobbli/PaintConsentDialog";
import SoleMaterialDialog, { SOLE_MATERIAL_SLUGS } from "@/components/cobbli/SoleMaterialDialog";
import ComingSoonVoteButton from "@/components/cobbli/ComingSoonVoteButton";
import { useService } from "@/hooks/useServices";
import { useRepairFlow } from "@/context/RepairFlowContext";

type Mode = "flow" | "standalone";

// ---------------------------------------------------------------------------
// Popular services
// ---------------------------------------------------------------------------

const POPULAR_SERVICE_SLUGS = new Set([
  "full-resole",
  "color-restoration",
  "leather-or-suede-conditioning",
  "insole-replacement",
  "lining-repair",
  "shoe-shine",
]);

// ---------------------------------------------------------------------------
// Flat price fallback — used only when the DB card_price_label is empty.
// The detail page always shows "per pair" as the unit (hardcoded below).
// These dollar amounts should stay in sync with card_price_label in the DB.
// ---------------------------------------------------------------------------

const SERVICE_DETAIL_PRICE: Record<string, string> = {
  "full-resole":                   "$85",
  "high-heel-tip-replacement":     "$35",
  "heel-reattachment":             "$100",
  "color-restoration":             "$80",
  "leather-or-suede-conditioning": "$65",
  "deodorizing-treatment":         "$50",
  "shoe-shine":                    "$20",
  "insole-replacement":            "$50",
  "lining-repair":                 "$75",
  "seam-repair":                   "$50",
  "waterproofing":                 "$30",
  "protective-full-sole":          "$50",
  "hardware-repair":               "$45",
  "buckle-repair":                 "$45",
  "strap-repair":                  "$45",
  "zipper-reattachment":           "$75",
  "zipper-slider-replacement":     "$45",
  // Coming soon
  "full-dye":                      "$125",
  "shoe-stretching":               "$40",
  "buckle-replacement":            "$80",
  "heel-replacement":              "$150",
};

// ---------------------------------------------------------------------------
// Brands not currently supported — per service
// ---------------------------------------------------------------------------

const UNSUPPORTED_BRANDS: Record<string, string[]> = {
  "full-resole":         ["Christian Louboutin", "Golden Goose", "Maison Margiela"],
  "color-restoration":   ["Golden Goose"],
  "insole-replacement":  ["Maison Margiela"],
  "protective-full-sole":["Christian Louboutin", "Golden Goose", "Maison Margiela"],
  "zipper-reattachment": ["Golden Goose"],
  "heel-replacement":    ["Christian Louboutin"],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ServiceDetail = ({ mode }: { mode: Mode }) => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { service, isLoading } = useService(slug);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [soleOpen, setSoleOpen] = useState(false);
  const { setPaintConsent, setSoleMaterial } = useRepairFlow();
  const [detailSearchParams] = useSearchParams();

  usePageMeta({
    title: service ? `${service.name} — Cobbli` : "Service — Cobbli",
    description: service
      ? `${service.description} Book ${service.name.toLowerCase()} with Cobbli's NYC door-to-door shoe repair service. Transparent pricing and fast turnaround.`
      : "Cobbli's professional shoe repair services with transparent pricing and door-to-door pickup and return across NYC.",
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white flex flex-col">
        <Header />
        {mode === "flow" && <StepIndicator current="select" />}
        <section className="flex-1 flex items-center justify-center py-20">
          <BrandSpinner size="lg" />
        </section>
        <Footer />
      </main>
    );
  }

  if (!service) return <Navigate to={mode === "flow" ? "/start-repair/services" : "/services"} replace />;

  const unsupportedBrands = UNSUPPORTED_BRANDS[service.slug];
  const isPopular = POPULAR_SERVICE_SLUGS.has(service.slug);
  // Use the DB card_price_label as the canonical price (so the detail page always
  // matches the grid card). Fall back to the local table if the DB value is empty.
  // Strip any residual "per ..." suffix in case old DB rows haven't been migrated.
  const rawPrice = service.cardPriceLabel || SERVICE_DETAIL_PRICE[service.slug] || "";
  const displayPrice = rawPrice.replace(/\s+per\s+\S.*/i, "").trim();

  const onBack = () => {
    const from = detailSearchParams.get("from");
    if (mode !== "flow" && from) {
      navigate(`/services?category=${encodeURIComponent(from)}`);
    } else {
      navigate(mode === "flow" ? "/start-repair/services" : "/services");
    }
  };

  const goToPick = () => navigate(`/start-repair/pick?service=${encodeURIComponent(service.slug)}`);

  const onStart = () => {
    if (PAINT_CONSENT_SLUGS.has(service.slug)) {
      setConsentOpen(true);
      return;
    }
    if (SOLE_MATERIAL_SLUGS.has(service.slug)) {
      setSoleOpen(true);
      return;
    }
    goToPick();
  };

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      {mode === "flow" && <StepIndicator current="select" />}

      <section className="flex-1 py-10 md:py-12">
        <div className="container max-w-5xl">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">

            {/* ── Image ── */}
            <div
              className="aspect-[4/5] rounded-xl relative overflow-hidden"
              style={{
                backgroundColor: service.isComingSoon ? "#9a8870" : "#3d1700",
              }}
            >
              {service.isComingSoon && (
                <span
                  className="absolute top-3 left-3 text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                >
                  Coming soon
                </span>
              )}
            </div>

            {/* ── Content ── */}
            <div>

              {/* Popular tag */}
              {isPopular && !service.isComingSoon && (
                <span
                  className="inline-block mb-3 text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                >
                  Popular
                </span>
              )}

              <h1 className="font-display text-3xl text-primary">{service.name}</h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                {service.fullDescription || service.description}
              </p>

              {/* ── Coming soon ── */}
              {service.isComingSoon ? (
                <>
                  <div className="mt-8">
                    <ComingSoonVoteButton serviceId={service.id} />
                  </div>

                  {unsupportedBrands && unsupportedBrands.length > 0 && (
                    <div className="mt-4">
                      <UnsupportedBrandsAccordion
                        brands={unsupportedBrands}
                        open={brandsOpen}
                        onToggle={() => setBrandsOpen((o) => !o)}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="my-6 border-t border-border" />

                  {/* ── Pricing ── */}
                  {displayPrice && (
                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[28px] font-bold leading-none" style={{ color: "#3d1700" }}>
                          {displayPrice}
                        </span>
                        <span className="text-sm text-muted-foreground">per pair</span>
                      </div>
                    </div>
                  )}

                  {/* ── CTA ── */}
                  <Button
                    type="button"
                    size="lg"
                    onClick={onStart}
                    className="w-full"
                    style={{ backgroundColor: "#3d1700", color: "white" }}
                  >
                    Start a repair
                  </Button>

                  {/* ── Brands not currently supported ── */}
                  {unsupportedBrands && unsupportedBrands.length > 0 && (
                    <div className="mt-4">
                      <UnsupportedBrandsAccordion
                        brands={unsupportedBrands}
                        open={brandsOpen}
                        onToggle={() => setBrandsOpen((o) => !o)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <PaintConsentDialog
        open={consentOpen}
        onOpenChange={setConsentOpen}
        confirmLabel="Start a repair"
        onConfirm={(consent) => {
          setPaintConsent(service.slug, consent);
          goToPick();
        }}
      />

      <SoleMaterialDialog
        open={soleOpen}
        onOpenChange={setSoleOpen}
        confirmLabel="Start a repair"
        onConfirm={(material) => {
          setSoleMaterial(service.slug, material);
          goToPick();
        }}
      />
    </main>
  );
};

// ---------------------------------------------------------------------------
// Unsupported brands accordion
// ---------------------------------------------------------------------------

type AccordionProps = {
  brands: string[];
  open: boolean;
  onToggle: () => void;
};

const UnsupportedBrandsAccordion = ({ brands, open, onToggle }: AccordionProps) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
    >
      Brands not currently supported
      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
    {open && (
      <div className="mt-2 space-y-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {brands.join(", ")}.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          These brands use signature materials, finishes, and techniques that require specialist
          handling and sourcing to repair correctly. We're working toward supporting them.
        </p>
        <button
          type="button"
          className="text-xs text-muted-foreground underline hover:text-primary"
        >
          👍 Vote to add support for these brands
        </button>
      </div>
    )}
  </div>
);

export default ServiceDetail;
