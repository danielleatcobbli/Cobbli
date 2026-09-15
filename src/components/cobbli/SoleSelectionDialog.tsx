import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";

/**
 * "Worn or damaged sole" follow-up — now a single sole-type-match step
 * (2026-08-27, Danielle's call). It used to be two steps in one dialog,
 * brand-first-then-sole-type, so specialty brands (Birkenstock priced by
 * brand; Christian Louboutin, Maison Margiela shown but blocked) could be
 * caught before the plain sole-photo match. Danielle dropped the brand step
 * entirely at launch — Cobbli isn't taking on Louboutin, Maison Margiela, or
 * any sneaker yet, and Birkenstock's fixed-price path goes away with it (her
 * call, rather than keeping a one-off brand chip just for Birkenstock). Lug
 * soles are also newly unsupported, same treatment as cup soles. Golden
 * Goose moved from "priced by brand" to fully unsupported 2026-09-01
 * (Danielle's call) — the whole brand, not just its sneakers. What's left is
 * a single big "which sole looks closest to yours" screen, with the brand/
 * sneaker exclusions called out as a plain disclaimer instead of a picker.
 *
 * excludedBrands / RESOLE_BRAND_OPTIONS / ResoleBrandOption and the
 * "brand" SoleSelectionResult kind are intentionally still supported
 * downstream (CartLine.resoleBrand, admin order detail, etc.) even though
 * this dialog can no longer produce one — past orders placed through the
 * old brand step still have that data and still need to render correctly.
 *
 * Brand/sneaker disclaimer removed 2026-09-01 (Danielle's call) — this
 * dialog can now only ever open for a shoe type/brand that's already
 * resole-supported, since the checklist's "Worn or damaged sole" tile
 * (StartRepair.tsx) is disabled upfront for Sneakers/Louboutin/Margiela/
 * Golden Goose via the new "Which pair needs attention?" flag, and its
 * checkbox can't be checked at all in that case — so the dialog behind it
 * is unreachable. The only "not supported" cases left in here are the two
 * sole *types* themselves (Sneaker sole, Lug sole), unrelated to brand,
 * which are now genuinely disabled rather than clickable-then-blocked (see
 * SOLE_OPTIONS' `supported` flag below).
 *
 * Per-option pricing removed 2026-09-02 (Danielle's call, after weighing
 * it out loud) — this is a diagnostic question ("which sole looks like
 * yours"), not a cost/benefit choice the customer should be optimizing,
 * and showing a price next to each option risked nudging someone toward
 * the cheaper-looking answer instead of the accurate one. Pricing still
 * lives on the checklist tile itself and on the final recommendations
 * screen — nothing about cost disappears, it's just not re-litigated
 * mid-diagnosis. resoleService/priceFor (Service/resolePriceForKey import)
 * removed along with it — see git history if this needs to come back.
 */

export const RESOLE_CONDITION_LABEL = "Worn or damaged sole";

type SoleOption = {
  key: "leather" | "rubber" | "lug" | "cup";
  label: string;
  desc: string;
  supported: boolean;
  /** full-resole variant_key this maps to for pricing. */
  variantKey: "leather" | "rubber" | null;
};

// Lug switched to unsupported 2026-08-27 (Danielle's call, alongside
// dropping the brand step) — it used to quietly price the same as rubber;
// now it's "not supported yet," same treatment as cup/sneaker.
//
// Reordered rubber, leather, sneaker, lug (2026-08-27, Danielle's call) —
// was leather, rubber, lug, cup. "cup" renamed "Sneaker sole" in its label
// same day (the `key: "cup"` itself is untouched — SOLE_PHOTO and every
// other internal reference still key off "cup", only the customer-facing
// label changed, same pattern as every other display-name-only rename in
// this codebase). Descriptions also rewritten to Danielle's exact wording.
const SOLE_OPTIONS: SoleOption[] = [
  {
    key: "rubber",
    label: "Rubber sole",
    desc: "Smooth or grooved rubber typically found on everyday dress shoes, loafers, flats, and boots.",
    supported: true,
    variantKey: "rubber",
  },
  {
    key: "leather",
    label: "Leather sole",
    desc: "Smooth, mostly leather sole often found on dress shoes, formal loafers, heels, and some boots.",
    supported: true,
    variantKey: "leather",
  },
  {
    key: "cup",
    label: "Sneaker sole",
    desc: "One molded piece that wraps up the sides of dress or athletic sneakers.",
    supported: false,
    variantKey: null,
  },
  {
    key: "lug",
    label: "Lug sole",
    desc: "Thick, deep tread soles found on hiking, work, combat, utility, and some Chelsea boots. Also used on some chunky loafers.",
    supported: false,
    variantKey: null,
  },
];

/** Real photos, dropped into public/condition-photos/sole-types by Danielle. */
const SOLE_PHOTO: Record<SoleOption["key"], string> = {
  lug: "/condition-photos/sole-types/lug-sole.png",
  cup: "/condition-photos/sole-types/cup-sole.png",
  leather: "/condition-photos/sole-types/leather-sole.png",
  rubber: "/condition-photos/sole-types/rubber-sole.png",
};

export type SoleSelectionResult =
  | { kind: "brand"; label: string; variantKey: string }
  | { kind: "material"; label: string; variantKey: "leather" | "rubber" }
  | { kind: "blocked"; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: SoleSelectionResult) => void;
  /** Present only when this isn't the first question in the follow-up
   *  chain (2026-09-02, Danielle's ask). Omitted entirely (rather than a
   *  no-op) hides the "← Back" link below. */
  onBack?: () => void;
  /** Checklist conditions already checked, carried into the "Not sure?"
   *  link's router state so a customer who bails to the photo flow from
   *  here doesn't lose that context (2026-09-02, Danielle's ask). */
  requestedConditions?: string[];
};

const SoleSelectionDialog = ({ open, onOpenChange, onConfirm, onBack, requestedConditions }: Props) => {
  const resolve = (result: SoleSelectionResult) => {
    onConfirm(result);
    onOpenChange(false);
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
      {/* Sized way up 2026-08-27 (Danielle's call: "the pop-up may need to
          be bigger so people can really see the sole images") — from a
          max-w-md dialog with 48x36px thumbnails to this, max-w-3xl with
          big photo cards in a 2-column grid. Scrolls internally
          (max-h-[90vh] overflow-y-auto) so it still fits on shorter
          screens instead of running off the bottom. The "← Back" link that
          used to live here (for returning from the sole step to the brand
          step) is gone along with the brand step itself — closing is just
          the dialog's own X now. */}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Eyebrow (2026-09-02, Danielle's ask) — "Which sole looks closest
            to yours?" on its own doesn't say which checklist condition/
            price it's tied to. Same treatment as FollowUpSeverityDialog. */}
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#8a7a68" }}>
          {RESOLE_CONDITION_LABEL}
        </p>
        <DialogHeader>
          <DialogTitle className="text-2xl md:text-3xl">Which sole looks closest to yours?</DialogTitle>
        </DialogHeader>
        {/* Back (2026-09-02, Danielle's ask) — only rendered when this isn't
            the first question in the follow-up chain. */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-mt-2 text-sm font-medium hover:opacity-80 w-fit"
            style={{ color: "#7a5c40" }}
          >
            ← Back
          </button>
        )}
        {/* Simplified to just this one fully-hyperlinked line (2026-09-01,
            Danielle's call: "that will be the only description") — dropped
            "Match the shape and tread —" and the price-range text, and the
            whole line is now the link instead of just "not sure? Send us a
            photo instead" being underlined inside a longer sentence. Same
            treatment applied everywhere else a follow-up question dialog
            has a description — see FollowUpSeverityDialog.tsx and
            SoleMaterialDialog.tsx. Carries requestedConditions (2026-09-02)
            so staff can see what was already checked if the customer bails
            to the photo flow from here. */}
        <Link
          to="/start-repair/assessment"
          state={{ requestedConditions }}
          className="block text-sm font-medium underline -mt-2"
          style={{ color: "#3d1700" }}
        >
          Not sure? Send us a photo instead
        </Link>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {SOLE_OPTIONS.map((opt) => {
            return (
              <button
                key={opt.key}
                type="button"
                disabled={!opt.supported}
                onClick={() => pickSole(opt)}
                className={`flex flex-col text-left rounded-lg border border-border overflow-hidden transition-colors ${
                  opt.supported ? "hover:border-primary/60" : "cursor-not-allowed"
                }`}
                style={{ opacity: opt.supported ? 1 : 0.55 }}
              >
                <span className="block w-full aspect-[4/3] overflow-hidden" style={{ backgroundColor: "#f5f0e8" }}>
                  <img
                    src={SOLE_PHOTO[opt.key]}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{ filter: opt.supported ? undefined : "grayscale(1)" }}
                  />
                </span>
                <span className="flex flex-col gap-1 p-4">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold text-primary">{opt.label}</span>
                    <span
                      className="shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full"
                      style={
                        opt.supported
                          ? { backgroundColor: "#EAF3DE", color: "#27500A" }
                          : { backgroundColor: "#FCEBEB", color: "#791F1F" }
                      }
                    >
                      {opt.supported ? "Supported" : "Not supported"}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground leading-snug">{opt.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SoleSelectionDialog;
