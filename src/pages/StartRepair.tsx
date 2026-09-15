/**
 * StartRepair — "What's going on with your shoes?"
 *
 * The Starter repair entry point: a symptom checklist + optional add-ons,
 * followed by a recommendation screen that either proposes a package (when
 * it's a better fit than buying the underlying services separately — see
 * src/data/starterRepairConditions.ts for the exact rules) or itemizes the
 * individual services needed. Any service the checklist maps to that isn't
 * currently offered (not in the catalog yet, or isComingSoon) is called out
 * separately rather than silently included.
 *
 * Approved as an interactive mockup with Danielle before being wired up here
 * — the checklist categories, add-ons, and package rules below match that
 * mockup exactly, now driven by the live Supabase service catalog instead of
 * hardcoded prices.
 *
 * Fully in-page now (2026-07-27, Danielle's call) — with "Which pair needs
 * attention?" collected up front on the checklist itself (see the pair field
 * below), there's no need to hand off to PairFlowDialog.tsx's own "Describe
 * this pair" / "Anything else?" / "Added to your bag" popups anymore. The
 * recommendation screen ends in two buttons instead of one "Continue" —
 * "Add another pair to my order" and "Go to checkout" — and each commits this
 * pair straight to the bag (see commitPairToBag) before doing its own thing;
 * there's no secondary confirmation page or popup in between either.
 * PairFlowDialog itself is untouched and still used by the other two entry
 * points that don't have this pair field (a service's "Add to repair," a
 * package's "Start a repair").
 *
 * Route: /start-repair
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { X, Camera, ArrowUpRight } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useServices } from "@/hooks/useServices";
import { useRepairFlow } from "@/context/RepairFlowContext";
import type { BagService } from "@/context/BagContext";
import { formatPrice, useBag } from "@/context/BagContext";
import { formatPairLabel, usePairs } from "@/context/PairsContext";
import { useAuth } from "@/context/AuthContext";
import { SHOE_TYPES, type ShoeType, isResoleSupportedFor, isHeelTipEligible } from "@/types/service";
import { resolePriceForKey, type ResolePriceKey } from "@/types/service";
import { CHECKLIST_GROUPS, ADDONS, computeRecommendation, COMMON_CONDITION_LABELS, SLUG_TO_CONDITION_LABELS } from "@/data/starterRepairConditions";
import { CATEGORY_ICONS, categoryDisplayLabel } from "@/components/cobbli/CategoryFilterBar";
import BeforeAfterImage from "@/components/cobbli/BeforeAfterImage";
import BrandCombobox, { type BrandMode } from "@/components/cobbli/BrandCombobox";
import SoleInsoleConditionDialog, {
  SOLE_CONDITION_LABEL,
  INSOLE_CONDITION_LABEL,
  type SoleInsoleAction,
} from "@/components/cobbli/SoleInsoleConditionDialog";
import SoleSelectionDialog, {
  RESOLE_CONDITION_LABEL,
  type SoleSelectionResult,
} from "@/components/cobbli/SoleSelectionDialog";
import FollowUpSeverityDialog, {
  SEVERITY_QUESTIONS,
  type SeverityQuestion,
} from "@/components/cobbli/FollowUpSeverityDialog";
import { trackEvent } from "@/lib/analytics";
import iconOdor from "@/assets/category-icons/odor.svg";

// In-progress draft persistence (2026-09-01, bug fix — Danielle's report:
// "click 'Not sure?' from the checklist, go back, and it dumps me back on
// 'Which pair needs attention?' even though I'd already filled that out and
// was on the next page"). Root cause: for a brand-new pair (not yet an
// existing saved one), nothing about being past the pair-details step or
// mid-checklist was persisted anywhere — selectedPairId itself stays null
// until the pair is actually committed to the bag, which only happens once
// the customer finishes the whole checklist and hits one of the results-
// screen buttons. A real route change (like the "Not sure?" link, which
// navigates to /start-repair/assessment) unmounts this page entirely, so
// browser back always remounted fresh at the hardcoded default step. Fix:
// mirror RepairFlowContext's own sessionStorage pattern here for this page's
// own draft-in-progress fields, so a remount can resume instead of restart.
const DRAFT_STORAGE_KEY = "cobbli.startRepair.draft.v1";

type StartRepairDraft = {
  step: "pair-details" | "checklist" | "results";
  newPairShoeType: ShoeType | "";
  newPairBrandMode: BrandMode;
  newPairBrand: string;
  newPairColors: string[];
  newPairIdentifiers: string;
  checkedLabels: string[];
  checkedAddons: string[];
};

const readStartRepairDraft = (): Partial<StartRepairDraft> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
};

const clearStartRepairDraft = () => {
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

// Shoe-type tile photos (2026-08-29, Danielle's call — dropped the
// hand-drawn icon attempt, "very AI looking," in favor of real photos, same
// pattern as every other photo-driven selector in this app: condition
// tiles, sole-type options, etc.). Served from /public like
// condition-photos and sole-types photos, not imported as module assets, so
// dropping a new file in public/shoe-type-photos/ is a no-code-change swap.
// Nothing exists at these paths yet — renderShoeTypeTile below falls back to
// a plain placeholder box (same dashed-border pattern used in
// FollowUpSeverityDialog.tsx) until real photos land there. Filenames she
// should use when she has them, one per shoe type:
//   /shoe-type-photos/flats.jpg
//   /shoe-type-photos/loafers.jpg
//   /shoe-type-photos/sneakers.jpg
//   /shoe-type-photos/boots.jpg
//   /shoe-type-photos/ankle-boots.jpg
//   /shoe-type-photos/heels.jpg
//   /shoe-type-photos/sandals.jpg
const SHOE_TYPE_PHOTO: Record<ShoeType, string> = {
  Flats: "/shoe-type-photos/flats.jpg",
  Loafers: "/shoe-type-photos/loafers.jpg",
  Sneakers: "/shoe-type-photos/sneakers.jpg",
  Boots: "/shoe-type-photos/boots.jpg",
  "Ankle boots": "/shoe-type-photos/ankle-boots.jpg",
  Heels: "/shoe-type-photos/heels.jpg",
  Sandals: "/shoe-type-photos/sandals.jpg",
};

// No exported constant for this elsewhere (unlike SOLE_CONDITION_LABEL/
// RESOLE_CONDITION_LABEL) — matches the literal condition label used in
// starterRepairConditions.ts and FollowUpSeverityDialog.tsx's severity
// question for it.
const HEEL_TIP_CONDITION_LABEL = "Worn or missing heel tip";

/** Colors shown as optional chips on the pair-details step — same list
 *  AssessmentDetails.tsx already uses for the (separate, legacy) assessment
 *  flow's own shoe-details form, kept in sync manually since that page
 *  isn't part of this one's module graph. */
const PAIR_COLORS = [
  "Black", "Blue", "Brown", "Cream", "Denim", "Gold", "Green", "Grey",
  "Multi", "Navy", "Orange", "Pattern", "Pink", "Purple", "Red", "Silver",
  "Tan", "White", "Yellow",
];

/** Shoe-type tile (2026-09-01, Danielle's call: "I want the icons to fill
 *  the whole box and have text overlaid on them") — the photo fills the
 *  entire tile edge-to-edge, with the label sitting on a dark scrim at the
 *  bottom for legibility over any photo. Falls back to the amber tile +
 *  centered camera icon (same dashed-placeholder intent as before, just
 *  without the dashed border now that the tile itself has no padding to
 *  draw one inside) for whichever SHOE_TYPE_PHOTO paths don't have a real
 *  file yet — swaps itself out automatically the moment a real file lands
 *  at the expected path, no code change needed on Danielle's end. */
const ShoeTypeTile = ({
  shoeType,
  selected,
  onSelect,
}: {
  shoeType: ShoeType;
  selected: boolean;
  onSelect: () => void;
}) => {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="relative aspect-square rounded-xl overflow-hidden transition-all"
      style={{
        backgroundColor: "#fdb600",
        border: selected ? "3px solid #3d1700" : "3px solid transparent",
      }}
    >
      {!failed ? (
        <>
          <img
            src={SHOE_TYPE_PHOTO[shoeType]}
            alt={shoeType}
            onError={() => setFailed(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <span
            className="absolute inset-x-0 bottom-0 px-2 pt-4 pb-1.5"
            style={{ background: "linear-gradient(to top, rgba(61,23,0,0.85), rgba(61,23,0,0))" }}
          >
            <span className="block text-[13px] font-semibold text-center leading-snug text-white">
              {shoeType}
            </span>
          </span>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <Camera size={20} style={{ color: "#3d1700", opacity: 0.45 }} />
          <span className="text-[13px] font-medium text-center leading-snug" style={{ color: "#3d1700" }}>
            {shoeType}
          </span>
        </div>
      )}
    </button>
  );
};

type CartLine = {
  id: string;
  name: string;
  price: number;
  kind: "package" | "service";
  slug: string;
  /** Checked condition labels this line addresses — shown as "Fixes: …"
   *  above the name so a recommended service/package always traces back to
   *  the symptom(s) that produced it (2026-07-27, Danielle's call: "Fixes"
   *  reads more like plain speech than "Addresses"). Empty for lines that
   *  only came from an add-on (e.g. waterproofing), which isn't tied to a
   *  condition. */
  addresses: string[];
  /** Carried through to the bag when this line is full-resole priced by sole
   *  material (or lug, which shares rubber's price/variant) — see BagService. */
  soleMaterial?: "Leather" | "Rubber";
  /** Carried through to the bag when this line is full-resole priced by
   *  specialty brand instead — see BagService. */
  resoleBrand?: string;
};

const LABEL_TO_SLUG = new Map<string, string>();
CHECKLIST_GROUPS.forEach((group) => group.conditions.forEach((c) => LABEL_TO_SLUG.set(c.label, c.slug)));

const StartRepair = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Arriving from a service's own page via "Start a repair" (ServiceDetail's
  // onStart) should land here with that service's checklist condition(s)
  // already checked, not a blank checklist — Danielle's report, 2026-08-11:
  // this was never wired up. presetAppliedRef makes sure it only applies once
  // on this page's first load, not every time a fresh "new pair" is started
  // afterward (e.g. via "Add another pair to my order").
  const presetSlug = (location.state as { presetSlug?: string } | null)?.presetSlug;
  const presetAppliedRef = useRef(false);
  const { data: services, isLoading } = useServices();
  const { selectedPairId, setSelectedPairId } = useRepairFlow();
  const { pairs, addPair: addSavedPair, getPair } = usePairs();
  const { findByPairId, addPair: addPairToBag } = useBag();
  const { user } = useAuth();

  // Which-pair step (rebuilt 2026-08-29, Danielle's call) — pair identity is
  // now its own required page ("Tell us about this pair," step ===
  // "pair-details") shown BEFORE the checklist, instead of a field sitting
  // on the checklist page itself. Two things drove this: (1) she wanted the
  // pair field impossible to skip past without noticing, and structurally
  // gating the checklist behind it does that more reliably than any amount
  // of visual styling could; (2) she wants shoe type + brand collected up
  // front so the checklist can grey out/hide conditions that don't apply to
  // this particular pair (resole for sneakers/Louboutin/Margiela, heel-tip
  // for non-heeled shoe types) — see isResoleSupportedFor/isHeelTipEligible.
  //
  // A dropdown of saved pairs only makes sense for a signed-in customer who
  // actually has any — a guest never has saved pairs, so they go straight to
  // the new-pair form with no dropdown to show at all.
  const showPairDropdown = !!user && pairs.length > 0;
  const isAddingNewPair = selectedPairId === null;

  // New-pair form fields (replaces the old single free-text "newPairName" —
  // see PairsContext.tsx's SavedPair/formatPairLabel for how these compose
  // into the label shown everywhere else). Shoe type and brand are required;
  // color and identifiers are optional, per Danielle's call.
  const [newPairShoeType, setNewPairShoeType] = useState<ShoeType | "">(
    () => readStartRepairDraft().newPairShoeType ?? "",
  );
  const [newPairBrandMode, setNewPairBrandMode] = useState<BrandMode>(
    () => readStartRepairDraft().newPairBrandMode ?? "",
  );
  const [newPairBrand, setNewPairBrand] = useState(() => readStartRepairDraft().newPairBrand ?? "");
  const [newPairColors, setNewPairColors] = useState<string[]>(
    () => readStartRepairDraft().newPairColors ?? [],
  );
  const [newPairIdentifiers, setNewPairIdentifiers] = useState(
    () => readStartRepairDraft().newPairIdentifiers ?? "",
  );

  // Red validation state for the pair-details step (2026-07-29, carried
  // forward from the old pair field's same treatment) — shoe type/brand
  // missing flags right on the pair-details page instead of letting someone
  // through to a checklist with no pair behind it.
  const [pairError, setPairError] = useState(false);
  const isPairFilled =
    selectedPairId !== null || (newPairShoeType !== "" && (newPairBrandMode === "unknown" || newPairBrand.trim().length > 0));

  // Same treatment as pairError above, for the other independent
  // requirement (2026-08-12, Danielle's call — the two need to behave the
  // same way): "See my recommendations" used to hard-disable on no
  // conditions checked but stay clickable-with-a-nudge on no pair selected,
  // which meant a customer missing *both* just saw a dead button with no clue
  // why. Now both are always clickable and point at whichever's missing.
  const [conditionsError, setConditionsError] = useState(false);

  // Free-form notes for this specific repair (2026-07-27, Danielle's call) —
  // collected here on the recommendations screen rather than in a separate
  // popup step. Distinct from the pair's own name/identity: this is about the
  // repair ("there's a clicking sound near the heel"), so it resets whenever
  // a fresh pair is started (see onAddAnotherPair) rather than persisting.
  const [repairNotes, setRepairNotes] = useState("");

  // Bug fix (2026-09-01, Danielle's report): navigating away mid-checklist
  // (e.g. the "Not sure?" photo/video link, a real route change) and back
  // via the browser's back button remounts this whole page, and step was
  // always hardcoded to start at "pair-details" — throwing away real
  // progress. Root cause: for a brand-new pair, selectedPairId itself stays
  // null until the whole checklist is finished (see commitPairToBag), so
  // there was nothing to detect "already past pair-details" from. Restore
  // from the sessionStorage draft (see readStartRepairDraft above) when
  // present; otherwise fall back to the selectedPairId heuristic for an
  // existing saved pair picked from the dropdown, which sets it immediately.
  const [step, setStep] = useState<"pair-details" | "checklist" | "results">(() => {
    const draftStep = readStartRepairDraft().step;
    if (draftStep) return draftStep;
    return selectedPairId ? "checklist" : "pair-details";
  });
  const [checkedLabels, setCheckedLabels] = useState<Set<string>>(
    () => new Set(readStartRepairDraft().checkedLabels ?? []),
  );
  const [checkedAddons, setCheckedAddons] = useState<Set<string>>(
    () => new Set(readStartRepairDraft().checkedAddons ?? []),
  );
  const [notOffered, setNotOffered] = useState<{ slug: string; name: string }[]>([]);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);

  // Gates "See my recommendations" when the checklist can't tell on its own
  // which service to recommend — "Sole separating from shoe" and "Loose or
  // detached insole" both cover a still-good part that just needs regluing
  // *and* a worn-out one that needs replacing, and the right service differs
  // (gluing vs. full-resole / insole-replacement). Only the question(s)
  // matching a checked condition are shown (2026-07-28, Danielle's call).
  const needsSoleQuestion = checkedLabels.has(SOLE_CONDITION_LABEL);
  const needsInsoleQuestion = checkedLabels.has(INSOLE_CONDITION_LABEL);
  const needsResoleQuestion = checkedLabels.has(RESOLE_CONDITION_LABEL);

  // Unified follow-up question chain (rebuilt 2026-09-02, Danielle's ask:
  // "let the user go back when they're answering the questions" — the old
  // design was three independent open/queue states chained together via
  // one-shot "pending" stashes, which had no way to step backward without
  // closing the whole sequence and restarting the checklist submission).
  // followUpSteps is built once, at "Next" click time, in a fixed order
  // (sole/insole, then resole sole-type, then severity questions in
  // SEVERITY_QUESTIONS' own order) — going back/forward only moves
  // followUpIndex through that same fixed array, never reorders it.
  type FollowUpStep =
    | { kind: "sole-insole" }
    | { kind: "resole" }
    | { kind: "severity"; question: SeverityQuestion };
  const [followUpSteps, setFollowUpSteps] = useState<FollowUpStep[]>([]);
  const [followUpIndex, setFollowUpIndex] = useState(0);
  const [soleInsoleAnswers, setSoleInsoleAnswers] = useState<{
    sole?: SoleInsoleAction;
    insole?: SoleInsoleAction;
  }>({});
  const [resoleAnswer, setResoleAnswer] = useState<SoleSelectionResult | undefined>(undefined);
  // Captured per condition (e.g. { Stains: "heavy" }) for future wiring —
  // not read by seeRecommendations() yet, see FollowUpSeverityDialog.tsx.
  const [severityAnswers, setSeverityAnswers] = useState<Record<string, string>>({});
  // Distinguishes "this dialog closed itself right after onConfirm, as part
  // of advancing to the next/previous step" from "the customer actually hit
  // X/Cancel/Escape" — both call the same onOpenChange(false), but only the
  // latter should cancel the whole sequence. Set true immediately before
  // any index change that will cause the current dialog to auto-close
  // itself, consumed (and reset) the moment that resulting onOpenChange
  // fires. See handleFollowUpOpenChange below.
  const followUpAdvancingRef = useRef(false);

  const currentFollowUpStep = followUpSteps[followUpIndex];
  const soleInsoleOpen = currentFollowUpStep?.kind === "sole-insole";
  const resoleOpen = currentFollowUpStep?.kind === "resole";
  const severityOpen = currentFollowUpStep?.kind === "severity";
  const currentSeverityQuestion = currentFollowUpStep?.kind === "severity" ? currentFollowUpStep.question : null;

  const closeFollowUpFlow = () => {
    setFollowUpSteps([]);
    setFollowUpIndex(0);
  };

  const handleFollowUpOpenChange = (open: boolean) => {
    if (open) return;
    if (followUpAdvancingRef.current) {
      followUpAdvancingRef.current = false;
      return;
    }
    // A genuine cancel (X, Cancel button, Escape, overlay click) — bail out
    // of the whole sequence rather than just this one question, same as the
    // old design's behavior.
    closeFollowUpFlow();
  };

  const goBackFollowUp = () => {
    followUpAdvancingRef.current = true;
    setFollowUpIndex((i) => Math.max(0, i - 1));
  };

  // Bug fix (2026-07-27, Danielle's report): looping back to "add more
  // services" for a pair that already has services in the bag used to show a
  // blank checklist — nothing pre-checked — and the pair switcher below was
  // read-only, so there was no way to fix a wrong pair either. Silently
  // continuing meant "Continue" only ever sent this pass's newly-checked
  // items, and addPair() *replaces* a pair's service list rather than merging
  // — so anything added on a previous pass (e.g. a resole already in the bag)
  // got wiped out the moment more services were added.
  //
  // Fix: whenever the active pair changes (including on first mount here),
  // re-derive checkedLabels/checkedAddons from whatever that pair already has
  // in the bag, reversing each service slug back to its checklist condition
  // label(s) (SLUG_TO_CONDITION_LABELS) or add-on label. That way "Continue"
  // always sends the *complete* current set for this pair — prior selections
  // plus whatever changed — so addPair's replace semantics are correct
  // instead of lossy. Switching to a different pair (or to "new pair," a null
  // id) starts that pair's own selection fresh rather than carrying over
  // whatever was checked for the last one.
  // Tracks the *previous* selectedPairId so the effect below can tell "the
  // customer just picked a pair for the first time, while mid-checklist"
  // apart from "the customer is switching between two already-selected
  // pairs" — see the bug note inside the effect.
  const prevSelectedPairIdRef = useRef<string | null>(null);
  // Separate from prevSelectedPairIdRef — this just marks whether the effect
  // below has ever run for *this* mounted instance, regardless of what
  // selectedPairId happens to be. See the bug note on the new-pair-field
  // reset just below for why the distinction matters.
  const isFirstPairEffectRunRef = useRef(true);

  useEffect(() => {
    const isInitialMount = isFirstPairEffectRunRef.current;
    isFirstPairEffectRunRef.current = false;

    // Switching to an existing saved pair means whatever was typed for a new
    // pair no longer applies — clear it so it can't get sent along by
    // mistake. Bug fix (2026-09-01, Danielle's report): skip this on the
    // very first run after a mount/remount. selectedPairId can already be
    // non-null right at mount for reasons that AREN'T a genuine in-session
    // "switch to an existing pair" — e.g. a stale value left over from
    // earlier in the browser tab's session — and unconditionally clearing
    // here was stomping on newPairShoeType/newPairBrand/etc the moment they
    // were restored from the sessionStorage draft (see readStartRepairDraft
    // above) for a brand-new, still-in-progress pair. A *real* switch to an
    // existing pair happening later, while this instance stays mounted,
    // still clears correctly — isInitialMount is only true once, on the
    // very first effect run.
    if (selectedPairId && !isInitialMount) {
      setNewPairShoeType("");
      setNewPairBrandMode("");
      setNewPairBrand("");
      setNewPairColors([]);
      setNewPairIdentifiers("");
    }
    const existing = selectedPairId ? findByPairId(selectedPairId) : undefined;
    const cameFromNoPairSelected = prevSelectedPairIdRef.current === null;
    prevSelectedPairIdRef.current = selectedPairId;

    if (existing) {
      const labels = new Set<string>();
      const addons = new Set<string>();
      const addonSlugs = new Set(ADDONS.map((a) => a.slug));
      existing.services.forEach((svc) => {
        if (addonSlugs.has(svc.id)) {
          addons.add(svc.id);
        } else {
          (SLUG_TO_CONDITION_LABELS.get(svc.id) ?? []).forEach((label) => labels.add(label));
        }
      });
      setCheckedLabels(labels);
      setCheckedAddons(addons);
      return;
    }

    if (!presetAppliedRef.current && presetSlug) {
      presetAppliedRef.current = true;
      setCheckedLabels(new Set(SLUG_TO_CONDITION_LABELS.get(presetSlug) ?? []));
      setCheckedAddons(new Set());
      return;
    }

    // Nothing in the bag yet for whatever's selected now (a brand-new pair,
    // or a saved pair that hasn't had services picked on this order). Bug
    // fix (2026-08-12, Danielle's report): this used to unconditionally
    // reset to an empty checklist here, which wiped out conditions the
    // customer had already checked *before* naming a pair — check "Worn or
    // damaged sole," then pick a pair, and it silently unchecked itself.
    // Only reset when this is a genuine switch away from a different,
    // already-selected pair; if we just came from "no pair chosen yet,"
    // leave whatever's checked alone so it carries over to the pair that
    // was just picked.
    if (!cameFromNoPairSelected) {
      setCheckedLabels(new Set());
      setCheckedAddons(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPairId]);

  // Keeps the sessionStorage draft (see readStartRepairDraft above) in sync
  // with this page's in-progress state, so a remount from browser back can
  // restore it. Cleared once the pair's actually committed to the bag (see
  // commitPairToBag) — at that point this is real data elsewhere, not a
  // draft, and shouldn't linger to resurrect stale checklist state on a
  // later, genuinely fresh visit.
  useEffect(() => {
    const draft: StartRepairDraft = {
      step,
      newPairShoeType,
      newPairBrandMode,
      newPairBrand,
      newPairColors,
      newPairIdentifiers,
      checkedLabels: Array.from(checkedLabels),
      checkedAddons: Array.from(checkedAddons),
    };
    try {
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [
    step,
    newPairShoeType,
    newPairBrandMode,
    newPairBrand,
    newPairColors,
    newPairIdentifiers,
    checkedLabels,
    checkedAddons,
  ]);

  // slug -> service, so each condition's checklist thumbnail can reuse the
  // exact photo shown on that service's card/detail page on /services —
  // Danielle's call: the same repair should look like the same repair
  // everywhere, rather than maintaining a second, separate image per
  // condition. Falls back to cond.imageUrl (a manual override, if ever set)
  // then the category icon when neither the service nor the condition has a
  // photo yet.
  const serviceBySlug = useMemo(() => {
    const map = new Map<string, { imageUrl?: string; afterImageUrl?: string }>();
    (services ?? []).forEach((s) => map.set(s.slug, s));
    return map;
  }, [services]);

  // Category slider (same visual language as CategoryFilterBar's scrollable
  // mode) + photo-forward tile grid, replacing the old two-column
  // per-category cards (2026-07-22, Danielle's call — the small list-row
  // thumbnails were "hard to see," and simply enlarging them wasn't the
  // answer).
  //
  // "All" (the default) is deliberately flat, not grouped by category
  // (2026-07-22, Danielle's call after weighing it out loud): category
  // grouping was exactly what forced the wasted space and scrolling she was
  // trying to fix — every category has to start its own row no matter how
  // full the previous row was, and a fixed pairing (e.g. a 2-item category
  // + a 3-item category sharing a row) breaks the moment either category's
  // item count changes, which happened several times already this session.
  // The photo is what actually tells a customer "that's my issue," not the
  // category label above it, so losing the grouping costs little. Tapping a
  // pill still filters down to one category's tiles (no header needed, the
  // slider itself makes that obvious).
  //
  // Ordering: "All" is seeded from CHECKLIST_GROUPS' existing order, which is
  // alphabetical by category (2026-07-23, Danielle's call — predictable and
  // scannable beats frequency-ordered once you already know what you're
  // looking for). This is just the fallback order for whatever COMMON_
  // CONDITION_LABELS doesn't already float to the front — see
  // sortCommonFirst below, which still surfaces the genuinely frequent
  // conditions first regardless of category order.
  const [activeChecklistCategory, setActiveChecklistCategory] = useState<
    (typeof CHECKLIST_GROUPS)[number]["serviceCategory"] | "All"
  >("All");

  type VisibleCondition = {
    label: string;
    slug: string;
    imageUrl?: string;
    afterImageUrl?: string;
    category: (typeof CHECKLIST_GROUPS)[number]["serviceCategory"];
    id: string;
  };

  // Common conditions float to the front of whatever's currently visible —
  // "All" or a single category filter — in the exact order Danielle gave
  // (COMMON_CONDITION_LABELS, based on real completed-order data, not a
  // guess). Everything else keeps its existing relative order after that.
  const sortCommonFirst = (list: VisibleCondition[]): VisibleCondition[] => {
    const byLabel = new Map(list.map((c) => [c.label, c]));
    const common = COMMON_CONDITION_LABELS.map((label) => byLabel.get(label)).filter(
      (c): c is VisibleCondition => !!c,
    );
    const commonLabels = new Set(common.map((c) => c.label));
    const rest = list.filter((c) => !commonLabels.has(c.label));
    return [...common, ...rest];
  };

  // TEMPORARY (2026-07-27, Danielle's call) — she's screenshotting this page
  // for a presentation and wants every tile with a real photo up top, every
  // tile still falling back to a category icon (or the custom "Shoes smell"
  // stink-lines icon, also not a real photo — and she's out of Adobe credits
  // to generate its replacement today) pushed to the back. Layered on top of
  // sortCommonFirst rather than replacing it — a stable partition, so
  // Common-first ordering is preserved within each of the two groups. She's
  // said she'll want to revisit condition order generally later, at which
  // point this should probably go away.
  const hasRealImage = (cond: VisibleCondition): boolean => {
    const img = serviceBySlug.get(cond.slug)?.imageUrl ?? cond.imageUrl;
    return !!img && img !== iconOdor;
  };

  const sortImagesFirst = (list: VisibleCondition[]): VisibleCondition[] => [
    ...list.filter(hasRealImage),
    ...list.filter((c) => !hasRealImage(c)),
  ];

  // Shoe-type/brand gating (2026-08-29, Danielle's call) — resolved from
  // whichever pair is active: an existing saved pair's own shoeType/brand,
  // or whatever's been entered so far on the new-pair form. Falls back
  // gracefully to "no restriction" (shoeType "") before either is known,
  // e.g. briefly on first render before the pair-details step has run.
  const activePair = selectedPairId ? getPair(selectedPairId) : null;
  const activeShoeType: ShoeType | "" = activePair?.shoeType ?? newPairShoeType;
  const activeBrand: string | undefined = activePair?.brand ?? (newPairBrand.trim() || undefined);
  const heelTipEligible = isHeelTipEligible(activeShoeType);
  const resoleSupported = isResoleSupportedFor(activeShoeType, activeBrand);

  // Short summary shown at the top of the checklist with a "Change pair"
  // link back to the pair-details step (replaces the old inline pair-field
  // dropdown/text input that used to live directly on this page).
  const activePairSummary = activePair
    ? formatPairLabel(activePair)
    : [newPairColors.join(" / "), newPairBrandMode === "unknown" ? "Unknown brand" : newPairBrand.trim(), newPairShoeType]
        .filter(Boolean)
        .join(" · ") + (newPairIdentifiers.trim() ? ` (${newPairIdentifiers.trim()})` : "");

  // Heel-tip condition hidden entirely (not just greyed out) for shoe types
  // that don't plausibly have a heel tip — see HEEL_TIP_SHOE_TYPES. Resole
  // stays visible but greyed out (see renderConditionTile) since Danielle
  // specifically asked for a "not currently supported" message there rather
  // than making it disappear.
  const filterEligibleConditions = (list: VisibleCondition[]): VisibleCondition[] =>
    heelTipEligible ? list : list.filter((c) => c.label !== HEEL_TIP_CONDITION_LABEL);

  const visibleConditions = useMemo<VisibleCondition[]>(() => {
    if (activeChecklistCategory === "All") {
      // Dedupe by label — several conditions intentionally appear in more
      // than one CHECKLIST_GROUPS entry (e.g. "Damage on heel tab" under both
      // Scuffs & holes and Insole & interior) so they're reachable from
      // either category filter. In the flat "All" view that would otherwise
      // render the exact same tile twice, which reads as a bug rather than
      // "this fits two categories."
      const seen = new Set<string>();
      const flat: VisibleCondition[] = [];
      CHECKLIST_GROUPS.forEach((group) => {
        group.conditions.forEach((cond, idx) => {
          if (seen.has(cond.label)) return;
          seen.add(cond.label);
          flat.push({ ...cond, category: group.serviceCategory, id: `cond-${group.serviceCategory}-${cond.slug}-${idx}` });
        });
      });
      return filterEligibleConditions(sortImagesFirst(sortCommonFirst(flat)));
    }
    const group = CHECKLIST_GROUPS.find((g) => g.serviceCategory === activeChecklistCategory);
    if (!group) return [];
    return filterEligibleConditions(
      sortImagesFirst(
        sortCommonFirst(
          group.conditions.map((cond, idx) => ({
            ...cond,
            category: group.serviceCategory,
            id: `cond-${group.serviceCategory}-${cond.slug}-${idx}`,
          })),
        ),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChecklistCategory, serviceBySlug, heelTipEligible]);

  const renderConditionTile = (cond: {
    label: string;
    slug: string;
    imageUrl?: string;
    afterImageUrl?: string;
    category: (typeof CHECKLIST_GROUPS)[number]["serviceCategory"];
    id: string;
  }) => {
    const isChecked = checkedLabels.has(cond.label);
    // Resole gating (2026-08-29, Danielle's call) — greyed out with a "not
    // currently supported" message rather than hidden, since she specifically
    // distinguished this from heel-tip's "only visible for..." treatment
    // (that one's filtered out of visibleConditions entirely, above).
    const isResoleUnsupported = cond.label === RESOLE_CONDITION_LABEL && !resoleSupported;
    // Amber frame-around-the-photo treatment 2026-08-27 (Danielle's call) —
    // matches ServiceCard's "amber" theme (the homepage/Services cards):
    // padding wraps the whole tile so amber shows on all four sides of the
    // photo instead of the photo running edge-to-edge, and the condition
    // name sits on the same amber background in cream text. Selected state
    // is now a brown ring around the tile (border goes from transparent to
    // solid) rather than a swapped background/border color, since every
    // tile is amber now regardless of checked state.
    return (
      <label
        key={cond.id}
        htmlFor={cond.id}
        className={`flex flex-col rounded-xl overflow-hidden transition-all ${isResoleUnsupported ? "cursor-not-allowed" : "cursor-pointer"}`}
        style={{
          backgroundColor: "#fdb600",
          border: isChecked ? "3px solid #3d1700" : "3px solid transparent",
          opacity: isResoleUnsupported ? 0.55 : 1,
        }}
      >
        <div className="flex flex-col flex-1 p-2.5">
          <div className="relative aspect-square overflow-hidden rounded-lg">
            <BeforeAfterImage
              before={
                serviceBySlug.get(cond.slug)?.imageUrl ??
                cond.imageUrl ??
                CATEGORY_ICONS[cond.category]
              }
              after={serviceBySlug.get(cond.slug)?.afterImageUrl ?? cond.afterImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ backgroundColor: "#3d1700", filter: isResoleUnsupported ? "grayscale(1)" : undefined }}
            />
            {/* "Common" tag removed 2026-08-13 (Danielle's call) — it sat on
                top of the condition photo and was blocking part of the "Worn
                or missing heel tip" image, and with the catalog still small
                she didn't think the common/popular distinction was pulling
                its weight yet. COMMON_CONDITION_LABELS itself is untouched,
                so common conditions still sort to the front (see
                sortCommonFirst above) — only the visual badge is gone.
                Removed the same way from ServiceCard.tsx and
                ServiceDetail.tsx's "Popular" tag. */}
            <Checkbox
              id={cond.id}
              checked={isChecked}
              disabled={isResoleUnsupported}
              onCheckedChange={() => {
                if (isResoleUnsupported) return;
                toggleCondition(cond.label);
              }}
              className="absolute top-2 right-2 bg-white/90"
            />
          </div>
          {/* Condition name links through to its service detail page
              (/start-repair/services/:slug, the in-flow variant) so someone
              who wants more detail before deciding can get it — 2026-08-27,
              Danielle's call. Nested <a>/<Link> inside a <label> doesn't
              forward its click to the paired checkbox (only non-interactive
              label content does that), so this works as a plain link
              without also toggling the tile. stopPropagation kept as a
              belt-and-braces guard.

              Text switched from cream to Cobbli brown (2026-08-27, Danielle's
              call, testing for more standout) — brown-on-amber is
              meaningfully higher contrast than cream-on-amber (cream and
              amber sit close in lightness; brown is dark), so both the name
              and price read more clearly against the tile. */}
          <Link
            to={`/start-repair/services/${cond.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="block pt-2 w-fit hover:underline"
            style={{ color: "#3d1700" }}
          >
            <span className="text-[13px] font-medium leading-snug inline-flex items-start gap-0.5">
              <span className="line-clamp-2">{cond.label}</span>
              <ArrowUpRight size={12} className="shrink-0 opacity-70 mt-0.5" />
            </span>
          </Link>
          {/* Price shown right on the tile 2026-08-27 (Danielle's call) — now
              that "Services" is off the top nav and this checklist is the
              main entry point, most people were never seeing pricing at all
              unless they clicked through to a condition's own service page.
              Same source/format as ServiceCard's amber-card price (DB
              card_price_label, "per pair"/etc. suffix stripped). Color
              matches the name's brown (see comment above).

              mt-auto (2026-08-27, Danielle's call: "they should all be
              showing at the bottom of the square... even if the condition
              name is only one line") — this grid (grid-cols-2/3/5 below) uses
              CSS Grid's default `align-items: stretch`, so every tile in a
              row is already stretched to match the tallest tile in that row
              (e.g. a row with one 2-line name stretches every tile in it to
              that height) — the missing piece was that nothing inside the
              tile was using that extra space, so a 1-line tile's price sat
              wherever its shorter content happened to end, with the leftover
              stretched height appearing as empty space below the price
              instead. `mt-auto` on a flex-column child pushes it to fill any
              leftover space above itself, so the price now always sits flush
              against the tile's true bottom edge regardless of how tall the
              row got stretched or how many lines the name above it took. An
              earlier attempt reserved a fixed min-height for the name block
              instead — unnecessary once mt-auto is doing the real work, so
              it's gone. */}
          {isResoleUnsupported ? (
            <p className="text-[11px] font-semibold pt-0.5 mt-auto leading-snug" style={{ color: "#3d1700" }}>
              Not currently supported for this type of shoe
            </p>
          ) : (
            serviceBySlug.get(cond.slug)?.cardPriceLabel && (
              <p className="text-[13px] font-bold pt-0.5 mt-auto" style={{ color: "#3d1700" }}>
                {serviceBySlug.get(cond.slug)!.cardPriceLabel.replace(/\s+per\s+\S.*/i, "").trim()}
              </p>
            )
          )}
        </div>
      </label>
    );
  };

  usePageMeta({
    title: "Start a repair — Cobbli",
    description:
      "Tell us what's going on with your shoes and we'll recommend the right services or repair package.",
  });

  const toggleCondition = (label: string) => {
    setCheckedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
    setConditionsError(false);
  };

  const toggleAddon = (slug: string) => {
    setCheckedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
    setConditionsError(false);
  };

  const anyChecked = checkedLabels.size > 0 || checkedAddons.size > 0;

  // What's currently checked on the checklist, as condition/add-on labels —
  // carried as router state into every "Not sure? Send us a photo instead"
  // link (the main checklist callout below, plus each follow-up dialog) so
  // staff can see what the customer was already trying to select even
  // though they never finished the checklist (2026-09-02, Danielle's ask:
  // "we have clear visibility to what services they are trying to select
  // when they send us a photo"). Read by AssessmentUpload.tsx and stored on
  // the assessments row's new requested_conditions column.
  const requestedConditionLabels = useMemo(() => {
    const labels = Array.from(checkedLabels);
    checkedAddons.forEach((slug) => {
      const addon = ADDONS.find((a) => a.slug === slug);
      if (addon) labels.push(addon.label);
    });
    return labels;
  }, [checkedLabels, checkedAddons]);

  // Every checked condition with a severity question (Stains, Scuffs,
  // Scratches, or Worn or missing heel tip), in SEVERITY_QUESTIONS' own
  // fixed order — MOCKUP ONLY, see FollowUpSeverityDialog.tsx.
  const buildSeverityQueue = (): SeverityQuestion[] =>
    SEVERITY_QUESTIONS.filter((q) => checkedLabels.has(q.conditionLabel));

  // Entry point for the "Next" button — builds the fixed-order follow-up
  // chain (sole/insole, then resole sole-type, then severity questions),
  // only including whichever steps this pair's checked conditions actually
  // need, then opens the first one. Rebuilt 2026-09-02 (Danielle's ask) to
  // support back-navigation — see followUpSteps/followUpIndex above.
  const onSeeRecommendationsClick = () => {
    if (!services) return;
    // Pair identity is no longer validated here (2026-08-29) — the checklist
    // is now structurally unreachable without first completing the
    // pair-details step, so isPairFilled is always true by this point.
    const conditionsMissing = !anyChecked;
    setConditionsError(conditionsMissing);
    if (conditionsMissing) {
      document.getElementById("condition-tiles")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const steps: FollowUpStep[] = [];
    if (needsSoleQuestion || needsInsoleQuestion) steps.push({ kind: "sole-insole" });
    if (needsResoleQuestion) steps.push({ kind: "resole" });
    buildSeverityQueue().forEach((question) => steps.push({ kind: "severity", question }));

    if (steps.length === 0) {
      seeRecommendations({}, undefined);
      return;
    }
    // Fresh run each time "Next" is clicked from the checklist — clears any
    // answers left over from a previous attempt (e.g. the customer went
    // back to the checklist and changed what's checked).
    setSoleInsoleAnswers({});
    setResoleAnswer(undefined);
    setSeverityAnswers({});
    setFollowUpSteps(steps);
    setFollowUpIndex(0);
  };

  // Advances to the next step in followUpSteps, or — if this was the last
  // one — closes the sequence and computes the real recommendation.
  // finalSoleInsoleAnswers/finalResoleAnswer/finalSeverityAnswers are passed
  // explicitly rather than read back from state, since the setState call for
  // whichever one this step just answered hasn't re-rendered yet at the
  // point this runs (same reasoning the old "pending" stash variables
  // existed for). Defaulted to the current state value so callers that
  // didn't just change that particular answer (e.g. a sole/insole confirm,
  // which never touches severityAnswers) don't have to pass it explicitly.
  const advanceOrFinishFollowUp = (
    finalSoleInsoleAnswers: { sole?: SoleInsoleAction; insole?: SoleInsoleAction } = soleInsoleAnswers,
    finalResoleAnswer: SoleSelectionResult | undefined = resoleAnswer,
    finalSeverityAnswers: Record<string, string> = severityAnswers,
  ) => {
    followUpAdvancingRef.current = true;
    const nextIndex = followUpIndex + 1;
    if (nextIndex >= followUpSteps.length) {
      setFollowUpSteps([]);
      setFollowUpIndex(0);
      seeRecommendations(finalSoleInsoleAnswers, finalResoleAnswer, finalSeverityAnswers);
      return;
    }
    setFollowUpIndex(nextIndex);
  };

  const onSoleInsoleConfirm = (answers: { sole?: SoleInsoleAction; insole?: SoleInsoleAction }) => {
    setSoleInsoleAnswers(answers);
    advanceOrFinishFollowUp(answers, resoleAnswer);
  };

  const onSoleSelectionConfirm = (result: SoleSelectionResult) => {
    setResoleAnswer(result);
    advanceOrFinishFollowUp(soleInsoleAnswers, result);
  };

  const onSeverityConfirm = (conditionLabel: string, optionKey: string) => {
    trackEvent("severity_question_answered", { condition: conditionLabel, option: optionKey });
    const nextSeverityAnswers = { ...severityAnswers, [conditionLabel]: optionKey };
    setSeverityAnswers(nextSeverityAnswers);
    advanceOrFinishFollowUp(soleInsoleAnswers, resoleAnswer, nextSeverityAnswers);
  };

  const seeRecommendations = (
    answers: { sole?: SoleInsoleAction; insole?: SoleInsoleAction },
    resoleAnswer?: SoleSelectionResult,
    severityResultAnswers: Record<string, string> = severityAnswers,
  ) => {
    if (!services || !anyChecked) return;
    const requiredSlugs = new Set<string>();
    // slug -> every checked condition label that maps to it, so each
    // resulting service/package line can show which symptom(s) it addresses.
    const slugToLabels = new Map<string, string[]>();
    // Set when the resole follow-up came back blocked (unsupported brand or
    // cup sole) — "full-resole" is deliberately left out of requiredSlugs in
    // that case, so it's never priced or added; it's surfaced as its own
    // not-offered card instead (see below).
    let resoleBlockedLabel: string | null = null;
    checkedLabels.forEach((label) => {
      let slug = LABEL_TO_SLUG.get(label);
      // Override the default checklist mapping (both point at "gluing") once
      // the customer has told us the part actually needs replacing instead.
      if (label === SOLE_CONDITION_LABEL && answers.sole === "replace") slug = "full-resole";
      if (label === INSOLE_CONDITION_LABEL && answers.insole === "replace") slug = "insole-replacement";
      if (label === RESOLE_CONDITION_LABEL && resoleAnswer?.kind === "blocked") {
        resoleBlockedLabel = resoleAnswer.label;
        slug = undefined;
      }
      if (slug) {
        requiredSlugs.add(slug);
        const existing = slugToLabels.get(slug);
        if (existing) existing.push(label);
        else slugToLabels.set(slug, [label]);
      }
    });
    checkedAddons.forEach((slug) => requiredSlugs.add(slug));

    const result = computeRecommendation(checkedLabels, requiredSlugs, services);
    trackEvent("starter_repair_recommendation", {
      condition_count: checkedLabels.size,
      addon_count: checkedAddons.size,
      package: result.package?.bundleSlug ?? null,
      not_offered_count: result.notOffered.length + (resoleBlockedLabel ? 1 : 0),
    });

    const addressesFor = (slugs: string[]): string[] => {
      const seen = new Set<string>();
      slugs.forEach((slug) => (slugToLabels.get(slug) ?? []).forEach((label) => seen.add(label)));
      return Array.from(seen);
    };

    const lines: CartLine[] = [];
    if (result.package) {
      lines.push({
        id: `bundle-${result.package.bundleSlug}`,
        name: result.package.name,
        price: Math.round(parseFloat(result.package.price.replace(/[^0-9.]/g, "")) * 100),
        kind: "package",
        slug: result.package.bundleSlug,
        addresses: addressesFor(result.package.covers),
      });
    }
    result.individual.forEach((s) => {
      const line: CartLine = { id: s.slug, name: s.name, price: s.price, kind: "service", slug: s.slug, addresses: addressesFor([s.slug]) };
      // Override the catalog's default full-resole price with whatever the
      // resole follow-up resolved to — a specialty brand's fixed price, or
      // the material/lug variant the customer matched their sole to.
      if (s.slug === "full-resole" && resoleAnswer && resoleAnswer.kind !== "blocked") {
        const live = (services ?? []).find((svc) => svc.slug === "full-resole");
        const priced = live ? resolePriceForKey(live, resoleAnswer.variantKey as ResolePriceKey) : null;
        if (priced !== null) line.price = priced * 100;
        line.name = `Resole — ${resoleAnswer.label}`;
        if (resoleAnswer.kind === "brand") line.resoleBrand = resoleAnswer.variantKey;
        if (resoleAnswer.kind === "material") line.soleMaterial = resoleAnswer.variantKey === "leather" ? "Leather" : "Rubber";
      }
      // Severity-based pricing (2026-09-02, Danielle's real live-pricing
      // pass — previously MOCKUP ONLY, see FollowUpSeverityDialog.tsx).
      // Scuff and scratch repair is one service reachable from two checked
      // conditions ("Scuffs" and "Scratches") — if both are checked and
      // answered differently, heavy wins, since a pair that's heavy on
      // either front needs the more thorough repair either way.
      if (s.slug === "scuff-repair") {
        const scuffsAnswer = severityResultAnswers["Scuffs"];
        const scratchesAnswer = severityResultAnswers["Scratches"];
        const severity =
          scuffsAnswer === "heavy" || scratchesAnswer === "heavy" ? "heavy" : scuffsAnswer ?? scratchesAnswer;
        const live = (services ?? []).find((svc) => svc.slug === "scuff-repair");
        const variant = severity ? live?.variants.find((v) => v.key === severity) : undefined;
        if (variant) line.price = variant.standard * 100;
      }
      if (s.slug === "high-heel-tip-replacement") {
        const answer = severityResultAnswers[HEEL_TIP_CONDITION_LABEL];
        const live = (services ?? []).find((svc) => svc.slug === "high-heel-tip-replacement");
        const variant = answer ? live?.variants.find((v) => v.key === answer) : undefined;
        if (variant) line.price = variant.standard * 100;
      }
      lines.push(line);
    });

    const notOfferedCombined = resoleBlockedLabel
      ? [...result.notOffered, { slug: "full-resole", name: `Resole — ${resoleBlockedLabel}` }]
      : result.notOffered;

    setNotOffered(notOfferedCombined);
    setCartLines(lines);
    setStep("results");
  };

  const removeLine = (id: string) => setCartLines((prev) => prev.filter((l) => l.id !== id));

  const total = useMemo(() => cartLines.reduce((sum, l) => sum + l.price, 0), [cartLines]);

  // Required so either button below always has a pair to attach these
  // services to. isPairFilled is effectively always true by the results
  // screen (the pair-details step already gated it) — kept as a defensive
  // check rather than assumed, same spirit as the old comment here.
  const canFinalize = cartLines.length > 0 && isPairFilled;

  // Adds the current recommendation set to the bag under whichever pair is
  // active — creating a new saved pair first if one was typed rather than
  // picked. Shared by both buttons below (2026-07-27, Danielle's call: no
  // separate "Continue" step or confirmation screen — each button commits
  // this pair immediately and then does its own thing, no secondary page in
  // between).
  const commitPairToBag = (): boolean => {
    if (!canFinalize) return false;
    const items: BagService[] = cartLines.map((l) => ({
      id: l.id,
      name: l.name,
      price: l.price,
      ...(l.soleMaterial ? { soleMaterial: l.soleMaterial } : {}),
      ...(l.resoleBrand ? { resoleBrand: l.resoleBrand } : {}),
    }));

    let pair = selectedPairId ? getPair(selectedPairId) : undefined;
    if (!pair) {
      // Shoe-type/brand form is back (2026-08-29, Danielle's call) — this
      // time not for pricing, but so the checklist can gate resole/heel-tip
      // by shoe type and brand (see isResoleSupportedFor/isHeelTipEligible).
      // newPairShoeType is guaranteed set by the time we get here — the
      // pair-details step won't advance to the checklist without it.
      const resolvedBrand =
        newPairBrandMode === "unknown" ? undefined : newPairBrand.trim() || undefined;
      pair = addSavedPair({
        shoeType: (newPairShoeType || "Unspecified") as ShoeType,
        colors: newPairColors,
        brand: resolvedBrand,
        identifiers: newPairIdentifiers.trim() || undefined,
      });
      setSelectedPairId(pair.id);
    }

    trackEvent("service_added", { source: "starter_repair", item_count: items.length });
    addPairToBag(items, pair.id, formatPairLabel(pair), pair.shoeType, repairNotes.trim() || undefined);
    trackEvent("pair_confirmed", { shoe_type: pair.shoeType, source: selectedPairId ? "existing_pair" : "new_pair" });
    trackEvent("repair_added_to_bag", {
      value: items.reduce((sum, s) => sum + s.price, 0) / 100,
      currency: "USD",
      service_count: items.length,
    });
    // This pair's now real data in the bag, not an in-progress draft —
    // clear it so it can't resurrect stale checklist state on a later,
    // genuinely fresh visit to /start-repair.
    clearStartRepairDraft();
    return true;
  };

  // "Add another pair to my order" — commits this pair, then a genuine fresh
  // start for the next one: clears the pair selection/name, notes, and every
  // piece of checklist state so nothing carries over from the pair just
  // described.
  const onAddAnotherPair = () => {
    if (!commitPairToBag()) return;
    setSelectedPairId(null);
    setNewPairShoeType("");
    setNewPairBrandMode("");
    setNewPairBrand("");
    setNewPairColors([]);
    setNewPairIdentifiers("");
    setRepairNotes("");
    setCheckedLabels(new Set());
    setCheckedAddons(new Set());
    setCartLines([]);
    setNotOffered([]);
    // Back to "pair-details" (not "checklist") — a fresh pair needs its own
    // shoe type/brand identified before its own checklist gating can apply.
    setStep("pair-details");
  };

  const onGoToCheckout = () => {
    if (!commitPairToBag()) return;
    navigate("/checkout");
  };

  // Advances from the pair-details step to the checklist — the one place
  // pair identity is actually validated now (2026-08-29). Picking an
  // existing saved pair always passes (selectedPairId set); adding a new
  // one requires shoe type + brand (color/identifiers stay optional).
  const onPairDetailsContinue = () => {
    if (!isPairFilled) {
      setPairError(true);
      return;
    }
    setPairError(false);
    setStep("checklist");
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex flex-col bg-white">
        <Header />
        <section className="flex-1 flex items-center justify-center py-20">
          <BrandSpinner size="lg" />
        </section>
        <Footer />
      </main>
    );
  }

  // Restyled 2026-08-26 (Danielle's call) — cream page bg, Header theme=cream,
  // and the two page headings (h1/subtext) switched to amber Fraunces/
  // Instrument Sans, matching the rest of the site. The checklist tiles,
  // category pills, validation states, and buttons below are deliberately
  // left in their existing functional styling (selected/error/active states
  // rely on specific brand-color meaning, not just decoration) — recoloring
  // those wholesale risked breaking legibility on this page's more complex
  // interactive states, which she confirmed was an acceptable scope line
  // when asked.
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />
      <section className="flex-1 py-12 md:py-16">
        <div className={`container ${step === "checklist" ? "max-w-4xl" : "max-w-2xl"}`}>
          {step === "pair-details" ? (
            <>
              <h1
                className="text-3xl md:text-4xl uppercase"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
              >
                Which pair needs attention?
              </h1>
              <p className="mt-2" style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif", opacity: 0.85 }}>
                Tell us about this pair so we can match the right services
              </p>

              {showPairDropdown && (
                <div className="mt-6">
                  <label htmlFor="existing-pair-select" className="text-sm font-medium" style={{ color: "#7a5c40" }}>
                    Have a pair you've already told us about?
                  </label>
                  <select
                    id="existing-pair-select"
                    value={selectedPairId ?? ""}
                    onChange={(e) => {
                      setSelectedPairId(e.target.value || null);
                      setPairError(false);
                    }}
                    className="mt-1.5 block w-full text-sm rounded-md px-3 py-2 text-primary bg-white"
                    style={{ border: "1px solid hsl(var(--border))" }}
                  >
                    <option value="">Add a new pair</option>
                    {pairs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatPairLabel(p)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(isAddingNewPair || !showPairDropdown) && (
                <div className="mt-6 rounded-xl border border-border bg-white p-5 space-y-5">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#7a5c40" }}>
                      Shoe type <span style={{ color: "#a32d2d" }}>*</span>
                    </p>
                    {/* Tile format (2026-08-29, Danielle's call: "bigger and
                        more visual... big icon with text below it"), photo
                        now full-bleed with the label overlaid on a bottom
                        scrim (2026-09-01, Danielle's call) instead of a
                        small centered photo + text below — see
                        SHOE_TYPE_PHOTO above for the exact paths/filenames
                        still needed; ShoeTypeTile falls back to a camera
                        icon + label on amber until each one exists. */}
                    <div className="mt-1.5 grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {SHOE_TYPES.map((t) => (
                        <ShoeTypeTile
                          key={t}
                          shoeType={t}
                          selected={newPairShoeType === t}
                          onSelect={() => {
                            setNewPairShoeType(t);
                            setPairError(false);
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-1.5" style={{ color: "#7a5c40" }}>
                      Shoe brand <span style={{ color: "#a32d2d" }}>*</span>
                    </p>
                    <BrandCombobox
                      mode={newPairBrandMode}
                      value={newPairBrand}
                      onChange={(m, v) => {
                        setNewPairBrandMode(m);
                        setNewPairBrand(v);
                        setPairError(false);
                      }}
                    />
                  </div>

                  <div>
                    <p className="text-sm font-medium" style={{ color: "#7a5c40" }}>
                      Shoe color(s) <span className="font-normal" style={{ color: "#8a7a68" }}>(optional)</span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {PAIR_COLORS.map((c) => {
                        const selected = newPairColors.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            aria-pressed={selected}
                            onClick={() =>
                              setNewPairColors((prev) =>
                                prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                              )
                            }
                            className="px-3 py-1.5 rounded-full text-sm border transition-colors"
                            style={{
                              backgroundColor: selected ? "#fff5cc" : "#fff",
                              color: "#3d1700",
                              borderColor: selected ? "#3d1700" : "hsl(var(--border))",
                              borderWidth: selected ? 2 : 1,
                            }}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="pair-identifiers" className="text-sm font-medium" style={{ color: "#7a5c40" }}>
                      Additional identifiers <span className="font-normal" style={{ color: "#8a7a68" }}>(optional)</span>
                    </label>
                    <p className="text-xs mt-0.5 mb-1.5" style={{ color: "#8a7a68" }}>
                      If you're sending in multiple similar pairs (e.g. 2 black ballet flats),
                      additional identifiers can be helpful in determining which service should apply
                      to which shoe.
                    </p>
                    <input
                      id="pair-identifiers"
                      type="text"
                      value={newPairIdentifiers}
                      onChange={(e) => setNewPairIdentifiers(e.target.value)}
                      placeholder="e.g. gold buckle"
                      className="text-sm rounded-md px-3 py-2 text-primary w-full"
                      style={{ border: "1px solid hsl(var(--border))" }}
                    />
                  </div>

                  {/* Resole-unsupported flag (2026-09-01, Danielle's call) —
                      surfaces the same isResoleSupportedFor check the
                      checklist tile already grays out for, but right here at
                      shoe-type/brand selection instead of one step later, so
                      customers with Sneakers, Louboutin, Margiela, or Golden
                      Goose know upfront. Doesn't block anything — every
                      other repair is still fully available for these, only
                      full-resole isn't. */}
                  {!resoleSupported && (activeShoeType || activeBrand) && (
                    <p
                      className="text-xs rounded-md px-3 py-2"
                      style={{ backgroundColor: "#fff5cc", color: "#3d1700" }}
                    >
                      Full resoles aren't currently offered for{" "}
                      {[activeShoeType, activeBrand].filter(Boolean).join(" · ")} — every other repair
                      is still available.
                    </p>
                  )}
                </div>
              )}

              {pairError && !isPairFilled && (
                <p className="text-xs mt-2 font-medium" style={{ color: "#a32d2d" }}>
                  Pick a shoe type and brand before continuing — each repair is for one pair of shoes.
                </p>
              )}

              <div className="mt-6 flex items-center justify-end gap-4">
                <Button type="button" size="lg" variant="hero" onClick={onPairDetailsContinue}>
                  Next
                </Button>
              </div>
            </>
          ) : step === "checklist" ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1
                    className="text-3xl md:text-4xl uppercase"
                    style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
                  >
                    What needs attention?
                  </h1>
                  <p className="mt-2" style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif", opacity: 0.85 }}>
                    Select everything that applies and we'll recommend the right services.
                  </p>
                </div>
                {/* Photo-flow entry point — a wide, short card, far-right
                    aligned in the header row (2026-07-27, Danielle's call:
                    the earlier square version was taller than the H1 +
                    subtext block next to it, pushing the category pills
                    down). Icon-left/text-right instead of icon-on-top/text-
                    below keeps its height in line with the header instead of
                    growing with wrapped text. Kept deliberately quiet
                    relative to the checklist itself — still a secondary
                    path, not competing with it. */}
                <Link
                  to="/start-repair/assessment"
                  state={{ requestedConditions: requestedConditionLabels }}
                  onClick={() => trackEvent("start_repair", { source: "starter_repair_photo_callout" })}
                  className="flex items-center gap-2.5 w-64 shrink-0 rounded-lg px-3 py-2.5 transition-colors hover:opacity-90 shadow-soft"
                  style={{ backgroundColor: "#fdb600" }}
                >
                  <span
                    className="flex items-center justify-center h-8 w-8 rounded-md shrink-0"
                    style={{ backgroundColor: "#fff5cc" }}
                  >
                    <Camera size={16} style={{ color: "#fdb600" }} />
                  </span>
                  {/* Brown text (2026-08-27, Danielle's call) — same
                      brown-on-amber standout treatment as the condition
                      tiles below. */}
                  <span className="text-[11px] leading-snug text-left" style={{ color: "#3d1700" }}>
                    <strong className="font-semibold">Not sure?</strong> Send a photo or video and we'll recommend.
                  </span>
                </Link>
              </div>

              {/* Which-pair summary (rebuilt 2026-08-29, Danielle's call) —
                  the pair itself is now identified on its own required step
                  before the checklist is ever reachable (see step ===
                  "pair-details" below), so this is just a read-only recap
                  with a way back to change it — not an editable field with
                  its own validation anymore. */}
              {/* Small label above the recap (2026-09-01, Danielle's call —
                  "Pair details," matching the terminology used everywhere
                  else this concept shows up (the "pairs" table, PairsContext,
                  "This pair," "Which pair needs attention?") rather than
                  introducing a new term like "Shoe details" for the same
                  thing). Without it the recap line read as an orphaned bit
                  of text with no label, unlike every other field on this
                  page. */}
              <div className="mt-6">
                <p className="text-sm font-medium" style={{ color: "#7a5c40" }}>
                  Pair details
                </p>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-sm" style={{ color: "#7a5c40" }}>
                    {activePairSummary || "This pair"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep("pair-details")}
                    className="text-xs font-medium underline hover:opacity-80"
                    style={{ color: "#fdb600" }}
                  >
                    Change pair
                  </button>
                </div>
              </div>

              {/* Category slider — switched from a horizontally-scrolling row
                  to a wrapping grid (2026-07-23, Danielle's call): "Cleaning &
                  odor" was falling off the right edge, forcing a scroll to
                  see it, which she doesn't want at all.

                  Take 2 on spacing (2026-08-27, Danielle's call) — take 1
                  switched to content-sized flex items with a fixed gap,
                  reasoning that equal-width stretched columns made the gap
                  LOOK uneven since labels filled their box by different
                  amounts. She came back with the opposite ask: she wants the
                  ICONS evenly spaced from each other and every tab's box the
                  same size — which content-sized items can't guarantee either
                  (box width varies with label length, so icon-to-icon
                  distance varies too). Fixed-width grid columns (84px, not
                  auto-fit/1fr stretching to fill the container) solve both at
                  once: every box is identically sized, and since each icon is
                  centered in its box, a constant gap between boxes means a
                  constant gap between icons too — regardless of label length.
                  Bumped the gap up from the old 6px to 24px for the more
                  spread-out feel she asked for. Auto-fill (not auto-fit)
                  still wraps onto additional rows instead of ever requiring
                  horizontal scroll; unlike take-1's stretch approach, the row
                  just doesn't force itself to span the full container width
                  anymore, which is fine since the columns are a fixed size
                  by design now. */}
              <div
                role="tablist"
                aria-label="Checklist categories"
                className="mt-8 grid gap-6"
                style={{ gridTemplateColumns: "repeat(auto-fill, 84px)" }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeChecklistCategory === "All"}
                  onClick={() => setActiveChecklistCategory("All")}
                  className="flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl text-[11px] font-medium text-center transition-colors w-full hover:opacity-80"
                  style={{ color: "#3d1700" }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "block",
                      width: 20,
                      height: 20,
                      backgroundColor: "#3d1700",
                      WebkitMaskImage: `url(${CATEGORY_ICONS["All services"]})`,
                      maskImage: `url(${CATEGORY_ICONS["All services"]})`,
                      WebkitMaskSize: "contain",
                      maskSize: "contain",
                      WebkitMaskRepeat: "no-repeat",
                      maskRepeat: "no-repeat",
                      WebkitMaskPosition: "center",
                      maskPosition: "center",
                    }}
                  />
                  <span
                    className="leading-snug max-w-[78px]"
                    style={activeChecklistCategory === "All" ? { borderBottom: "2px solid #3d1700", paddingBottom: 1 } : undefined}
                  >
                    All
                  </span>
                </button>
                {CHECKLIST_GROUPS.map((group) => {
                  const cat = group.serviceCategory;
                  const isActive = activeChecklistCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveChecklistCategory(cat)}
                      className="flex flex-col items-center gap-1 px-1 py-2.5 rounded-xl text-[11px] font-medium text-center transition-colors w-full hover:opacity-80"
                      style={{ color: "#3d1700" }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          display: "block",
                          width: 20,
                          height: 20,
                          backgroundColor: "#3d1700",
                          WebkitMaskImage: `url(${CATEGORY_ICONS[cat]})`,
                          maskImage: `url(${CATEGORY_ICONS[cat]})`,
                          WebkitMaskSize: "contain",
                          maskSize: "contain",
                          WebkitMaskRepeat: "no-repeat",
                          maskRepeat: "no-repeat",
                          WebkitMaskPosition: "center",
                          maskPosition: "center",
                        }}
                      />
                      <span
                        className="leading-snug max-w-[78px]"
                        style={isActive ? { borderBottom: "2px solid #3d1700", paddingBottom: 1 } : undefined}
                      >
                        {categoryDisplayLabel(cat)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {conditionsError && !anyChecked && (
                <p className="text-xs mt-4 font-medium" style={{ color: "#a32d2d" }}>
                  Check at least one condition (or add-on below) before continuing.
                </p>
              )}
              {/* Photo-forward tile grid — flat, no category headers, even for
                  "All" (see visibleConditions above for why). */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3" id="condition-tiles">
                {visibleConditions.map(renderConditionTile)}
              </div>

              <div className="mt-8 pt-6 border-t border-border">
                {/* Renamed back to "Add-ons" 2026-08-13 (Danielle's call) —
                    Waterproofing and Protective soles are archived for launch
                    (MVP scope-down), leaving only Shoe shine here, so
                    "Preventative care" no longer fits (a shoe shine isn't
                    really preventative). No subheader this time either —
                    with a single item the "Make your shoes last longer" line
                    read as unnecessary. Prices shown here come from the live
                    catalog (serviceBySlug/cardPriceLabel) so they can never
                    drift from what's shown on the service's own card/detail
                    page. */}
                <p className="text-sm font-semibold text-primary mb-3">Add-ons</p>
                {/* Grid instead of flex-wrap (2026-07-22, Danielle's call:
                    "evenly spaced") — flex-wrap let each item's width follow
                    its own text length, so the three columns didn't line up.
                    Equal-width grid columns match the pattern already used
                    by CategoryFilterBar. */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                  {ADDONS.map((addon) => {
                    const id = `addon-${addon.slug}`;
                    // Strips a trailing "per pair" (same pattern as
                    // ServiceDetail.tsx's displayPrice) — redundant here,
                    // Danielle's call (2026-07-27): every add-on is obviously
                    // priced per pair already.
                    const price = services?.find((s) => s.slug === addon.slug)?.cardPriceLabel
                      ?.replace(/\s+per\s+\S.*/i, "")
                      .trim();
                    return (
                      <label key={addon.slug} htmlFor={id} className="flex items-start gap-2 text-sm text-primary/90 cursor-pointer">
                        <Checkbox
                          id={id}
                          checked={checkedAddons.has(addon.slug)}
                          onCheckedChange={() => toggleAddon(addon.slug)}
                          className="mt-0.5"
                        />
                        <span>
                          {addon.label}
                          {price && <span className="ml-1.5 text-[12px] text-muted-foreground">{price}</span>}
                          <span className="block text-[12px] text-muted-foreground">{addon.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* No "skip / browse all services" escape hatch here on purpose
                  (Danielle's call, 2026-07-16) — the checklist is meant to be
                  the primary path, not something to route people around, and
                  anyone who wants the full catalog can already reach /services
                  directly (nav, a service link, etc.) without this page
                  pointing them there. */}
              {/* "Next" (2026-08-27, Danielle's call, confirmed) — was "See
                  my recommendations," renamed since a click here doesn't
                  always go straight to recommendations anymore: it may land
                  on a sole/insole, resole, or severity follow-up question
                  first. "Next" reads correctly either way. */}
              <div className="mt-6 flex items-center justify-end gap-4">
                <Button
                  type="button"
                  size="lg"
                  variant="hero"
                  onClick={onSeeRecommendationsClick}
                >
                  Next
                </Button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("checklist")}
                className="text-sm text-muted-foreground hover:text-primary mb-6"
              >
                ← Back to checklist
              </button>
              <h1
                className="text-3xl md:text-4xl uppercase"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
              >
                Here's what we recommend
              </h1>

              {notOffered.length > 0 && (
                <div className="mt-6 flex flex-col gap-3">
                  {notOffered.map((s) => (
                    <div key={s.slug} className="rounded-lg border p-3 text-sm" style={{ borderColor: "#fecaca", backgroundColor: "#fef2f2", color: "#991b1b" }}>
                      <strong>{s.name} isn't offered yet.</strong> We don't currently support this repair at launch — we'll follow up by email as soon as we do.
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3">
                {cartLines.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6">
                    Nothing left to add — go back to the checklist to select something.
                  </p>
                ) : (
                  cartLines.map((line) => (
                    <div key={line.id} className="rounded-lg border border-border p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        {line.addresses.length > 0 && (
                          <p className="text-xs text-muted-foreground mb-1">
                            Fixes: {line.addresses.join(", ").toLowerCase()}
                          </p>
                        )}
                        <p className="font-medium text-primary">
                          {line.name}
                          {line.kind === "package" && <span className="ml-2 text-xs font-medium text-muted-foreground">(package)</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-medium text-primary">{formatPrice(line.price)}</span>
                        <button
                          type="button"
                          onClick={() => removeLine(line.id)}
                          aria-label={`Remove ${line.name}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estimated total</span>
                <span className="text-xl font-semibold text-primary">{formatPrice(total)}</span>
              </div>

              {/* Notes for this repair (2026-07-27, Danielle's call) — moved
                  here from the old PairFlowDialog "describe this pair" step,
                  now that this page is where a repair actually gets
                  committed. Free-form; resets whenever a fresh pair is
                  started (see onAddAnotherPair). */}
              <div className="mt-6">
                <label htmlFor="repair-notes" className="text-sm font-medium text-primary">
                  Notes for this repair
                </label>
                <Textarea
                  id="repair-notes"
                  value={repairNotes}
                  onChange={(e) => setRepairNotes(e.target.value)}
                  placeholder="Anything specific you'd like us to pay attention to?"
                  rows={4}
                  className="mt-1.5"
                />
              </div>

              {/* "Browse full services list" removed 2026-07-27 (Danielle's
                  call) — she doesn't want to route customers to /services
                  from here at all: they can already get back via "Back to
                  checklist" above, and the services page uses catalog
                  terminology that doesn't match how customers describe their
                  own problem. The only reason it was here was to let people
                  see pricing, which she's now reconsidering more broadly
                  (possibly folding pricing into this flow directly and
                  dropping /services entirely) — not decided yet, so /services
                  itself stays as-is for now.

                  Two buttons instead of one "Continue" (2026-07-27,
                  Danielle's call) — no separate confirmation screen either:
                  each button commits this pair to the bag (see
                  commitPairToBag) and then does its own thing directly, never
                  a secondary page in between. */}
              <div className="mt-8 flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={onAddAnotherPair}
                  disabled={!canFinalize}
                  className={!canFinalize ? "opacity-50 cursor-not-allowed" : ""}
                  style={{ borderColor: "#fdb600", color: "#fdb600" }}
                >
                  Add another pair to my order
                </Button>
                <Button
                  type="button"
                  variant="hero"
                  size="lg"
                  onClick={onGoToCheckout}
                  disabled={!canFinalize}
                  className={!canFinalize ? "opacity-50 cursor-not-allowed" : ""}
                >
                  Go to checkout
                </Button>
                {!canFinalize && (
                  <p className="text-xs text-muted-foreground text-center">
                    {cartLines.length > 0
                      ? "Name this pair on the checklist to continue."
                      : "Select at least one condition on the checklist to continue."}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
      <Footer />

      {/* Back-navigation (2026-09-02, Danielle's ask) — each dialog below
          only gets onBack when followUpIndex > 0, i.e. it isn't the first
          question in the chain. onOpenChange is the same
          handleFollowUpOpenChange for all three: it only cancels the whole
          sequence on a genuine close (X/Cancel/Escape), not the dialog's
          own auto-close-after-confirm — see that handler's comment above. */}
      <SoleInsoleConditionDialog
        open={soleInsoleOpen}
        onOpenChange={handleFollowUpOpenChange}
        showSole={needsSoleQuestion}
        showInsole={needsInsoleQuestion}
        onConfirm={onSoleInsoleConfirm}
        initialAnswers={soleInsoleAnswers}
        onBack={followUpIndex > 0 ? goBackFollowUp : undefined}
      />

      <SoleSelectionDialog
        open={resoleOpen}
        onOpenChange={handleFollowUpOpenChange}
        onConfirm={onSoleSelectionConfirm}
        onBack={followUpIndex > 0 ? goBackFollowUp : undefined}
        requestedConditions={requestedConditionLabels}
      />

      {/* MOCKUP ONLY — see FollowUpSeverityDialog.tsx. Runs after the two
          dialogs above, in SEVERITY_QUESTIONS' fixed order, one question at
          a time (see followUpSteps above). */}
      <FollowUpSeverityDialog
        open={severityOpen}
        onOpenChange={handleFollowUpOpenChange}
        question={currentSeverityQuestion}
        onConfirm={onSeverityConfirm}
        onBack={followUpIndex > 0 ? goBackFollowUp : undefined}
        requestedConditions={requestedConditionLabels}
      />
    </main>
  );
};

export default StartRepair;
