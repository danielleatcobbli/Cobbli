import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ShoeType } from "@/types/service";
import { supabase } from "@/integrations/supabase/client";

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
  updatePair: (id: string, data: Omit<SavedPair, "id" | "createdAt">) => Promise<void>;
  deletePair: (id: string) => Promise<void>;
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

const clearStorage = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

type DbPair = {
  id: string;
  shoe_type: string;
  colors: string[] | null;
  brand: string | null;
  description: string | null;
  created_at: string;
};

const fromDb = (r: DbPair): SavedPair => ({
  id: r.id,
  shoeType: r.shoe_type as ShoeType,
  colors: r.colors ?? [],
  brand: r.brand ?? undefined,
  description: r.description ?? undefined,
  createdAt: r.created_at,
});

export const PairsProvider = ({ children }: { children: ReactNode }) => {
  const [pairs, setPairs] = useState<SavedPair[]>(() => read());
  const hadSessionRef = useRef<boolean>(false);
  const initializedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);

  // Persist to localStorage as a cache for the active session.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
    } catch {
      /* ignore */
    }
  }, [pairs]);

  // Fetch the signed-in user's pairs fresh from Supabase, replacing any cache.
  const refreshFromServer = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("pairs")
      .select("id, shoe_type, colors, brand, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load pairs", error);
      return;
    }
    setPairs((data ?? []).map((r) => fromDb(r as DbPair)));
  }, []);

  // Migrate any guest pairs sitting in localStorage into the signed-in user's account.
  // Uses upsert on id so re-runs are idempotent and never duplicate rows.
  const migrateGuestPairs = useCallback(async (userId: string) => {
    const guestPairs = read();
    if (guestPairs.length === 0) return;
    const rows = guestPairs.map((p) => ({
      id: p.id,
      user_id: userId,
      shoe_type: p.shoeType,
      colors: p.colors ?? [],
      brand: p.brand ?? null,
      description: p.description ?? null,
    }));
    const { error } = await supabase
      .from("pairs")
      .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error("Failed to migrate guest pairs to account", error);
    }
  }, []);

  // Sync pairs with the auth lifecycle.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const isSignedIn = !!session;
      const wasSignedIn = hadSessionRef.current;

      if (event === "SIGNED_OUT") {
        currentUserIdRef.current = null;
        clearStorage();
        setPairs([]);
      } else if (event === "SIGNED_IN" && isSignedIn) {
        // True sign-in transition: migrate any genuine guest pairs (only when
        // there was no prior session), then refresh from server.
        const userId = session!.user.id;
        currentUserIdRef.current = userId;
        void (async () => {
          if (!wasSignedIn) {
            await migrateGuestPairs(userId);
          }
          clearStorage();
          setPairs([]);
          await refreshFromServer(userId);
        })();
      } else if (event === "INITIAL_SESSION" && isSignedIn) {
        // App load with an existing session: never migrate (the local cache
        // here is this user's previous cached pairs, not new guest pairs).
        const userId = session!.user.id;
        currentUserIdRef.current = userId;
        clearStorage();
        setPairs([]);
        void refreshFromServer(userId);
      } else if (event === "INITIAL_SESSION" && !isSignedIn && !initializedRef.current) {
        // No session at load — clear any stale cache from a previous user.
        clearStorage();
        setPairs([]);
      }

      hadSessionRef.current = isSignedIn;
      initializedRef.current = true;
    });

    return () => sub.subscription.unsubscribe();
  }, [refreshFromServer, migrateGuestPairs]);

  const addPair: PairsState["addPair"] = useCallback((data) => {
    const pair: SavedPair = { ...data, id: genId(), createdAt: new Date().toISOString() };
    setPairs((prev) => [pair, ...prev]);
    // Persist immediately for signed-in users. Uses upsert by id so accidental
    // re-fires (StrictMode double-invoke, retries) never produce duplicates.
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { error } = await supabase.from("pairs").upsert(
        {
          id: pair.id,
          user_id: uid,
          shoe_type: pair.shoeType,
          colors: pair.colors ?? [],
          brand: pair.brand ?? null,
          description: pair.description ?? null,
        },
        { onConflict: "id" },
      );
      if (error) console.error("Failed to save pair to account", error);
    })();
    return pair;
  }, []);

  const updatePair: PairsState["updatePair"] = useCallback(async (id, data) => {
    setPairs((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { error } = await supabase
      .from("pairs")
      .update({
        shoe_type: data.shoeType,
        colors: data.colors ?? [],
        brand: data.brand ?? null,
        description: data.description ?? null,
      })
      .eq("id", id)
      .eq("user_id", uid);
    if (error) console.error("Failed to update pair", error);
  }, []);

  const deletePair: PairsState["deletePair"] = useCallback(async (id) => {
    setPairs((prev) => prev.filter((p) => p.id !== id));
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return;
    const { error } = await supabase.from("pairs").delete().eq("id", id).eq("user_id", uid);
    if (error) console.error("Failed to delete pair", error);
  }, []);

  const getPair = useCallback((id: string) => pairs.find((p) => p.id === id), [pairs]);

  const value = useMemo(
    () => ({ pairs, addPair, updatePair, deletePair, getPair }),
    [pairs, addPair, updatePair, deletePair, getPair],
  );
  return <PairsContext.Provider value={value}>{children}</PairsContext.Provider>;
};

export const usePairs = () => {
  const ctx = useContext(PairsContext);
  if (!ctx) throw new Error("usePairs must be used within a PairsProvider");
  return ctx;
};

import { displayBrand } from "@/components/cobbli/BrandCombobox";
export const formatPairLabel = (p: SavedPair) =>
  // Pairs created via the simplified "Describe this pair" step (2026-07-15)
  // only ever have a description — no shoeType/colors/brand worth showing —
  // so prefer it outright rather than falling back to a label built from
  // fields that are now just an "Unspecified"/empty placeholder. Older pairs
  // saved through the full manual form still fall back to the structured
  // label exactly as before.
  p.description?.trim()
    ? p.description.trim()
    : [p.colors.join(" / "), displayBrand(p.brand), p.shoeType].filter(Boolean).join(" · ");
