import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** Slugs that require a sole-material selection before being added to a repair.
 *  Full Resole is now a flat price regardless of sole material — the set is intentionally empty. */
export const SOLE_MATERIAL_SLUGS = new Set<string>();

export type SoleMaterial = "Leather" | "Rubber";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (material: SoleMaterial) => void;
  confirmLabel?: string;
};

const OPTIONS: SoleMaterial[] = ["Leather", "Rubber"];

const SoleMaterialDialog = ({
  open,
  onOpenChange,
  onConfirm,
  confirmLabel = "Add to repair",
}: Props) => {
  const [material, setMaterial] = useState<SoleMaterial | undefined>(undefined);

  useEffect(() => {
    if (open) setMaterial(undefined);
  }, [open]);

  const handleConfirm = () => {
    if (!material) return;
    onConfirm(material);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">What is your sole made of?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Not sure? Try our{" "}
          <Link to="/start-repair/assessment" className="underline">
            photo assessment
          </Link>{" "}
          — we'll identify the right material from your photos.
        </p>

        <div className="mt-2 grid grid-cols-2 gap-3">
          {OPTIONS.map((opt) => {
            const isSelected = material === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setMaterial(opt)}
                aria-pressed={isSelected}
                className={`w-full rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                  isSelected
                    ? "text-white border-transparent"
                    : "text-primary border-border hover:bg-muted/40"
                }`}
                style={isSelected ? { backgroundColor: "#3d1700" } : undefined}
              >
                {opt}
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
            disabled={!material}
            className={!material ? "opacity-50 cursor-not-allowed" : ""}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SoleMaterialDialog;
