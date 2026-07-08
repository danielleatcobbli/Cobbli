import { useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { useRepairFlow } from "@/context/RepairFlowContext";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useBag, formatPrice } from "@/context/BagContext";
import { useLivePricedBag } from "@/hooks/useLivePricedBag";
import { useAuth } from "@/context/AuthContext";
import { formatPairLabel, usePairs } from "@/context/PairsContext";
import bagIcon from "@/assets/icons/bag.svg";

const FREE_COURIER_THRESHOLD = 10000; // $100 in cents
const COURIER_FEE = 1500; // $15 in cents

const Bag = () => {
  const navigate = useNavigate();
  const { pairs: rawPairs, removePair, removeService } = useBag();
  const { pairs, subtotal } = useLivePricedBag(rawPairs);
  const { getPair } = usePairs();
  const { setSelectedPairId, setSelectedServiceSlugs, setActiveCategory } = useRepairFlow();

  const handleEditRepair = (pairId: string | undefined, serviceSlugs: string[]) => {
    if (!pairId) return;
    setSelectedPairId(pairId);
    setSelectedServiceSlugs(serviceSlugs);
    setActiveCategory("All services");
    navigate("/start-repair/services");
  };
  const isEmpty = pairs.length === 0;

  usePageMeta({
    title: "Shopping bag — Cobbli",
    description:
"Review the shoe repairs in your Cobbli bag, see your order summary and check out for door-to-door pickup and return across NYC.",
  });

  // Most-recently-added pair first
  const orderedPairs = useMemo(
    () => [...pairs].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1)),
    [pairs],
  );

  const repairsTotal = subtotal;
  const courierFee = repairsTotal >= FREE_COURIER_THRESHOLD ? 0 : COURIER_FEE;
  const orderSubtotal = repairsTotal + courierFee;

  const { user } = useAuth();
  const [showAuthGate, setShowAuthGate] = useState(false);

  const handleCheckout = () => {
    if (user) {
      navigate("/checkout");
    } else {
      setShowAuthGate(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container py-10">
          <h1 className="text-3xl md:text-4xl font-semibold mb-8">Shopping bag</h1>

          {isEmpty ? (
            <EmptyBag />
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              {/* Pairs */}
              <ul className="space-y-6">
                {orderedPairs.map((pair) => {
                  const pairTotal = pair.services.reduce((s, svc) => s + svc.price, 0);
                  const savedPair = pair.pairId ? getPair(pair.pairId) : undefined;
                  const pairLabel = pair.label ?? (savedPair ? formatPairLabel(savedPair) : "Unnamed pair");
                  return (
                    <li
                      key={pair.id}
                      className="rounded-lg border border-border bg-card p-6 shadow-soft"
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h2 className="text-lg font-semibold">{pairLabel}</h2>
                        <div className="flex items-center gap-4">
                          {pair.pairId && (
                            <button
                              type="button"
                              onClick={() =>
                                handleEditRepair(
                                  pair.pairId,
                                  pair.services.map((s) => s.id),
                                )
                              }
                              className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 transition-colors"
                              aria-label={`Edit repair for ${pairLabel}`}
                            >
                              <Pencil size={14} /> Edit repair
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removePair(pair.id)}
                            className="text-sm text-muted-foreground hover:text-destructive inline-flex items-center gap-1.5 transition-colors"
                            aria-label={`Remove ${pairLabel}`}
                          >
                            <Trash2 size={14} /> Remove pair
                          </button>
                        </div>
                      </div>


                      <ul className="divide-y divide-border border-y border-border">
                        {pair.services.map((svc) => (
                          <li key={svc.id} className="py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => removeService(pair.id, svc.id)}
                                aria-label={`Remove ${svc.name}`}
                                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                              >
                                <Trash2 size={14} />
                              </button>
                              <span className="truncate">{svc.name}</span>
                            </div>
                            <span className="font-medium whitespace-nowrap">{formatPrice(svc.price)}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="pt-4 flex justify-between text-sm font-semibold">
                        <span>Pair total</span>
                        <span>{formatPrice(pairTotal)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Order summary */}
              <aside className="lg:sticky lg:top-32 h-fit">
                <div className="rounded-lg border border-border bg-card p-6 shadow-soft">
                  <h2 className="text-lg font-semibold mb-4">Order summary</h2>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Repairs</dt>
                      <dd>{formatPrice(repairsTotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Delivery &amp; Pickup Service</dt>
                      <dd>{courierFee === 0 ? "Free" : formatPrice(courierFee)}</dd>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between font-semibold text-base">
                      <dt>Subtotal</dt>
                      <dd>{formatPrice(orderSubtotal)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Free courier service on orders over $100
                  </p>
                  <Button
                    type="button"
                    variant="hero"
                    size="lg"
                    className="w-full mt-6"
                    onClick={handleCheckout}
                  >
                    Checkout
                  </Button>
                  <p className="mt-3 text-xs text-muted-foreground text-center">
                    No NY sales tax on repair services.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      <Dialog open={showAuthGate} onOpenChange={setShowAuthGate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Almost there</DialogTitle>
            <DialogDescription>
              Sign in or create an account to complete your repair.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex flex-col gap-2">
            <Button
              variant="hero"
              size="lg"
              onClick={() => navigate("/signin", { state: { from: "/checkout" } })}
            >
              Sign in
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/signup", { state: { from: "/checkout" } })}
            >
              Create an account
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

const EmptyBag = () => (
  <div className="rounded-lg border border-border bg-card py-16 px-6 flex flex-col items-center text-center shadow-soft">
    <div
      className="h-24 w-24 rounded-full flex items-center justify-center mb-6"
      style={{ backgroundColor: "#3d1700" }}
      aria-hidden
    >
      <img
        src={bagIcon}
        alt=""
        className="h-10 w-10"
        style={{ filter: "brightness(0) invert(1)" }}
      />
    </div>
    <h2 className="text-xl font-semibold mb-2">Your bag is empty</h2>
    <p className="text-muted-foreground mb-6 max-w-sm">
      You haven't added any repairs yet. Start a repair to get your shoes looking their best.
    </p>
    <Button asChild variant="hero" size="lg">
      <Link to="/services">Start a repair</Link>
    </Button>
  </div>
);

export default Bag;
