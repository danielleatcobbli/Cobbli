import { useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PaintConsentDialog, { PAINT_CONSENT_SLUGS } from "@/components/cobbli/PaintConsentDialog";
import SoleMaterialDialog, { SOLE_MATERIAL_SLUGS } from "@/components/cobbli/SoleMaterialDialog";
import {
  CATEGORIES_ORDERED,
  fullResolePrice,
  isEligibleForShoeType,
  PREMIUM_BRANDS,
  priceForShoeType,
  type Service,
  type ShoeType,
} from "@/types/service";

const isPremiumBrand = (brand?: string | null) =>
  !!brand && (PREMIUM_BRANDS as readonly string[]).some((b) => b.toLowerCase() === brand.toLowerCase());

/** Card price label. Dynamically narrows based on what's known about the pair:
 *  - sole material known → exact price
 *  - care tier known, material unknown → tier range
 *  - neither → full range (handled upstream by the DB cardPriceLabel) */
const cardPriceLabel = (
  s: Service,
  shoeType: ShoeType,
  premium: boolean,
  material?: "Leather" | "Rubber",
): string => {
  if (s.slug === "full-resole" && s.variants.length > 0) {
    if (material) {
      const exact = fullResolePrice(s, premium, material);
      if (exact !== null) return `$${exact}`;
    }
    const prices = s.variants
      .map((v) => (premium && v.premium !== undefined ? v.premium : v.standard))
      .filter((n) => typeof n === "number");
    if (prices.length > 0) {
      const lo = Math.min(...prices);
      const hi = Math.max(...prices);
      return lo === hi ? `$${lo}` : `$${lo}–$${hi}`;
    }
  }
  const price = priceForShoeType(s, shoeType) ?? 0;
  return `$${price === 0 ? "XX" : price}`;
};
import { useServices } from "@/hooks/useServices";
import ComingSoonSection from "@/components/cobbli/ComingSoonSection";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { formatPairLabel, usePairs } from "@/context/PairsContext";
import { useRepairFlow } from "@/context/RepairFlowContext";
import { useBag, type BagService } from "@/context/BagContext";

const ALL = "All services" as const;
const sidebarCategories = [ALL, ...CATEGORIES_ORDERED];

const ServiceCard = ({
  s,
  shoeType,
  premium,
  material,
  selected,
  onAdd,
}: {
  s: Service;
  shoeType: ShoeType;
  premium: boolean;
  material?: "Leather" | "Rubber";
  selected: boolean;
  onAdd: () => void;
}) => {
  const priceLabel = cardPriceLabel(s, shoeType, premium, material);
  const title = s.cardName || s.name;

  return (
    <div
      className={`rounded-xl overflow-hidden border bg-card shadow-soft flex flex-col transition-all ${
        selected ? "border-status-orange ring-2 ring-status-orange/30" : "border-border"
      }`}
    >
      <Link to={`/start-repair/services/${s.slug}`} className="block">
        <div
          className="aspect-[4/3] flex items-center justify-center text-center px-4"
          style={{ backgroundColor: "#3d1700", color: "#fdb600" }}
        >
          <span className="text-xl">{title}</span>
        </div>
      </Link>
      <div className="p-5 flex flex-col gap-1 flex-1">
        <Link to={`/start-repair/services/${s.slug}`} className="hover:underline">
          <h3 className="text-[15px] leading-snug text-primary">{title}</h3>
        </Link>
        <p className="text-sm text-muted-foreground">{s.description}</p>
        <p className="mt-2 font-sans font-medium text-[13px] text-primary">{priceLabel}</p>

        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            disabled={selected}
            onClick={onAdd}
            className={selected ? "opacity-50 cursor-not-allowed" : ""}
          >
            {selected ? "Added" : "Add to repair"}
          </Button>
        </div>
      </div>
    </div>
  );
};

const SelectServices = () => {
  const navigate = useNavigate();
  const { getPair } = usePairs();
  const {
    selectedPairId,
    selectedServiceSlugs,
    activeCategory,
    paintConsents,
    soleMaterials,
    setActiveCategory,
    addService,
    removeService,
    setPaintConsent,
    setSoleMaterial,
    reset,
  } = useRepairFlow();
  const { addPair: addPairToBag } = useBag();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [consentSlug, setConsentSlug] = useState<string | null>(null);
  const [soleSlug, setSoleSlug] = useState<string | null>(null);

  usePageMeta({
    title: "Select services — Cobbli",
    description:
"Choose the repairs your shoes need from Cobbli's catalog of sole, heel, zipper, strap, cleaning and preventative care services. Transparent pricing.",
  });

  const { data: services, isLoading } = useServices();
  const allServices = services ?? [];

  const pair = selectedPairId ? getPair(selectedPairId) : undefined;
  if (!pair) return <Navigate to="/start-repair" replace />;

  const eligible = useMemo(
    () => allServices.filter((s) => !s.isComingSoon && isEligibleForShoeType(s, pair.shoeType)),
    [allServices, pair.shoeType],
  );

  const visible = useMemo(() => {
    const list =
      activeCategory === ALL
        ? eligible
        : eligible.filter((s) => s.categories.includes(activeCategory as Service["categories"][number]));
    return [...list].sort((a, b) => a.rank - b.rank);
  }, [eligible, activeCategory]);

  const comingSoon = useMemo(() => {
    const list = allServices.filter((s) => s.isComingSoon);
    const byCat =
      activeCategory === ALL
        ? list
        : list.filter((s) => s.categories.includes(activeCategory as Service["categories"][number]));
    return [...byCat].sort((a, b) => a.rank - b.rank);
  }, [allServices, activeCategory]);

  const serviceIdBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of allServices) map[s.slug] = s.id;
    return map;
  }, [allServices]);

  const selectedServices = allServices.filter((s) => selectedServiceSlugs.includes(s.slug));
  const canCheckout = selectedServiceSlugs.length > 0;

  const handleCardAdd = (slug: string) => {
    if (PAINT_CONSENT_SLUGS.has(slug) && !paintConsents[slug]) {
      setConsentSlug(slug);
      return;
    }
    if (SOLE_MATERIAL_SLUGS.has(slug) && !soleMaterials[slug]) {
      setSoleSlug(slug);
      return;
    }
    addService(slug);
  };

  const onAddRepairToBag = () => {
    if (!canCheckout) return;
    const premium = isPremiumBrand(pair.brand);
    const bagServices: BagService[] = selectedServices.map((s) => {
      const material = soleMaterials[s.slug];
      const exactResole =
        s.slug === "full-resole" && material ? fullResolePrice(s, premium, material) : null;
      const dollars = exactResole ?? priceForShoeType(s, pair.shoeType) ?? 0;
      return {
        id: s.slug,
        name: s.name,
        price: dollars * 100,
        premium,
        ...(PAINT_CONSENT_SLUGS.has(s.slug) && paintConsents[s.slug]
          ? { paintConsent: paintConsents[s.slug] }
          : {}),
        ...(SOLE_MATERIAL_SLUGS.has(s.slug) && material ? { soleMaterial: material } : {}),
      };
    });
    addPairToBag(bagServices, pair.id, formatPairLabel(pair), pair.shoeType);
    setConfirmOpen(true);
  };

  const handleCheckout = () => {
    setConfirmOpen(false);
    reset();
    navigate("/bag");
  };

  const handleAddAnother = () => {
    setConfirmOpen(false);
    reset();
    navigate("/start-repair");
  };

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <StepIndicator current="select" />

      <section className="flex-1 py-10 md:py-12">
        <div className="container">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl md:text-3xl text-primary">What can we help with?</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-primary">Selected services:</span>
                {selectedServices.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None yet</span>
                ) : (
                  selectedServices.map((s) => (
                    <span
                      key={s.slug}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                      style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                    >
                      {s.cardName || s.name}
                      <button
                        type="button"
                        aria-label={`Remove ${s.cardName || s.name}`}
                        onClick={() => removeService(s.slug)}
                        className="hover:opacity-70"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
            <Button
              type="button"
              size="lg"
              disabled={!canCheckout}
              onClick={onAddRepairToBag}
              className={!canCheckout ? "opacity-50 cursor-not-allowed" : ""}
            >
              Add repair to bag
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">
            <aside>
              <nav aria-label="Service categories" className="flex md:flex-col gap-2 md:gap-1 overflow-x-auto">
                {sidebarCategories.map((c) => {
                  const active = activeCategory === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setActiveCategory(c)}
                      className={`text-left px-1 py-2 text-sm whitespace-nowrap transition-colors ${
                        active
                          ? "text-primary font-medium underline underline-offset-4 decoration-status-orange decoration-2"
                          : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </nav>
            </aside>

            <div>
              {isLoading ? (
                <BrandSpinner className="py-16" size="lg" />
              ) : (
                <>
                  {visible.length === 0 ? (
                    <p className="text-muted-foreground">No services available in this category for the selected pair.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                      {visible.map((s) => (
                        <ServiceCard
                          key={s.slug}
                          s={s}
                          shoeType={pair.shoeType}
                          premium={isPremiumBrand(pair.brand)}
                          material={soleMaterials[s.slug]}
                          selected={selectedServiceSlugs.includes(s.slug)}
                          onAdd={() => handleCardAdd(s.slug)}
                        />
                      ))}
                    </div>
                  )}

                  <ComingSoonSection
                    services={comingSoon}
                    serviceIdBySlug={serviceIdBySlug}
                    disableLinks
                  />
                </>
              )}

              <p className="mt-8 text-sm text-muted-foreground">
                Not sure what your shoes need?{" "}
                <Link to="/start-repair/assessment" className="underline text-primary">
                  Get a personalized recommendation <span aria-hidden>→</span>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Repair added to bag</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {selectedServices.length} service{selectedServices.length === 1 ? "" : "s"} added for your{" "}
            {pair.shoeType.toLowerCase()}.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleAddAnother}>
              Add another repair
            </Button>
            <Button onClick={handleCheckout}>Checkout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaintConsentDialog
        open={consentSlug !== null}
        onOpenChange={(o) => {
          if (!o) setConsentSlug(null);
        }}
        onConfirm={(consent) => {
          if (!consentSlug) return;
          setPaintConsent(consentSlug, consent);
          addService(consentSlug);
          setConsentSlug(null);
        }}
      />

      <SoleMaterialDialog
        open={soleSlug !== null}
        onOpenChange={(o) => {
          if (!o) setSoleSlug(null);
        }}
        onConfirm={(material) => {
          if (!soleSlug) return;
          setSoleMaterial(soleSlug, material);
          addService(soleSlug);
          setSoleSlug(null);
        }}
      />
    </main>
  );
};

export default SelectServices;
