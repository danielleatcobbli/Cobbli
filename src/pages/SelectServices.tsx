import { useEffect, useMemo, useState } from "react";
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
import {
  CATEGORIES_ORDERED,
  SERVICES,
  isEligibleForShoeType,
  type Service,
} from "@/data/services";
import { usePairs } from "@/context/PairsContext";
import { useRepairFlow } from "@/context/RepairFlowContext";
import { useBag, type BagService } from "@/context/BagContext";

const ALL = "All services" as const;
const sidebarCategories = [ALL, ...CATEGORIES_ORDERED];

const ServiceCard = ({
  s,
  shoeType,
  selected,
  onAdd,
}: {
  s: Service;
  shoeType: string;
  selected: boolean;
  onAdd: () => void;
}) => {
  const price = s.pricing[shoeType as keyof typeof s.pricing] ?? 0;
  const priceLabel = `$${price === 0 ? "XX" : price}`;
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
          <span className="font-display text-xl">{s.name}</span>
        </div>
      </Link>
      <div className="p-5 flex flex-col gap-1 flex-1">
        <Link to={`/start-repair/services/${s.slug}`} className="hover:underline">
          <h3 className="font-display text-lg text-primary">{s.name}</h3>
        </Link>
        <p className="text-sm text-muted-foreground">{s.description}</p>
        <p className="mt-2 font-medium text-primary">{priceLabel}</p>
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
    setActiveCategory,
    addService,
    removeService,
    reset,
  } = useRepairFlow();
  const { addPair: addPairToBag } = useBag();
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    document.title = "Start a repair — Cobbli";
  }, []);

  const pair = selectedPairId ? getPair(selectedPairId) : undefined;
  if (!pair) return <Navigate to="/start-repair" replace />;

  const eligible = useMemo(
    () => SERVICES.filter((s) => isEligibleForShoeType(s, pair.shoeType)),
    [pair.shoeType],
  );

  const visible = useMemo(() => {
    const list =
      activeCategory === ALL
        ? eligible
        : eligible.filter((s) => s.categories.includes(activeCategory as Service["categories"][number]));
    return [...list].sort((a, b) => a.rank - b.rank);
  }, [eligible, activeCategory]);

  const selectedServices = SERVICES.filter((s) => selectedServiceSlugs.includes(s.slug));
  const canCheckout = selectedServiceSlugs.length > 0;

  const onAddRepairToBag = () => {
    if (!canCheckout) return;
    const bagServices: BagService[] = selectedServices.map((s) => ({
      id: s.slug,
      name: s.name,
      price: (s.pricing[pair.shoeType] ?? 0) * 100,
    }));
    addPairToBag(bagServices);
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
              <h1 className="font-display text-2xl md:text-3xl text-primary">Select services</h1>
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
                      {s.name}
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
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
              {visible.length === 0 ? (
                <p className="text-muted-foreground">No services available in this category for the selected pair.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {visible.map((s) => (
                    <ServiceCard
                      key={s.slug}
                      s={s}
                      shoeType={pair.shoeType}
                      selected={selectedServiceSlugs.includes(s.slug)}
                      onAdd={() => addService(s.slug)}
                    />
                  ))}
                </div>
              )}

              <p className="mt-8 text-sm text-muted-foreground">
                Not sure what to pick?{" "}
                <a href="mailto:support@cobbli.com" className="underline text-primary">
                  Email us photos
                </a>{" "}
                and we'll recommend the right repairs within 1 business day.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Repair added to bag</DialogTitle>
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
    </main>
  );
};

export default SelectServices;
