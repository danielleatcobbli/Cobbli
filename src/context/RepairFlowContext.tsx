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
  /** Set by the "What's going on with your shoes?" recommendation flow right
   *  before navigating to the pick-a-pair page — a ready-to-add list of bag
   *  line items (a package, individual services, or both) that don't map to
   *  a single service/bundle query param the way the older flows do.
   *  StartRepairPick.tsx reads and clears this on confirm. Deliberately kept
   *  separate from selectedServiceSlugs, since setSelectedPairId() resets
   *  that array and this needs to survive picking a pair. */
  pendingRecommendedItems: BagService[] | null;
  setSelectedPairId: (id: string | null) => void;
  setSelectedServiceSlugs: (slugs: string[]) => void;
  setActiveCategory: (c: string) => void;
  addService: (slug: string) => void;
  removeService: (slug: string) => void;
  setPaintConsent: (slug: string, consent: "yes" | "no") => void;
  setSoleMaterial: (slug: string, material: "Leather" | "Rubber") => void;
  setPendingRecommendedItems: (items: BagService[] | null) => void;
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
  const reset = useCallback(() => setState(DEFAULTS), []);

  const value = useMemo<RepairFlowState>(
    () => ({
      ...state,
      setSelectedPairId,
      setSelectedServiceSlugs,
      setActiveCategory,
      addService,
      removeService,
      setPaintConsent,
      setSoleMaterial,
      setPendingRecommendedItems,
      reset,
    }),
    [state, setSelectedPairId, setSelectedServiceSlugs, setActiveCategory, addService, removeService, setPaintConsent, setSoleMaterial, setPendingRecommendedItems, reset],
  );
  return <RepairFlowContext.Provider value={value}>{children}</RepairFlowContext.Provider>;
};

export const useRepairFlow = () => {
  const ctx = useContext(RepairFlowContext);
  if (!ctx) throw new Error("useRepairFlow must be used within a RepairFlowProvider");
  return ctx;
};

