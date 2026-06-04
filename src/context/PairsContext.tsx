import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ShoeType } from "@/types/service";

export type SavedPair = {
  id: string;
  shoeType: ShoeType;
  colors: string[];
  brand?: string;
  description?: string;
  photoUrls?: string[];
  createdAt: string;
};

type PairsState = {
  pairs: SavedPair[];
  addPair: (pair: Omit<SavedPair, "id" | "createdAt">) => SavedPair;
  getPair: (id: string) => SavedPair | undefined;
};

const STORAGE_KEY = "cobbli.pairs.v1";
const PairsContext = createContext<PairsState | undefined>(undefined);

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const read = (): SavedPair[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const PairsProvider = ({ children }: { children: ReactNode }) => {
  const [pairs, setPairs] = useState<SavedPair[]>(() => read());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
    } catch {
      /* ignore */
    }
  }, [pairs]);

  const addPair: PairsState["addPair"] = useCallback((data) => {
    const pair: SavedPair = { ...data, id: genId(), createdAt: new Date().toISOString() };
    setPairs((prev) => [...prev, pair]);
    return pair;
  }, []);

  const getPair = useCallback((id: string) => pairs.find((p) => p.id === id), [pairs]);

  const value = useMemo(() => ({ pairs, addPair, getPair }), [pairs, addPair, getPair]);
  return <PairsContext.Provider value={value}>{children}</PairsContext.Provider>;
};

export const usePairs = () => {
  const ctx = useContext(PairsContext);
  if (!ctx) throw new Error("usePairs must be used within a PairsProvider");
  return ctx;
};

export const formatPairLabel = (p: SavedPair) =>
  [p.colors.join(" / "), p.brand?.trim() || null, p.shoeType].filter(Boolean).join(" · ");
