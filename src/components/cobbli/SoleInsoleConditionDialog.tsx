import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type SoleInsoleAction = "glue" | "replace";

/** Checklist condition labels that need a follow-up on whether the sole/insole
 *  itself is salvageable (glue) or needs replacing — the recommended service
 *  differs by answer (gluing vs. full-resole / insole-replacement), so this
 *  has to be resolved before recommendations are computed, not after
 *  (2026-07-28, Danielle's call). Only the question(s) matching a condition
 *  the customer actually checked are shown — never both by default. */
export const SOLE_CONDITION_LABEL = "Sole separating from shoe";
export const INSOLE_CONDITION_LABEL = "Loose or detached insole";

type Answers = { sole?: SoleInsoleAction; insole?: SoleInsoleAction };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether to show the sole question — true only when "Sole separating
   *  from shoe" is checked. */
  showSole: boolean;
  /** Whether to show the insole question — true only when "Loose or
   *  detached insole" is checked. */
  showInsole: boolean;
  onConfirm: (answers: Answers) => void;
  confirmLabel?: string;
  /** Re-seeds the picker with a previous answer instead of blanking it —
   *  needed 2026-09-02 so going "← Back" to this question from a later one
   *  in the follow-up chain (StartRepair.tsx's followUpSteps) doesn't lose
   *  what was already picked here. */
  initialAnswers?: Answers;
  /** Present only when this isn't the first question in the follow-up
   *  chain (2026-09-02, Danielle's ask: "let the user go back when they're
   *  answering the questions"). Omitted entirely (rather than passed as a
   *  no-op) hides the button below. */
  onBack?: () => void;
};

const ActionPicker = ({
  part,
  value,
  onChange,
}: {
  part: "sole" | "insole";
  value: SoleInsoleAction | undefined;
  onChange: (v: SoleInsoleAction) => void;
}) => {
  const label = part === "sole" ? "sole" : "insole";
  const goodSubtext =
    part === "sole"
      ? "Recommended when the sole is in good condition"
      : "Recommended when the insole is in good condition";
  const badSubtext =
    part === "sole"
      ? "Recommended when sole is worn or damaged."
      : "Recommended when insole is worn or damaged.";

  return (
    <div className="mb-6 last:mb-0">
      <p className="text-sm font-medium text-foreground mb-2">
        What would you like us to do with your {label}?
      </p>
      <div className="grid grid-cols-2 gap-2.5">
        {(
          [
            { opt: "glue" as const, title: "Glue it back on", subtext: goodSubtext },
            { opt: "replace" as const, title: "Replace it", subtext: badSubtext },
          ] as const
        ).map(({ opt, title, subtext }) => {
          const isSelected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              aria-pressed={isSelected}
              className={`text-left rounded-md border px-3 py-2.5 transition-colors ${
                isSelected ? "border-2" : "border-border hover:border-primary/60"
              }`}
              style={isSelected ? { borderColor: "#3d1700" } : undefined}
            >
              <span className="block text-sm font-medium text-primary">{title}</span>
              <span className="block mt-1 text-xs text-muted-foreground">{subtext}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const SoleInsoleConditionDialog = ({
  open,
  onOpenChange,
  showSole,
  showInsole,
  onConfirm,
  confirmLabel = "See my recommendations",
  initialAnswers,
  onBack,
}: Props) => {
  const [sole, setSole] = useState<SoleInsoleAction | undefined>(undefined);
  const [insole, setInsole] = useState<SoleInsoleAction | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setSole(initialAnswers?.sole);
      setInsole(initialAnswers?.insole);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ready = (!showSole || !!sole) && (!showInsole || !!insole);

  const handleConfirm = () => {
    if (!ready) return;
    onConfirm({ sole: showSole ? sole : undefined, insole: showInsole ? insole : undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Before we show your recommendations</DialogTitle>
        </DialogHeader>

        {showSole && <ActionPicker part="sole" value={sole} onChange={setSole} />}
        {showInsole && <ActionPicker part="insole" value={insole} onChange={setInsole} />}

        <DialogFooter className="gap-2 sm:gap-2 sm:justify-between">
          {/* Back (2026-09-02, Danielle's ask) — only rendered when this
              isn't the first question in the chain; see onBack above. Kept
              on the opposite side from Cancel/Confirm so it doesn't read as
              a third action in the same group. */}
          {onBack ? (
            <Button type="button" variant="ghost" onClick={onBack} className="sm:mr-auto">
              ← Back
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!ready}
              className={!ready ? "opacity-50 cursor-not-allowed" : ""}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SoleInsoleConditionDialog;
