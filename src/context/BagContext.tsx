import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type BagService = {
  id: string;
  name: string;
  /** Price in cents */
  price: number;
};

export type BagPair = {
  id: string;
  /** Optional reference to the SavedPair this bag entry corresponds to */
  pairId?: string;
  /** Display label like "Pair 1" — derived for display, but stored for stability */
  label?: string;
  /** ISO timestamp; used to display in reverse order of addition */
  addedAt: string;
  services: BagService[];
};

type BagState = {
  pairs: BagPair[];
  /** Total number of services across all pairs (used for header badge) */
  itemCount: number;
  /** Sum of all service prices across all pairs, in cents */
  subtotal: number;
  /** Add a new bag entry, or update an existing one if pairId matches */
  addPair: (services: BagService[], pairId?: string) => void;
  removePair: (pairId: string) => void;
  removeService: (pairId: string, serviceId: string) => void;
  /** Find an existing bag entry for a given saved pair id */
  findByPairId: (pairId: string) => BagPair | undefined;
  clear: () => void;
};

const STORAGE_KEY = "cobbli.bag.v2";

const BagContext = createContext<BagState | undefined>(undefined);

const readStorage = (): BagPair[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const BagProvider = ({ children }: { children: ReactNode }) => {
  const [pairs, setPairs] = useState<BagPair[]>(() => readStorage());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
    } catch {
      /* ignore quota errors */
    }
  }, [pairs]);

  const addPair: BagState["addPair"] = useCallback((services) => {
    setPairs((prev) => [
      ...prev,
      { id: genId(), addedAt: new Date().toISOString(), services },
    ]);
  }, []);

  const removePair = useCallback((pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.id !== pairId));
  }, []);

  const removeService = useCallback((pairId: string, serviceId: string) => {
    setPairs((prev) =>
      prev
        .map((p) =>
          p.id === pairId ? { ...p, services: p.services.filter((s) => s.id !== serviceId) } : p,
        )
        // Drop pairs that no longer have any services
        .filter((p) => p.services.length > 0),
    );
  }, []);

  const clear = useCallback(() => setPairs([]), []);

  const value = useMemo<BagState>(() => {
    const itemCount = pairs.reduce((sum, p) => sum + p.services.length, 0);
    const subtotal = pairs.reduce(
      (sum, p) => sum + p.services.reduce((s, svc) => s + svc.price, 0),
      0,
    );
    return { pairs, itemCount, subtotal, addPair, removePair, removeService, clear };
  }, [pairs, addPair, removePair, removeService, clear]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
};

export const useBag = () => {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag must be used within a BagProvider");
  return ctx;
};

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
