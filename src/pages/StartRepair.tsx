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
import { X, Camera } from "lucide-react";
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
    const isCommon = COMMON_CONDITION_LABELS.includes(cond.label);
    return (
      <label
        key={cond.id}
        htmlFor={cond.id}
        className="flex flex-col rounded-xl border overflow-hidden cursor-pointer transition-colors"
        style={{
          borderColor: isChecked ? "#3d1700" : "#e8e0d0",
          borderWidth: isChecked ? 2 : 1,
          backgroundColor: isChecked ? "#fff5cc" : "#fff",
        }}
      >
        <div className="relative">
          <BeforeAfterImage
            before={
              serviceBySlug.get(cond.slug)?.imageUrl ??
              cond.imageUrl ??
              CATEGORY_ICONS[cond.category]
            }
            after={serviceBySlug.get(cond.slug)?.afterImageUrl ?? cond.afterImageUrl}
            alt=""
            className="aspect-square w-full object-cover"
            style={{ backgroundColor: "#f5f0e8" }}
          />
          {/* "Common" tag (2026-07-23, Danielle's call) — same visual
              treatment as the "Popular" tag on ServiceCard, but labeled
              differently on purpose: a problem someone's dealing with isn't
              "popular," it's just something we see often. */}
          {isCommon && (
            <span
              className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
            >
              Common
            </span>
          )}
          <Checkbox
            id={cond.id}
            checked={isChecked}
            onCheckedChange={() => toggleCondition(cond.label)}
            className="absolute top-2 right-2 bg-white/90"
          />
        </div>
        <span className="text-[13px] font-medium text-primary/90 px-2.5 py-2 leading-snug">{cond.label}</span>
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
    seeRecommendations({});
  };

  // Sole/insole confirmed — chain into the resole question if this pair also
  // needs it, rather than computing recommendations twice.
  const onSoleInsoleConfirm = (answers: { sole?: SoleInsoleAction; insole?: SoleInsoleAction }) => {
    if (needsResoleQuestion) {
      setPendingSoleInsoleAnswers(answers);
      setSoleSelectionOpen(true);
      return;
    }
    seeRecommendations(answers);
  };

  const onSoleSelectionConfirm = (result: SoleSelectionResult) => {
    seeRecommendations(pendingSoleInsoleAnswers, result);
    setPendingSoleInsoleAnswers({});
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
      <main className="min-h-screen bg-white flex flex-col">
        <Header />
        <section className="flex-1 flex items-center justify-center py-20">
          <BrandSpinner size="lg" />
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <section className="flex-1 py-12 md:py-16">
        <div className={`container ${step === "checklist" ? "max-w-4xl" : "max-w-2xl"}`}>
          {step === "checklist" ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-3xl md:text-4xl text-primary">What needs attention?</h1>
                  <p className="mt-2 text-primary/80">
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
                  className="flex items-center gap-2.5 w-64 shrink-0 rounded-lg border border-border px-3 py-2.5 hover:border-primary/40 transition-colors"
                >
                  <span
                    className="flex items-center justify-center h-8 w-8 rounded-md shrink-0"
                    style={{ backgroundColor: "#f5f0e8" }}
                  >
                    <Camera size={16} className="text-[#7a5c40]" />
                  </span>
                  <span className="text-[11px] leading-snug text-primary/80 text-left">
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
                <p className="text-sm font-medium mb-1.5" style={{ color: "#7a5c40" }}>
                  Which pair needs attention? <span style={{ color: "#a32d2d" }}>*</span>
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
                  {isAddingNewPair && (
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
                  see it, which she doesn't want at all. Same fixed-width
                  auto-fit column technique already used by CategoryFilterBar's
                  non-scrollable mode — every button is the same width
                  regardless of label length, labels wrap onto a second line
                  within that width instead of forcing the button wider, and
                  the whole row wraps onto a second line of its own once
                  columns stop fitting (e.g. on a narrower window), rather
                  than ever requiring horizontal scroll.

                  Column min-width/gap/padding tightened 2026-07-27 (Danielle's
                  call) — at the old 76px minimum + gap-3, 10 tiles (All + 9
                  categories) was juuust past what fits at this container's
                  narrowest desktop width (768px, before max-w-4xl takes over
                  at the lg breakpoint), so "Zipper" alone kept falling to its
                  own second row. Shrunk enough to fit all 10 in that
                  narrowest case with room to spare. */}
              <div
                role="tablist"
                aria-label="Checklist categories"
                className="mt-8 grid gap-1.5"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(62px, 1fr))" }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeChecklistCategory === "All"}
                  onClick={() => setActiveChecklistCategory("All")}
                  className={`flex flex-col items-center gap-1 px-1.5 py-2.5 rounded-xl text-[11px] font-medium text-center transition-colors min-w-0 w-full ${
                    activeChecklistCategory === "All" ? "text-primary border-[1.5px]" : "text-[#7a5c40] hover:text-primary"
                  }`}
                  style={activeChecklistCategory === "All" ? { backgroundColor: "#f5f0e8", borderColor: "#3d1700" } : undefined}
                >
                  <img src={CATEGORY_ICONS["All services"]} alt="" aria-hidden="true" style={{ width: 20, height: 20 }} />
                  <span
                    className="leading-snug"
                    style={activeChecklistCategory === "All" ? { borderBottom: "2px solid #fdb600", paddingBottom: 1 } : undefined}
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
                      className={`flex flex-col items-center gap-1 px-1.5 py-2.5 rounded-xl text-[11px] font-medium text-center transition-colors min-w-0 w-full ${
                        isActive ? "text-primary border-[1.5px]" : "text-[#7a5c40] hover:text-primary"
                      }`}
                      style={isActive ? { backgroundColor: "#f5f0e8", borderColor: "#3d1700" } : undefined}
                    >
                      <img src={CATEGORY_ICONS[cat]} alt="" aria-hidden="true" style={{ width: 20, height: 20 }} />
                      <span
                        className="leading-snug"
                        style={isActive ? { borderBottom: "2px solid #fdb600", paddingBottom: 1 } : undefined}
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
                {/* Back to "Preventative care" 2026-07-31 (Danielle's call) —
                    it was renamed to "Add-ons" 2026-07-27 specifically
                    because Shoe shine and Lace replacement didn't fit that
                    frame. Lace replacement is gone now (see ADDONS above)
                    and Shoe shine's description was reworded to lean into
                    protection, so every remaining item is genuinely
                    preventative — the original objection no longer applies.
                    Prices shown here come from the live catalog
                    (serviceBySlug/cardPriceLabel) so they can never drift
                    from what's shown on the service's own card/detail page. */}
                <p className="text-sm font-semibold text-primary mb-1">Preventative care</p>
                <p className="text-xs text-primary/70 mb-3">Make your shoes last longer</p>
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
              <h1 className="font-display text-3xl md:text-4xl text-primary">Here's what we recommend</h1>

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
                >
                  Add another pair to my order
                </Button>
                <Button
                  type="button"
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
        excludedBrands={(services ?? []).find((s) => s.slug === "full-resole")?.excludedBrands ?? []}
        onConfirm={onSoleSelectionConfirm}
      />
    </main>
  );
};

export default StartRepair;
