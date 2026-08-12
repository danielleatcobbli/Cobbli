import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera } from "lucide-react";

/**
 * "Worn or damaged sole" follow-up (2026-08-11, Danielle's call) — full-resole
 * used to be one flat price for everyone; now it's priced by specialty brand
 * (fixed price, no sole question needed) or by sole type (leather costs a bit
 * more than rubber; a lug/chunky-tread sole is priced the same as rubber).
 * Some brands and cup soles aren't supported yet, so this doubles as the
 * eligibility gate — see computeResoleOutcome below for what each pick means
 * for the recommendation screen.
 *
 * Two steps in one dialog, brand first (2026-08-11, Danielle's call — she
 * tried a shoe-type-first version and a sole-photo-only version before
 * landing here): most of the ambiguity is only in the small set of brands
 * with their own pricing, so checking that first means most customers with a
 * standard brand skip straight to a plain sole-photo match instead of
 * answering two questions.
 */

/** The checklist condition label this dialog is gated on — kept here next to
 *  the dialog it triggers, same pattern as SOLE_CONDITION_LABEL /
 *  INSOLE_CONDITION_LABEL in SoleInsoleConditionDialog.tsx. */
export const RESOLE_CONDITION_LABEL = "Worn or damaged sole";

export type ResoleBrandOption = {
  /** Shown on the chip. */
  label: string;
  /** How this brand is recorded in Supabase (services.excluded_brands and
   *  bag/order snapshots) — not always identical to the display label, e.g.
   *  "Christian Louboutin" displays in full but is stored as "Louboutin" to
   *  match the existing catalog value. */
  matchKey: string;
  /** full-resole's variant_key for this brand's fixed price. Undefined for
   *  brands that are always blocked regardless of excludedBrands (kept
   *  separate so a brand can be "shown, but not priced yet" without needing
   *  a Supabase change). */
  variantKey?: string;
};

/** The four specialty brands shown at launch (2026-08-11). Birkenstock and
 *  Golden Goose are priced by brand; Christian Louboutin and Maison Margiela
 *  are shown but blocked — Cobbli doesn't have the right sole source for
 *  either yet. Kept as a small fixed list rather than pulled from the
 *  catalog since these are the only brands with their own resole pricing at
 *  all; everything else goes through the sole-type picker below. */
export const RESOLE_BRAND_OPTIONS: ResoleBrandOption[] = [
  { label: "Birkenstock", matchKey: "Birkenstock", variantKey: "birkenstock" },
  { label: "Golden Goose", matchKey: "Golden Goose", variantKey: "golden-goose" },
  { label: "Christian Louboutin", matchKey: "Louboutin" },
  { label: "Maison Margiela", matchKey: "Maison Margiela" },
];

type SoleOption = {
  key: "leather" | "rubber" | "lug" | "cup";
  label: string;
  desc: string;
  supported: boolean;
  /** full-resole variant_key this maps to for pricing — lug isn't its own
   *  variant, it's priced the same as rubber (Danielle's call), just shown
   *  as its own photo so a customer can actually match what they see. */
  variantKey: "leather" | "rubber" | null;
};

const SOLE_OPTIONS: SoleOption[] = [
  {
    key: "leather",
    label: "Leather sole",
    desc: "Smooth, stitched sole — dress shoes, flats, loafers, sandals",
    supported: true,
    variantKey: "leather",
  },
  {
    key: "rubber",
    label: "Rubber sole",
    desc: "Smooth or lightly grooved rubber — boots, loafers, everyday shoes",
    supported: true,
    variantKey: "rubber",
  },
  {
    key: "lug",
    label: "Lug sole",
    desc: "Thick, deep tread — work boots, hiking boots, some Chelsea boots, chunky loafers",
    supported: true,
    variantKey: "rubber",
  },
  {
    key: "cup",
    label: "Cup sole",
    desc: "One molded piece wrapping up the sides — fashion sneakers",
    supported: false,
    variantKey: null,
  },
];

/** Simple schematic line art for leather/rubber — Danielle doesn't have real
 *  photos for these two yet (she does for lug and cup, see /public/condition-
 *  photos/sole-types). Deliberately generic/illustrative rather than a real
 *  photo standing in for a different sole, which would just be misleading.
 *  Swap for real photos (same treatment as lug/cup below) as soon as she has
 *  them — see SOLE_PHOTO below for the two that already use real images. */
const SoleIcon = ({ variant }: { variant: "leather" | "rubber" }) => (
  <svg width="48" height="34" viewBox="0 0 48 34" aria-hidden="true" className="shrink-0">
    <path
      d="M5,13 Q5,30 24,30 Q43,30 43,13 Z"
      fill="none"
      stroke="#7a5c40"
      strokeWidth="1.8"
    />
    {variant === "leather" ? (
      <path d="M9,14 Q9,26 24,26 Q39,26 39,14" fill="none" stroke="#7a5c40" strokeWidth="1" strokeDasharray="2 2" />
    ) : (
      <>
        <line x1="12" y1="17" x2="12" y2="26" stroke="#7a5c40" strokeWidth="1" />
        <line x1="18" y1="15" x2="18" y2="28" stroke="#7a5c40" strokeWidth="1" />
        <line x1="24" y1="14" x2="24" y2="29" stroke="#7a5c40" strokeWidth="1" />
        <line x1="30" y1="15" x2="30" y2="28" stroke="#7a5c40" strokeWidth="1" />
        <line x1="36" y1="17" x2="36" y2="26" stroke="#7a5c40" strokeWidth="1" />
      </>
    )}
  </svg>
);

/** Real photos, dropped into public/condition-photos/sole-types by Danielle
 *  (2026-08-11) — only these two exist so far. */
const SOLE_PHOTO: Partial<Record<SoleOption["key"], string>> = {
  lug: "/condition-photos/sole-types/lug-sole.png",
  cup: "/condition-photos/sole-types/cup-sole.png",
};

export type SoleSelectionResult =
  | { kind: "brand"; label: string; variantKey: string }
  | { kind: "material"; label: string; variantKey: "leather" | "rubber" }
  | { kind: "blocked"; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** full-resole's live excludedBrands, so a brand chip that's been
   *  re-enabled in Supabase (excluded_brands updated) reflects that here
   *  without a code change. */
  excludedBrands: string[];
  onConfirm: (result: SoleSelectionResult) => void;
};

const SoleSelectionDialog = ({ open, onOpenChange, excludedBrands, onConfirm }: Props) => {
  const [step, setStep] = useState<"brand" | "sole">("brand");

  useEffect(() => {
    if (open) setStep("brand");
  }, [open]);

  const resolve = (result: SoleSelectionResult) => {
    onConfirm(result);
    onOpenChange(false);
  };

  const pickBrand = (opt: ResoleBrandOption) => {
    const blocked = !opt.variantKey || excludedBrands.includes(opt.matchKey);
    if (blocked) {
      resolve({ kind: "blocked", label: opt.label });
    } else {
      resolve({ kind: "brand", label: opt.label, variantKey: opt.variantKey! });
    }
  };

  const pickSole = (opt: SoleOption) => {
    if (!opt.supported || !opt.variantKey) {
      resolve({ kind: "blocked", label: opt.label });
    } else {
      resolve({ kind: "material", label: opt.label, variantKey: opt.variantKey });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {step === "brand" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">Which brand is this pair?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2">
              These brands have their own resole pricing — pick one if it matches, or skip ahead.
            </p>
            <div className="grid grid-cols-2 gap-2.5 mt-2">
              {RESOLE_BRAND_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => pickBrand(opt)}
                  className="rounded-md border border-border px-3 py-2.5 text-sm font-medium text-primary text-left hover:border-primary/60 transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep("sole")}
              className="w-full mt-1 rounded-md px-3 py-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: "#3d1700" }}
            >
              None of these
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep("brand")}
              className="text-xs text-muted-foreground hover:text-primary -mt-1 mb-1 self-start"
            >
              ← Back
            </button>
            <DialogHeader>
              <DialogTitle className="text-2xl">Which sole looks closest to yours?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2">
              Match the shape and tread — not sure? Send us a photo instead.
            </p>
            <div className="flex flex-col gap-2 mt-2">
              {SOLE_OPTIONS.map((opt) => {
                const photo = SOLE_PHOTO[opt.key];
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => pickSole(opt)}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-left hover:border-primary/60 transition-colors"
                  >
                    <span className="shrink-0 w-12 h-9 flex items-center justify-center overflow-hidden rounded" style={{ backgroundColor: "#f5f0e8" }}>
                      {photo ? (
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <SoleIcon variant={opt.key === "leather" ? "leather" : "rubber"} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-primary">{opt.label}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{opt.desc}</span>
                    </span>
                    <span
                      className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={
                        opt.supported
                          ? { backgroundColor: "#EAF3DE", color: "#27500A" }
                          : { backgroundColor: "#FCEBEB", color: "#791F1F" }
                      }
                    >
                      {opt.supported ? "Supported" : "Not supported"}
                    </span>
                  </button>
                );
              })}
            </div>
            <Link
              to="/start-repair/assessment"
              className="flex items-center justify-center gap-2 mt-1 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
            >
              <Camera size={16} />
              Not sure — send us a photo
            </Link>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SoleSelectionDialog;
