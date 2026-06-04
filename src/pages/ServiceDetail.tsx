import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import {
  isEligibleForTier,
  isPriceRange,
  minPrice,
  priceForShoeType,
  PRICE_TIER_LABELS,
  PRICE_TIERS_ORDERED,
} from "@/types/service";
import { useService } from "@/hooks/useServices";
import { usePairs } from "@/context/PairsContext";
import { useRepairFlow } from "@/context/RepairFlowContext";

type Mode = "flow" | "standalone";

const ServiceDetail = ({ mode }: { mode: Mode }) => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { getPair } = usePairs();
  const { selectedPairId, selectedServiceSlugs, addService } = useRepairFlow();

  const { service, isLoading } = useService(slug);

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

  const pair = mode === "flow" && selectedPairId ? getPair(selectedPairId) : undefined;
  if (mode === "flow" && !pair) return <Navigate to="/start-repair" replace />;

  const alreadyAdded = selectedServiceSlugs.includes(service.slug);

  const onAdd = () => {
    if (alreadyAdded) return;
    addService(service.slug);
    navigate("/start-repair/services");
  };

  const onBack = () => {
    navigate(mode === "flow" ? "/start-repair/services" : "/services");
  };

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      {mode === "flow" && <StepIndicator current="select" />}

      <section className="flex-1 py-10 md:py-12">
        <div className="container max-w-4xl">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6"
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div
              className="aspect-square rounded-xl flex items-center justify-center text-center px-6"
              style={{ backgroundColor: "#3d1700", color: "#fdb600" }}
            >
              <span className="font-display text-3xl">{service.name}</span>
            </div>

            <div>
              <h1 className="font-display text-3xl text-primary">{service.name}</h1>
              <p className="mt-3 text-muted-foreground leading-relaxed">{service.description}</p>

              <div className="mt-6">
                {mode === "flow" && pair ? (
                  <p className="text-2xl font-display text-primary">
                    ${priceForShoeType(service, pair.shoeType) === 0
                      ? "XX"
                      : priceForShoeType(service, pair.shoeType)}
                  </p>
                ) : isPriceRange(service) ? (
                  <div>
                    <p className="text-sm font-medium text-primary mb-2">Pricing by shoe type</p>
                    <ul className="rounded-lg border border-border divide-y divide-border">
                      {PRICE_TIERS_ORDERED.filter((t) => isEligibleForTier(service, t)).map((t) => (
                        <li key={t} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-primary">{PRICE_TIER_LABELS[t]}</span>
                          <span className="text-muted-foreground">
                            ${service.pricing[t] === 0 ? "XX" : service.pricing[t]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-2xl font-display text-primary">
                    ${minPrice(service) === 0 ? "XX" : minPrice(service)}
                  </p>
                )}
              </div>

              {mode === "flow" && (
                <div className="mt-8">
                  <Button
                    type="button"
                    size="lg"
                    disabled={alreadyAdded}
                    onClick={onAdd}
                    className={alreadyAdded ? "opacity-50 cursor-not-allowed" : ""}
                  >
                    {alreadyAdded ? "Already added" : "Add to repair"}
                  </Button>
                </div>
              )}

              {mode === "standalone" && (
                <div className="mt-8">
                  <Link to="/start-repair">
                    <Button size="lg">Start a repair</Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default ServiceDetail;
