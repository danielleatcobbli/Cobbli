/**
 * PairFlowDialog — "Describe this pair" → "Anything else for this pair?" →
 * "Added to your bag" / "Add another pair?", as a popup rather than a
 * separate page (Danielle's correction, 2026-07-15 — the earlier build put
 * this on its own route, /start-repair/pick; she wants it as a dialog
 * overlaying wherever the customer already is, same as the old "Added to
 * your bag" confirmation used to work).
 *
 * Mounted once, high up (see App.tsx), and opened via
 * RepairFlowContext.openPairFlow(items) from any of the three entry points:
 * the Starter repair checklist's "Continue", a service's "Add to repair", or
 * a package's "Start a repair" — none of them navigate anywhere anymore;
 * they just hand this dialog the item(s) to add.
 *
 * Dismissal is always safe and never loses anything: the pair and its
 * services are written to the bag the moment "Describe this pair" is
 * confirmed, before "Anything else?" ever appears. Closing the dialog at any
 * later point just stops asking further questions — nothing added is ever
 * rolled back. Before that point (still on the "describe" step), nothing has
 * been committed yet, so there's nothing to lose either.
 *
 * That said, the only way to dismiss is the X in the top-right corner —
 * clicking outside the dialog or pressing Escape is deliberately disabled
 * (Danielle's call, 2026-07-16: clicking out while filling in the "describe"
 * step was losing people's in-progress details, which felt accidental even
 * though nothing was technically lost yet).
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPairLabel, usePairs } from "@/context/PairsContext";
import { useRepairFlow } from "@/context/RepairFlowContext";
import { useBag } from "@/context/BagContext";
import type { ShoeType } from "@/types/service";
import { trackEvent } from "@/lib/analytics";

type PickStep = "describe" | "anythingElse" | "addedAndAnother";
// Which half of the "describe" step is showing — picking one of the
// customer's previously-saved pairs, or describing a brand-new one. Restored
// 2026-07-16 (Danielle's call): the popup conversion had dropped the ability
// to reuse a saved pair entirely, and repeat customers still need it.
type DescribeMode = "existing" | "new";

const PairFlowDialog = () => {
  const navigate = useNavigate();
  const { pairs, addPair: addSavedPair, getPair } = usePairs();
  const {
    pairFlowOpen,
    closePairFlow,
    selectedPairId,
    setSelectedPairId,
    pendingRecommendedItems,
    setPendingRecommendedItems,
  } = useRepairFlow();
  const { addPair: addPairToBag } = useBag();

  const [step, setStep] = useState<PickStep>("describe");
  const [mode, setMode] = useState<DescribeMode>("new");
  const [chosenPairId, setChosenPairId] = useState("");
  const [pairDetails, setPairDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [brandConfirmed, setBrandConfirmed] = useState(false);
  const [pairLabel, setPairLabel] = useState("");

  const itemsToAdd = pendingRecommendedItems ?? [];

  // Reset to a clean "describe" step each time the dialog opens fresh — or,
  // if we're continuing an already-described pair (the "yes, add more" loop
  // from "anything else for this pair?"), skip straight to merging the new
  // items and recapping, no need to describe the pair again.
  useEffect(() => {
    if (!pairFlowOpen) return;
    setPairDetails("");
    setNotes("");
    setBrandConfirmed(false);
    setChosenPairId("");
    setMode(pairs.length > 0 ? "existing" : "new");

    const existingPair = selectedPairId ? getPair(selectedPairId) : undefined;
    if (existingPair && itemsToAdd.length > 0) {
      addPairToBag(itemsToAdd, existingPair.id, formatPairLabel(existingPair), existingPair.shoeType);
      trackEvent("repair_added_to_bag", {
        value: itemsToAdd.reduce((sum, s) => sum + s.price, 0) / 100,
        currency: "USD",
        service_count: itemsToAdd.length,
      });
      setPairLabel(formatPairLabel(existingPair));
      setPendingRecommendedItems(null);
      setStep("anythingElse");
    } else {
      setStep("describe");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairFlowOpen]);

  const canContinueDescribe =
    mode === "existing" ? chosenPairId.length > 0 : pairDetails.trim().length > 0 && brandConfirmed;

  const handleDescribeContinue = () => {
    if (!canContinueDescribe) return;

    // Picking a saved pair: it was already described and brand-confirmed
    // when it was first created, so all that's needed here is notes for
    // this particular visit.
    if (mode === "existing") {
      const pair = getPair(chosenPairId);
      if (!pair) return;
      setSelectedPairId(pair.id);
      addPairToBag(itemsToAdd, pair.id, formatPairLabel(pair), pair.shoeType, notes.trim() || undefined);
      trackEvent("pair_confirmed", { shoe_type: pair.shoeType, source: "existing_pair" });
      trackEvent("repair_added_to_bag", {
        value: itemsToAdd.reduce((sum, s) => sum + s.price, 0) / 100,
        currency: "USD",
        service_count: itemsToAdd.length,
      });
      setPendingRecommendedItems(null);
      setPairLabel(formatPairLabel(pair));
      setStep("anythingElse");
      return;
    }

    const pair = addSavedPair({
      // No shoe-type/color/brand form anymore (Danielle's call) — pricing no
      // longer depends on them, so "Unspecified"/empty here is a safe,
      // inert default rather than forcing a choice that doesn't matter.
      shoeType: "Unspecified" as ShoeType,
      colors: [],
      brand: undefined,
      description: pairDetails.trim(),
    });
    setSelectedPairId(pair.id);
    addPairToBag(itemsToAdd, pair.id, formatPairLabel(pair), pair.shoeType, notes.trim() || undefined);
    trackEvent("pair_confirmed", { shoe_type: pair.shoeType, source: "new_pair" });
    trackEvent("repair_added_to_bag", {
      value: itemsToAdd.reduce((sum, s) => sum + s.price, 0) / 100,
      currency: "USD",
      service_count: itemsToAdd.length,
    });
    setPendingRecommendedItems(null);
    setPairLabel(formatPairLabel(pair));
    setStep("anythingElse");
  };

  const handleAddMoreServices = () => {
    closePairFlow();
    navigate("/start-repair");
  };

  const handleAddAnotherPair = () => {
    setSelectedPairId(null);
    setPendingRecommendedItems(null);
    closePairFlow();
    navigate("/start-repair");
  };

  const handleGoToCheckout = () => {
    setSelectedPairId(null);
    setPendingRecommendedItems(null);
    closePairFlow();
    navigate("/checkout");
  };

  return (
    <Dialog open={pairFlowOpen} onOpenChange={(open) => { if (!open) closePairFlow(); }}>
      <DialogContent
        className="max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {step === "describe" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Describe this pair</DialogTitle>
            </DialogHeader>

            {pairs.length > 0 && (
              <div className="flex rounded-lg border border-border p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    mode === "existing" ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`}
                  style={mode === "existing" ? { backgroundColor: "#f5f0e8" } : undefined}
                >
                  Pick a pair
                </button>
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                    mode === "new" ? "text-primary" : "text-muted-foreground hover:text-primary"
                  }`}
                  style={mode === "new" ? { backgroundColor: "#f5f0e8" } : undefined}
                >
                  Add a new pair
                </button>
              </div>
            )}

            {mode === "existing" ? (
              <div className="space-y-2">
                <Label htmlFor="pair-select">
                  Which pair? <span className="text-destructive">*</span>
                </Label>
                <Select value={chosenPairId} onValueChange={setChosenPairId}>
                  <SelectTrigger id="pair-select">
                    <SelectValue placeholder="Select a pair" />
                  </SelectTrigger>
                  <SelectContent>
                    {pairs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {formatPairLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pair-details">
                  Pair details <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="pair-details"
                  value={pairDetails}
                  onChange={(e) => setPairDetails(e.target.value)}
                  placeholder="e.g. Black leather boots"
                />
                <p className="text-[13px] text-muted-foreground">
                  Color, brand, or other details to help us match services if you send in more than one pair.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pair-notes">Notes for this repair</Label>
              <Textarea
                id="pair-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Pay close attention to the back of the shoe where there's some stuffing"
                rows={3}
              />
            </div>

            {mode === "new" && (
              <label
                htmlFor="brand-confirm"
                className="flex items-start gap-2 text-sm text-primary/90 cursor-pointer border-t border-border pt-4"
              >
                <Checkbox
                  id="brand-confirm"
                  checked={brandConfirmed}
                  onCheckedChange={(v) => setBrandConfirmed(!!v)}
                  className="mt-0.5"
                />
                <span>
                  I confirm this pair isn't a Christian Louboutin, Maison Margiela, or Golden Goose. We don't
                  support these brands yet. Check back in the future.
                </span>
              </label>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                type="button"
                size="lg"
                onClick={handleDescribeContinue}
                disabled={!canContinueDescribe}
                className={!canContinueDescribe ? "w-full opacity-50 cursor-not-allowed" : "w-full"}
              >
                Continue
              </Button>
              {!canContinueDescribe && (
                <p className="text-xs text-muted-foreground text-center">
                  {mode === "existing"
                    ? "Select a pair to continue."
                    : "Fill in the pair details and check the box above to continue."}
                </p>
              )}
            </DialogFooter>
          </>
        ) : step === "anythingElse" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Anything else for this pair?</DialogTitle>
            </DialogHeader>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button type="button" variant="outline" size="lg" onClick={handleAddMoreServices} className="w-full">
                Yes, add more services
              </Button>
              <Button type="button" size="lg" onClick={() => setStep("addedAndAnother")} className="w-full">
                No, add pair to bag
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Added to your bag</DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-3">
              <span
                className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#fdb600" }}
              >
                <Check size={16} style={{ color: "#3d1700" }} />
              </span>
              <p className="text-sm text-muted-foreground">{pairLabel}</p>
            </div>

            <p className="text-base font-medium text-primary border-t border-border pt-4">
              Add another pair to this order?
            </p>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button type="button" variant="outline" size="lg" onClick={handleAddAnotherPair} className="w-full">
                Yes, add another pair
              </Button>
              <Button type="button" size="lg" onClick={handleGoToCheckout} className="w-full">
                No, go to checkout
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PairFlowDialog;
