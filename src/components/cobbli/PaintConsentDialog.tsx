import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Slugs that require paint/dye consent before being added to a repair.
 *  Scuff repair was split out of the old combined "Scuff, stain, & color
 *  restoration" service (2026-07-23, Danielle's call) but keeps the same
 *  consent gate as Color restoration. Stain repair was deactivated
 *  2026-07-27 — Stains now points at Color restoration directly. */
export const PAINT_CONSENT_SLUGS = new Set([
  "faded-or-patchy-color",
  "color-restoration",
  "scuff-repair",
]);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the user's answer when they confirm. */
  onConfirm: (consent: "yes" | "no") => void;
  /** Label for the confirm button. Defaults to "Add to repair". */
  confirmLabel?: string;
};

const PaintConsentDialog = ({
  open,
  onOpenChange,
  onConfirm,
  confirmLabel = "Add to repair",
}: Props) => {
  const [consent, setConsent] = useState<"yes" | "no" | undefined>(undefined);

  // Reset answer whenever the dialog re-opens.
  useEffect(() => {
    if (open) setConsent(undefined);
  }, [open]);

  const handleConfirm = () => {
    if (!consent) return;
    onConfirm(consent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Can we use professional, color-matched dye on your shoes?
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          If your shoe has experienced wear, scratches, or stains, dye is the
          only way to fully restore it. Without it, we can improve the
          appearance, but can't guarantee a complete color match.
        </p>
        <div className="mt-2 flex gap-2">
          {(["yes", "no"] as const).map((opt) => {
            const isSelected = consent === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setConsent(opt)}
                aria-pressed={isSelected}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? "border-transparent text-white"
                    : "border-border text-primary hover:border-primary/60"
                }`}
                style={isSelected ? { backgroundColor: "#3d1700" } : undefined}
              >
                {opt === "yes" ? "Yes" : "No"}
              </button>
            );
          })}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!consent}
            className={!consent ? "opacity-50 cursor-not-allowed" : ""}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PaintConsentDialog;
