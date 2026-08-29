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
import type { ShoeType } from "@/types/service";
import { resolePriceForKey, type ResolePriceKey } from "@/types/service";
import { CHECKLIST_GROUPS, ADDONS, computeRecommendation, COMMON_CONDITION_LABELS, SLUG_TO_CONDITION_LABELS } from "@/data/starterRepairConditions";
import { CATEGORY_ICONS, categoryDisplayLabel } from "@/components/cobbli/CategoryFilterBar";
import BeforeAfterImage from "@/components/cobbli/BeforeAfterImage";
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

  // Which-pair field (2026-07-27, Danielle's call): a dropdown of saved pairs
  // only makes sense for a signed-in customer who actually has any — a guest
  // never has saved pairs, so they go straight to the free-text "new pair"
  // field with no dropdown to show at all. Signed-in customers with saved
  // pairs get the dropdown, with "Add a new pair" swapping it for the same
  // text field.
  const showPairDropdown = !!user && pairs.length > 0;
  const isAddingNewPair = selectedPairId === null;
  const [newPairName, setNewPairName] = useState("");

  // Red validation state for the pair field (2026-07-29, Danielle's call):
  // customers were reaching the recommendations screen without naming a
  // pair, then hitting a quietly-disabled checkout button with no clear
  // reason why. Since a repair is always one-pair-at-a-time, the pair field
  // is now a hard gate on "See my recommendations" itself — not just
  // checkout — and failing that gate flags the field red right where the
  // customer is looking, instead of a muted note they'd have to go find.
  const [pairError, setPairError] = useState(false);
  const isPairFilled = selectedPairId !== null || newPairName.trim().length > 0;

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

  const [step, setStep] = useState<"checklist" | "results">("checklist");
  const [checkedLabels, setCheckedLabels] = useState<Set<string>>(new Set());
  const [checkedAddons, setCheckedAddons] = useState<Set<string>>(new Set());
  const [notOffered, setNotOffered] = useState<{ slug: string; name: string }[]>([]);
  const [cartLines, setCartLines] = useState<CartLine[]>([]);

  // Gates "See my recommendations" when the checklist can't tell on its own
  // which service to recommend — "Sole separating from shoe" and "Loose or
  // detached insole" both cover a still-good part that just needs regluing
  // *and* a worn-out one that needs replacing, and the right service differs
  // (gluing vs. full-resole / insole-replacement). Only the question(s)
  // matching a checked condition are shown (2026-07-28, Danielle's call).
  const [soleInsoleOpen, setSoleInsoleOpen] = useState(false);
  const needsSoleQuestion = checkedLabels.has(SOLE_CONDITION_LABEL);
  const needsInsoleQuestion = checkedLabels.has(INSOLE_CONDITION_LABEL);

  // Resole brand/sole-type follow-up (2026-08-11, Danielle's call) — gates
  // "See my recommendations" the same way the sole/insole question above
  // does, whenever "Worn or damaged sole" is checked, since full-resole's
  // price (and whether it's even offered for this pair) now depends on the
  // answer. Runs after the sole/insole question when both apply — see
  // onSoleInsoleConfirm — so pendingSoleInsoleAnswers holds that answer while
  // this one is being asked.
  const [soleSelectionOpen, setSoleSelectionOpen] = useState(false);
  const needsResoleQuestion = checkedLabels.has(RESOLE_CONDITION_LABEL);
  const [pendingSoleInsoleAnswers, setPendingSoleInsoleAnswers] = useState<{
    sole?: SoleInsoleAction;
    insole?: SoleInsoleAction;
  }>({});

  // Severity follow-up questions — MOCKUP ONLY, not wired to pricing yet
  // (2026-08-27, Danielle's ask: "mock this up before wiring it"). Runs
  // strictly after the existing sole/insole + resole chain above, so it
  // never disturbs that logic — see proceedPastSoleFlow(), which every
  // former direct seeRecommendations(...) call site now goes through
  // instead. When more than one checked condition needs a follow-up
  // (e.g. both "Stains" and "Scuffs"), they're asked one at a time in
  // SEVERITY_QUESTIONS' own order (Stains, Scuffs, Scratches, then Worn
  // or missing heel tip) — the same category order the checklist itself
  // already uses everywhere else in the app.
  const [severityQueue, setSeverityQueue] = useState<SeverityQuestion[]>([]);
  const [severityOpen, setSeverityOpen] = useState(false);
  // Captured per condition (e.g. { Stains: "heavy" }) for future wiring —
  // not read by seeRecommendations() yet, see FollowUpSeverityDialog.tsx.
  const [severityAnswers, setSeverityAnswers] = useState<Record<string, string>>({});
  // Holds the sole/insole + resole answers while the severity queue runs,
  // so the real seeRecommendations() call at the end of the queue still
  // gets them — same stash pattern as pendingSoleInsoleAnswers above.
  const [pendingFinalAnswers, setPendingFinalAnswers] = useState<{
    answers: { sole?: SoleInsoleAction; insole?: SoleInsoleAction };
    resoleAnswer?: SoleSelectionResult;
  }>({ answers: {} });

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

  useEffect(() => {
    // Switching to an existing saved pair means whatever was typed for a new
    // pair no longer applies — clear it so it can't get sent along by mistake.
    if (selectedPairId) setNewPairName("");
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
      return sortImagesFirst(sortCommonFirst(flat));
    }
    const group = CHECKLIST_GROUPS.find((g) => g.serviceCategory === activeChecklistCategory);
    if (!group) return [];
    return sortImagesFirst(
      sortCommonFirst(
        group.conditions.map((cond, idx) => ({
          ...cond,
          category: group.serviceCategory,
          id: `cond-${group.serviceCategory}-${cond.slug}-${idx}`,
        })),
      ),
    );
  }, [activeChecklistCategory, serviceBySlug]);

  const renderConditionTile = (cond: {
    label: string;
    slug: string;
    imageUrl?: string;
    afterImageUrl?: string;
    category: (typeof CHECKLIST_GROUPS)[number]["serviceCategory"];
    id: string;
  }) => {
    const isChecked = checkedLabels.has(cond.label);
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
        className="flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all"
        style={{
          backgroundColor: "#fdb600",
          border: isChecked ? "3px solid #3d1700" : "3px solid transparent",
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
              style={{ backgroundColor: "#3d1700" }}
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
              onCheckedChange={() => toggleCondition(cond.label)}
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
          {serviceBySlug.get(cond.slug)?.cardPriceLabel && (
            <p className="text-[13px] font-bold pt-0.5 mt-auto" style={{ color: "#3d1700" }}>
              {serviceBySlug.get(cond.slug)!.cardPriceLabel.replace(/\s+per\s+\S.*/i, "").trim()}
            </p>
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

  // Entry point for the "See my recommendations" button — routes through the
  // sole/insole follow-up, then the resole brand/sole-type follow-up, only
  // when each is actually needed, since the recommendation itself depends on
  // the answer(s). The two follow-ups are independent (different conditions),
  // so they're shown one at a time rather than together.
  const onSeeRecommendationsClick = () => {
    if (!services) return;
    // Both requirements validated together (not one-at-a-time) so a customer
    // missing both sees both flagged on the first click, not just the first
    // one — then scroll to whichever comes first on the page (the pair field
    // sits above the checklist) so there's still one clear next step.
    const pairMissing = !isPairFilled;
    const conditionsMissing = !anyChecked;
    setPairError(pairMissing);
    setConditionsError(conditionsMissing);
    if (pairMissing) {
      document.getElementById("pair-field")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (conditionsMissing) {
      document.getElementById("condition-tiles")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (needsSoleQuestion || needsInsoleQuestion) {
      setSoleInsoleOpen(true);
      return;
    }
    if (needsResoleQuestion) {
      setSoleSelectionOpen(true);
      return;
    }
    proceedPastSoleFlow({});
  };

  // Sole/insole confirmed — chain into the resole question if this pair also
  // needs it, rather than computing recommendations twice.
  const onSoleInsoleConfirm = (answers: { sole?: SoleInsoleAction; insole?: SoleInsoleAction }) => {
    if (needsResoleQuestion) {
      setPendingSoleInsoleAnswers(answers);
      setSoleSelectionOpen(true);
      return;
    }
    proceedPastSoleFlow(answers);
  };

  const onSoleSelectionConfirm = (result: SoleSelectionResult) => {
    proceedPastSoleFlow(pendingSoleInsoleAnswers, result);
    setPendingSoleInsoleAnswers({});
  };

  // Severity mockup queue — MOCKUP ONLY, see the state comment above and
  // FollowUpSeverityDialog.tsx. Every path that used to call
  // seeRecommendations(...) directly now calls this instead: if this pair
  // has any checked condition with a severity question (Stains, Scuffs,
  // Scratches, or Worn or missing heel tip), it's asked here, one at a
  // time, before the real recommendation is computed. If none apply, this
  // is a same-tick passthrough to seeRecommendations — no behavior change
  // for pairs that don't touch any of the four conditions.
  const buildSeverityQueue = (): SeverityQuestion[] =>
    SEVERITY_QUESTIONS.filter((q) => checkedLabels.has(q.conditionLabel));

  const proceedPastSoleFlow = (
    answers: { sole?: SoleInsoleAction; insole?: SoleInsoleAction },
    resoleAnswer?: SoleSelectionResult,
  ) => {
    const queue = buildSeverityQueue();
    if (queue.length > 0) {
      setSeverityAnswers({});
      setSeverityQueue(queue);
      setPendingFinalAnswers({ answers, resoleAnswer });
      setSeverityOpen(true);
      return;
    }
    seeRecommendations(answers, resoleAnswer);
  };

  const onSeverityConfirm = (conditionLabel: string, optionKey: string) => {
    trackEvent("severity_question_answered", { condition: conditionLabel, option: optionKey });
    const nextAnswers = { ...severityAnswers, [conditionLabel]: optionKey };
    setSeverityAnswers(nextAnswers);
    const remaining = severityQueue.slice(1);
    if (remaining.length > 0) {
      // Dialog stays open — swapping severityQueue[0] moves it to the next
      // question in the queue.
      setSeverityQueue(remaining);
      return;
    }
    setSeverityQueue([]);
    setSeverityOpen(false);
    seeRecommendations(pendingFinalAnswers.answers, pendingFinalAnswers.resoleAnswer);
  };

  const seeRecommendations = (
    answers: { sole?: SoleInsoleAction; insole?: SoleInsoleAction },
    resoleAnswer?: SoleSelectionResult,
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
  // services to — either an existing selected pair, or a name typed into the
  // new-pair field.
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
      // No shoe-type/color/brand form anymore (Danielle's call, 2026-07-15)
      // — pricing doesn't depend on them, so "Unspecified"/empty here is a
      // safe, inert default rather than forcing a choice that doesn't matter.
      pair = addSavedPair({
        shoeType: "Unspecified" as ShoeType,
        colors: [],
        brand: undefined,
        description: newPairName.trim(),
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
    return true;
  };

  // "Add another pair to my order" — commits this pair, then a genuine fresh
  // start for the next one: clears the pair selection/name, notes, and every
  // piece of checklist state so nothing carries over from the pair just
  // described.
  const onAddAnotherPair = () => {
    if (!commitPairToBag()) return;
    setSelectedPairId(null);
    setNewPairName("");
    setRepairNotes("");
    setCheckedLabels(new Set());
    setCheckedAddons(new Set());
    setCartLines([]);
    setNotOffered([]);
    setStep("checklist");
  };

  const onGoToCheckout = () => {
    if (!commitPairToBag()) return;
    navigate("/checkout");
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
          {step === "checklist" ? (
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

              {/* Which-pair field (2026-07-27, Danielle's call) — replaced
                  the old static "Adding more services for: X" label sitting
                  next to a dropdown that showed the exact same name a second
                  time. Now there's exactly one control: the dropdown when
                  there's a saved pair to show (signed-in, has saved pairs),
                  or the free-text field in its place otherwise — never both
                  showing the same pair's name at once. Picking a different
                  saved pair, or switching to "Add a new pair," re-triggers
                  the checked-labels effect above so the checklist reloads
                  that pair's own existing selections instead of carrying
                  over whatever was checked for the last one. Sits below the
                  H1/subtext and above the category pills (2026-07-27,
                  Danielle's call) rather than above the H1. */}
              <div className="mt-6" id="pair-field">
                <p className="text-sm font-medium" style={{ color: "#7a5c40" }}>
                  Which pair needs attention? <span style={{ color: "#a32d2d" }}>*</span>
                </p>
                {/* Helper text added 2026-08-27 (Danielle's call) — the point
                    isn't just "give this pair a name," it's that if someone
                    sends in more than one pair, this description is what
                    tells them apart later (in the bag, at checkout, in their
                    account) — that wasn't obvious from the label/placeholder
                    alone. */}
                <p className="text-xs mt-0.5 mb-1.5" style={{ color: "#8a7a68" }}>
                  Describe your shoes so we can match the right services to them and tell your pairs
                  apart if you're sending in more than one.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {showPairDropdown && (
                    <select
                      aria-label="Which pair needs attention?"
                      aria-invalid={pairError && !isPairFilled}
                      value={selectedPairId ?? ""}
                      onChange={(e) => {
                        setSelectedPairId(e.target.value || null);
                        setPairError(false);
                      }}
                      className="text-sm rounded-md px-3 py-2 text-primary bg-white"
                      style={{ border: pairError && !isPairFilled ? "1.5px solid #a32d2d" : "1px solid hsl(var(--border))" }}
                    >
                      <option value="">Add a new pair</option>
                      {pairs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {formatPairLabel(p)}
                        </option>
                      ))}
                    </select>
                  )}
                  {/* Guard added 2026-08-27 — falls back to the free-text
                      field whenever there's no dropdown to show at all
                      (`!showPairDropdown`), not just when isAddingNewPair is
                      true. Without this, a selectedPairId carried over from
                      elsewhere (e.g. arriving via a service's "Start a
                      repair") while `pairs` hasn't loaded yet (or is
                      genuinely empty) left neither control rendering — the
                      "Which pair needs attention?" label with nothing
                      underneath it Danielle flagged. */}
                  {(isAddingNewPair || !showPairDropdown) && (
                    <input
                      type="text"
                      aria-invalid={pairError && !isPairFilled}
                      value={newPairName}
                      onChange={(e) => {
                        setNewPairName(e.target.value);
                        if (e.target.value.trim().length > 0) setPairError(false);
                      }}
                      placeholder="e.g. Black loafers"
                      className="text-sm rounded-md px-3 py-2 text-primary flex-1 min-w-[200px]"
                      style={{ border: pairError && !isPairFilled ? "1.5px solid #a32d2d" : "1px solid hsl(var(--border))" }}
                    />
                  )}
                </div>
                {pairError && !isPairFilled ? (
                  <p className="text-xs mt-1.5 font-medium" style={{ color: "#a32d2d" }}>
                    Tell us which pair this is for before continuing — each repair is for one pair of shoes.
                  </p>
                ) : (
                  isAddingNewPair && (
                    <p className="text-xs mt-1.5" style={{ color: "#8a7a68" }}>
                      Add shoe details to help us match services when you send in multiple pairs.
                    </p>
                  )
                )}
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
              <div className="mt-6 flex items-center justify-end gap-4">
                <Button
                  type="button"
                  size="lg"
                  variant="hero"
                  onClick={onSeeRecommendationsClick}
                >
                  See my recommendations
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

      <SoleInsoleConditionDialog
        open={soleInsoleOpen}
        onOpenChange={setSoleInsoleOpen}
        showSole={needsSoleQuestion}
        showInsole={needsInsoleQuestion}
        onConfirm={onSoleInsoleConfirm}
      />

      <SoleSelectionDialog
        open={soleSelectionOpen}
        onOpenChange={setSoleSelectionOpen}
        resoleService={(services ?? []).find((s) => s.slug === "full-resole") ?? null}
        onConfirm={onSoleSelectionConfirm}
      />

      {/* MOCKUP ONLY — see FollowUpSeverityDialog.tsx and proceedPastSoleFlow
          above. Runs after the two dialogs above, in SEVERITY_QUESTIONS'
          fixed order, one question at a time. */}
      <FollowUpSeverityDialog
        open={severityOpen}
        onOpenChange={setSeverityOpen}
        question={severityQueue[0] ?? null}
        onConfirm={onSeverityConfirm}
      />
    </main>
  );
};

export default StartRepair;
