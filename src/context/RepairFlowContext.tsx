import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { BagService } from "@/context/BagContext";

type PaintConsentMap = Record<string, "yes" | "no">;
type SoleMaterialMap = Record<string, "Leather" | "Rubber">;

type RepairFlowState = {
  selectedPairId: string | null;
  selectedServiceSlugs: string[];
  /** Persists the active category between Select services and the service detail page. */
  activeCategory: string;
  /** Paint/dye consent answers keyed by service slug; persists across the flow. */
  paintConsents: PaintConsentMap;
  /** Sole-material answers keyed by service slug; persists across the flow. */
  soleMaterials: SoleMaterialMap;
  /** The items PairFlowDialog.tsx should add once the pair is described —
   *  set by openPairFlow() below, or directly by the checklist for a
   *  ready-to-add list of bag line items (a package, individual services, or
   *  both) that don't map to a single service/bundle the way the other two
   *  entry points do. PairFlowDialog reads and clears this on confirm.
   *  Deliberately kept separate from selectedServiceSlugs, since
   *  setSelectedPairId() resets that array and this needs to survive. */
  pendingRecommendedItems: BagService[] | null;
  /** Whether the "Describe this pair" / "Anything else?" / "Added to your
   *  bag" popup (PairFlowDialog.tsx) is open. Deliberately not persisted to
   *  sessionStorage with the rest of this state — a page reload mid-popup
   *  should just close it, not try to resurrect it. */
  pairFlowOpen: boolean;
  setSelectedPairId: (id: string | null) => void;
  setSelectedServiceSlugs: (slugs: string[]) => void;
  setActiveCategory: (c: string) => void;
  addService: (slug: string) => void;
  removeService: (slug: string) => void;
  setPaintConsent: (slug: string, consent: "yes" | "no") => void;
  setSoleMaterial: (slug: string, material: "Leather" | "Rubber") => void;
  setPendingRecommendedItems: (items: BagService[] | null) => void;
  /** Opens the pair popup with the given items to add — used by the
   *  checklist's "Continue" button and by a service/package's "Add to
   *  repair" / "Start a repair" buttons alike, so all three entry points
   *  share one popup instead of navigating to a separate page. */
  openPairFlow: (items: BagService[]) => void;
  closePairFlow: () => void;
  reset: () => void;
};

const STORAGE_KEY = "cobbli.repairFlow.v1";
const RepairFlowContext = createContext<RepairFlowState | undefined>(undefined);

type Persisted = {
  selectedPairId: string | null;
  selectedServiceSlugs: string[];
  activeCategory: string;
  paintConsents: PaintConsentMap;
  soleMaterials: SoleMaterialMap;
  pendingRecommendedItems: BagService[] | null;
};

const DEFAULTS: Persisted = {
  selectedPairId: null,
  selectedServiceSlugs: [],
  activeCategory: "All services",
  paintConsents: {},
  soleMaterials: {},
  pendingRecommendedItems: null,
};

const read = (): Persisted => {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
};

export const RepairFlowProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<Persisted>(() => read());
  const [pairFlowOpen, setPairFlowOpen] = useState(false);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const setSelectedPairId = useCallback((id: string | null) => {
    setState((s) =>
      s.selectedPairId === id
        ? s
        : { ...s, selectedPairId: id, selectedServiceSlugs: [], paintConsents: {}, soleMaterials: {} },
    );
  }, []);
  const setSelectedServiceSlugs = useCallback(
    (slugs: string[]) => setState((s) => ({ ...s, selectedServiceSlugs: slugs })),
    [],
  );
  const setActiveCategory = useCallback((c: string) => setState((s) => ({ ...s, activeCategory: c })), []);
  const addService = useCallback(
    (slug: string) =>
      setState((s) =>
        s.selectedServiceSlugs.includes(slug)
          ? s
          : { ...s, selectedServiceSlugs: [...s.selectedServiceSlugs, slug] },
      ),
    [],
  );
  const removeService = useCallback(
    (slug: string) =>
      setState((s) => {
        const nextConsents = { ...s.paintConsents };
        delete nextConsents[slug];
        const nextMaterials = { ...s.soleMaterials };
        delete nextMaterials[slug];
        return {
          ...s,
          selectedServiceSlugs: s.selectedServiceSlugs.filter((x) => x !== slug),
          paintConsents: nextConsents,
          soleMaterials: nextMaterials,
        };
      }),
    [],
  );
  const setPaintConsent = useCallback(
    (slug: string, consent: "yes" | "no") =>
      setState((s) => ({ ...s, paintConsents: { ...s.paintConsents, [slug]: consent } })),
    [],
  );
  const setSoleMaterial = useCallback(
    (slug: string, material: "Leather" | "Rubber") =>
      setState((s) => ({ ...s, soleMaterials: { ...s.soleMaterials, [slug]: material } })),
    [],
  );
  const setPendingRecommendedItems = useCallback(
    (items: BagService[] | null) => setState((s) => ({ ...s, pendingRecommendedItems: items })),
    [],
  );
  const openPairFlow = useCallback((items: BagService[]) => {
    setState((s) => ({ ...s, pendingRecommendedItems: items }));
    setPairFlowOpen(true);
  }, []);
  const closePairFlow = useCallback(() => setPairFlowOpen(false), []);
  const reset = useCallback(() => setState(DEFAULTS), []);

  const value = useMemo<RepairFlowState>(
    () => ({
      ...state,
      pairFlowOpen,
      setSelectedPairId,
      setSelectedServiceSlugs,
      setActiveCategory,
      addService,
      removeService,
      setPaintConsent,
      setSoleMaterial,
      setPendingRecommendedItems,
      openPairFlow,
      closePairFlow,
      reset,
    }),
    [state, pairFlowOpen, setSelectedPairId, setSelectedServiceSlugs, setActiveCategory, addService, removeService, setPaintConsent, setSoleMaterial, setPendingRecommendedItems, openPairFlow, closePairFlow, reset],
  );
  return <RepairFlowContext.Provider value={value}>{children}</RepairFlowContext.Provider>;
};

export const useRepairFlow = () => {
  const ctx = useContext(RepairFlowContext);
  if (!ctx) throw new Error("useRepairFlow must be used within a RepairFlowProvider");
  return ctx;
};

