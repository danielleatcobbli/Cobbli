import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera } from "lucide-react";
import { Link } from "react-router-dom";
import { resolePriceForKey, type Service } from "@/types/service";

/**
 * "Worn or damaged sole" follow-up — now a single sole-type-match step
 * (2026-08-27, Danielle's call). It used to be two steps in one dialog,
 * brand-first-then-sole-type, so specialty brands (Birkenstock, Golden
 * Goose priced by brand; Christian Louboutin, Maison Margiela shown but
 * blocked) could be caught before the plain sole-photo match. Danielle
 * dropped the brand step entirely at launch — Cobbli isn't taking on
 * Louboutin, Maison Margiela, or any sneaker (including Golden Goose) yet,
 * and Birkenstock's fixed-price path goes away with it (her call, rather
 * than keeping a one-off brand chip just for Birkenstock). Lug soles are
 * also newly unsupported, same treatment as cup soles. What's left is a
 * single big "which sole looks closest to yours" screen, with the brand/
 * sneaker exclusions called out as a plain disclaimer instead of a picker.
 *
 * excludedBrands / RESOLE_BRAND_OPTIONS / ResoleBrandOption and the
 * "brand" SoleSelectionResult kind are intentionally still supported
 * downstream (CartLine.resoleBrand, admin order detail, etc.) even though
 * this dialog can no longer produce one — past orders placed through the
 * old brand step still have that data and still need to render correctly.
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
    desc: "Smooth, mostly leather sole often found on dress shoes, formal loafers, heels, and some boots",
    supported: true,
    variantKey: "leather",
  },
  {
    key: "cup",
    label: "Sneaker sole",
    desc: "One molded piece that wraps up the sides of dress or athletic sneakers",
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
  /** The live full-resole catalog row, so the price range up top and each
   *  supported tile's own price (2026-08-27, Danielle's call) come straight
   *  from Supabase (service_variants.standard_cents) instead of a hardcoded
   *  number that could drift from what's actually charged at checkout. */
  resoleService: Service | null;
  onConfirm: (result: SoleSelectionResult) => void;
};

const SoleSelectionDialog = ({ open, onOpenChange, resoleService, onConfirm }: Props) => {
  const resolve = (result: SoleSelectionResult) => {
    onConfirm(result);
    onOpenChange(false);
  };

  const priceFor = (key: "leather" | "rubber"): number | null =>
    resoleService ? resolePriceForKey(resoleService, key) : null;

  // Range shown up top (2026-08-27, Danielle's call — "show a price range
  // and then show the appropriate price within the selection"). Derived from
  // whatever supported sole options actually resolve to a price, rather than
  // hardcoding "$70–$85", so it stays correct if pricing changes later or a
  // sole option's supported/unsupported status changes.
  const supportedPrices = SOLE_OPTIONS.map((o) => (o.variantKey ? priceFor(o.variantKey) : null)).filter(
    (n): n is number => n !== null,
  );
  const priceRangeLabel =
    supportedPrices.length === 0
      ? null
      : Math.min(...supportedPrices) === Math.max(...supportedPrices)
        ? `$${Math.min(...supportedPrices)}`
        : `$${Math.min(...supportedPrices)}–$${Math.max(...supportedPrices)}`;

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
        <DialogHeader>
          <DialogTitle className="text-2xl md:text-3xl">Which sole looks closest to yours?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Match the shape and tread — not sure? Send us a photo instead.
          {priceRangeLabel && (
            <>
              {" "}
              <span className="font-bold" style={{ color: "#3d1700" }}>
                {priceRangeLabel} per pair
              </span>
              , depending on sole type.
            </>
          )}
        </p>
        {/* Unsupported-categories disclaimer 2026-08-27 (Danielle's call) —
            replaces the old brand-picker step. Rather than asking brand up
            front, this is a single heads-up shown right where the customer
            is about to proceed, so anyone with one of these still sees it
            before matching a sole. Text updated same day to Danielle's exact
            wording. */}
        <p
          className="text-xs rounded-md px-3 py-2"
          style={{ backgroundColor: "#fff5cc", color: "#3d1700" }}
        >
          Sneakers and shoes made by Christian Louboutin shoes and Maison Margiela are not currently
          supported for this service.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          {SOLE_OPTIONS.map((opt) => {
            const price = opt.variantKey ? priceFor(opt.variantKey) : null;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => pickSole(opt)}
                className="flex flex-col text-left rounded-lg border border-border overflow-hidden hover:border-primary/60 transition-colors"
              >
                <span className="block w-full aspect-[4/3] overflow-hidden" style={{ backgroundColor: "#f5f0e8" }}>
                  <img src={SOLE_PHOTO[opt.key]} alt="" className="w-full h-full object-cover" />
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
                  {/* Each supported tile's own price, right below the label
                      (2026-08-27, Danielle's call) — the range up top says
                      "somewhere in this ballpark," this says exactly what
                      picking this specific sole costs. */}
                  {price !== null && (
                    <span className="text-lg font-bold" style={{ color: "#3d1700" }}>
                      ${price} <span className="text-xs font-normal text-muted-foreground">per pair</span>
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground leading-snug">{opt.desc}</span>
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
      </DialogContent>
    </Dialog>
  );
};

export default SoleSelectionDialog;
