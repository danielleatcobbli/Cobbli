import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type RepairFlowState = {
  selectedPairId: string | null;
  selectedServiceSlugs: string[];
  /** Persists the active category between Select services and the service detail page. */
  activeCategory: string;
  setSelectedPairId: (id: string | null) => void;
  setSelectedServiceSlugs: (slugs: string[]) => void;
  setActiveCategory: (c: string) => void;
  addService: (slug: string) => void;
  removeService: (slug: string) => void;
  reset: () => void;
};

const STORAGE_KEY = "cobbli.repairFlow.v1";
const RepairFlowContext = createContext<RepairFlowState | undefined>(undefined);

type Persisted = {
  selectedPairId: string | null;
  selectedServiceSlugs: string[];
  activeCategory: string;
};

const read = (): Persisted => {
  if (typeof window === "undefined") {
    return { selectedPairId: null, selectedServiceSlugs: [], activeCategory: "All services" };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { selectedPairId: null, selectedServiceSlugs: [], activeCategory: "All services" };
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
    setState((s) => (s.selectedPairId === id ? s : { ...s, selectedPairId: id, selectedServiceSlugs: [] }));
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
      setState((s) => ({ ...s, selectedServiceSlugs: s.selectedServiceSlugs.filter((x) => x !== slug) })),
    [],
  );
  const reset = useCallback(
    () => setState({ selectedPairId: null, selectedServiceSlugs: [], activeCategory: "All services" }),
    [],
  );

  const value = useMemo<RepairFlowState>(
    () => ({ ...state, setSelectedPairId, setActiveCategory, addService, removeService, reset }),
    [state, setSelectedPairId, setActiveCategory, addService, removeService, reset],
  );
  return <RepairFlowContext.Provider value={value}>{children}</RepairFlowContext.Provider>;
};

export const useRepairFlow = () => {
  const ctx = useContext(RepairFlowContext);
  if (!ctx) throw new Error("useRepairFlow must be used within a RepairFlowProvider");
  return ctx;
};
