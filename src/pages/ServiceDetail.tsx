import { useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronUp, Minus, Plus } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import PaintConsentDialog, { PAINT_CONSENT_SLUGS } from "@/components/cobbli/PaintConsentDialog";
import SoleMaterialDialog, { SOLE_MATERIAL_SLUGS } from "@/components/cobbli/SoleMaterialDialog";
import ComingSoonVoteButton from "@/components/cobbli/ComingSoonVoteButton";
import { PREMIUM_BRANDS, type QAOption } from "@/types/service";
import { useService } from "@/hooks/useServices";
import { useRepairFlow } from "@/context/RepairFlowContext";

type Mode = "flow" | "standalone";

const formatPrice = (n: number | undefined) => (n === undefined ? "—" : `$${n}`);

/**
 * Per-item service config. `unitLabel` becomes the first pricing-table column header
 * (e.g. "Per buckle"). When `quantityNoun` is set, a quantity stepper + live total appears.
 */
const PER_ITEM_CONFIG: Record<string, { unitLabel: string; quantityNoun?: string }> = {
"buckle-repair": { unitLabel: "Per buckle", quantityNoun: "buckles" },
"buckle-replacement": { unitLabel: "Per pair" },
"strap-repair": { unitLabel: "Per strap", quantityNoun: "straps" },
"strap-replacement": { unitLabel: "Per strap", quantityNoun: "straps" },
"hardware-repair": { unitLabel: "Per piece", quantityNoun: "pieces" },
"hardware-replacement": { unitLabel: "Per piece", quantityNoun: "pieces" },
"zipper-reattachment": { unitLabel: "Per shoe" },
"zipper-replacement": { unitLabel: "Per shoe" },
"zipper-slider-replacement": { unitLabel: "Per shoe" },
"full-resole": { unitLabel: "Sole material" },
};

const ServiceDetail = ({ mode }: { mode: Mode }) => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { service, isLoading } = useService(slug);
  const [qaIndex, setQaIndex] = useState<number | null>(null);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [consentOpen, setConsentOpen] = useState(false);
  const [soleOpen, setSoleOpen] = useState(false);
  const { setPaintConsent, setSoleMaterial } = useRepairFlow();
  const [detailSearchParams] = useSearchParams();

  usePageMeta({
    title: service ? `${service.cardName} — Cobbli` : "Service — Cobbli",
    description: service
      ? `${service.description} Book ${service.cardName.toLowerCase()} with Cobbli's NYC door-to-door shoe repair service. Transparent pricing and fast turnaround.`
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

  // For zipper-slider-replacement (and any future service with variantKey-driven QA),
  // selecting a QA option filters the pricing display to that single variant.
  const isVariantKeyQA = service.slug === "zipper-slider-replacement";
  const selectedOption = qaIndex !== null ? service.qa?.options[qaIndex] : undefined;
  const visibleVariants =
    isVariantKeyQA && selectedOption?.variantKey
      ? service.variants.filter((v) => v.key === selectedOption.variantKey)
      : service.variants;

  const showPremium = visibleVariants.some((v) => v.premium !== undefined && v.premium !== v.standard);
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
            <div
              className="aspect-square rounded-xl flex items-center justify-center text-center px-6 relative"
              style={{
                backgroundColor: "#3d1700",
                color: "#fdb600",
                opacity: service.isComingSoon ? 0.55 : 1,
              }}
            >
              <span className="text-3xl">{service.cardName}</span>
              {service.isComingSoon && (
                <span
                  className="absolute top-3 left-3 text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                >
                  Coming soon
                </span>
              )}
            </div>

            <div>
              <h1 className="font-display text-3xl text-primary">{service.cardName}</h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">{service.description}</p>

              {service.isComingSoon ? (
                <div
                  className="mt-6 rounded-xl border border-border bg-card p-5 shadow-soft"
                >
                  <h2 className="text-base font-medium text-primary">Want to see this added?</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We're considering this service next. Cast a vote to help us prioritize it.
                  </p>
                  <div className="mt-4">
                    <ComingSoonVoteButton serviceId={service.id} />
                  </div>
                </div>
              ) : null}

              {!service.isComingSoon && service.slug !== "zipper-slider-replacement" && (
                <>
                  <div className="my-6 border-t border-border" />

              {(() => {
                const perItem = PER_ITEM_CONFIG[service.slug];
                const showQuantity = !!perItem?.quantityNoun;
                const firstColLabel = perItem?.unitLabel ?? (visibleVariants.length > 1 ? "Type" : "");
                const singleVariant = visibleVariants[0];
                const totalStandard = singleVariant ? singleVariant.standard * quantity : 0;
                const totalPremium = singleVariant?.premium !== undefined ? singleVariant.premium * quantity : undefined;
                const showFirstCol = service.variants.length > 1;

                return (
                  <>
                    {showQuantity && (
                      <>
                        <div>
                          <p className="text-sm font-medium text-primary">
                            How many {perItem!.quantityNoun} need repair?
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Priced per {perItem!.quantityNoun!.replace(/s$/, "")} — only pay for what needs fixing
                          </p>
                          <div className="mt-3 inline-flex items-center rounded-lg border border-border">
                            <button
                              type="button"
                              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                              disabled={quantity <= 1}
                              aria-label="Decrease quantity"
                              className="p-2 text-primary disabled:opacity-40"
                            >
                              <Minus size={16} />
                            </button>
                            <span className="w-10 text-center text-sm font-medium text-primary tabular-nums">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                              disabled={quantity >= 10}
                              aria-label="Increase quantity"
                              className="p-2 text-primary disabled:opacity-40"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="my-6 border-t border-border" />
                      </>
                    )}

                    {/* Pricing */}
                    <div>
                      {!showPremium && !perItem && visibleVariants.length === 1 && singleVariant ? (
                        <div>
                          <span className="text-primary" style={{ fontSize: "22px" }}>
                            {formatPrice(singleVariant.standard)}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">per pair</span>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border overflow-hidden">
                          <div
                            className="grid items-center gap-4 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40"
                            style={{ gridTemplateColumns: showPremium ? (showFirstCol ? "1fr 1fr 1fr" : "1fr 1fr") : (showFirstCol ? "1fr 1fr" : "1fr") }}
                          >
                            {showFirstCol && <span className="text-left">{firstColLabel}</span>}
                            <span className="text-left">Standard shoes</span>
                            {showPremium && <span className="text-left">Shoes that need extra care</span>}
                          </div>
                          <ul className="divide-y divide-border">
                            {visibleVariants.map((v) => (
                              <li
                                key={v.key}
                                className="grid items-center gap-4 px-4 py-3 text-sm"
                                style={{ gridTemplateColumns: showPremium ? (showFirstCol ? "1fr 1fr 1fr" : "1fr 1fr") : (showFirstCol ? "1fr 1fr" : "1fr") }}
                              >
                                {showFirstCol && (
                                  <span className="text-left text-primary">
                                    {v.label || (perItem ? "Price" : service.name)}
                                  </span>
                                )}
                                <span className="text-left text-primary">{formatPrice(v.standard)}</span>
                                {showPremium && (
                                  <span className="text-left text-primary">
                                    {v.premium !== undefined ? formatPrice(v.premium) : "—"}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {showQuantity && singleVariant && (
                        <div className="mt-4">
                          <div className="flex items-baseline justify-between rounded-lg bg-muted/40 px-4 py-3">
                            <span className="text-sm font-medium text-primary">Total</span>
                            <span className="text-sm font-medium text-primary tabular-nums">
                              ${totalStandard} standard
                              {totalPremium !== undefined && <> / ${totalPremium} luxury</>}
                            </span>
                          </div>
                        </div>
                      )}


                      {showPremium && (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => setBrandsOpen((o) => !o)}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            Which shoes need extra care?
                            {brandsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          {brandsOpen && (
                            <>
                              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                                {PREMIUM_BRANDS.join(", ")}.
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                                These brands use signature materials, finishes, and techniques, like Louboutin's lacquered red sole, that require specialist handling and sourcing to repair correctly.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
                </>
              )}

              {!service.isComingSoon && service.qa && (
                <>
                  <div className="my-6 border-t border-border" />
                  <div>
                    <p className="text-sm font-medium text-primary">{service.qa.question}</p>
                    {service.qa.hint && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {service.qa.hint.includes("photo assessment") ? (
                          <>
                            {service.qa.hint.split("photo assessment")[0]}
                            <Link to="/start-repair/assessment" className="underline">photo assessment</Link>
                            {service.qa.hint.split("photo assessment")[1]}
                          </>
                        ) : (
                          service.qa.hint
                        )}
                      </p>
                    )}
                    <ul className="mt-3 space-y-2">
                      {service.qa.options.map((opt: QAOption, i) => {
                        const selected = qaIndex === i;
                        return (
                          <li key={i}>
                            <button
                              type="button"
                              onClick={() => setQaIndex(i)}
                              aria-pressed={selected}
                              className={`w-full flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                                selected
                                  ? "border-transparent text-white"
                                  : "border-border text-primary hover:border-primary/60"
                              }`}
                              style={selected ? { backgroundColor: "#3d1700" } : undefined}
                            >
                              <span className="flex-1 text-left">{opt.label}</span>
                              {opt.priceLabel && (
                                <span className="text-sm font-medium">{opt.priceLabel}</span>
                              )}
                            </button>
                            {selected && opt.note && (
                              <p className="mt-1 text-xs text-muted-foreground px-1">{opt.note}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              )}

              {!service.isComingSoon && (
                <div className="mt-8">
                  <Button
                    type="button"
                    size="lg"
                    onClick={onStart}
                    className="w-full"
                    style={{ backgroundColor: "#3d1700", color: "white" }}
                  >
                    Start a repair
                  </Button>
                </div>
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

export default ServiceDetail;
