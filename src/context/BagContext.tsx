import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ShoeType } from "@/types/service";
import { supabase } from "@/integrations/supabase/client";

export type BagService = {
  id: string;
  name: string;
  /** Price in cents — snapshot at add time; treat as a fallback only. Always re-derive from the live price list when rendering. */
  price: number;
  /** For services that require dye/paint consent (e.g. faded-or-patchy-color, color-restoration). */
  paintConsent?: "yes" | "no";
  /** For services that require sole material selection (e.g. full-resole). */
  soleMaterial?: "Leather" | "Rubber";
  /** Care tier snapshot — used by the live pricer to pick the correct variant column. */
  premium?: boolean;
};


export type BagPair = {
  id: string;
  /** Optional reference to the SavedPair this bag entry corresponds to */
  pairId?: string;
  /** Display label, snapshotted at add time so it survives sign-out / saved-pair deletion */
  label?: string;
  /** Shoe type snapshot — required to recompute live prices without depending on the saved pair */
  shoeType?: ShoeType;
  /** ISO timestamp; used to display in reverse order of addition */
  addedAt: string;
  services: BagService[];
};

type BagState = {
  pairs: BagPair[];
  /** Total number of services across all pairs (used for header badge) */
  itemCount: number;
  /** Sum of snapshot service prices. Not authoritative — UIs should recompute from the live price list. */
  subtotal: number;
  /** Add a new bag entry, or update an existing one if pairId matches */
  addPair: (services: BagService[], pairId?: string, label?: string, shoeType?: ShoeType) => void;
  removePair: (pairId: string) => void;
  removeService: (pairId: string, serviceId: string) => void;
  /** Find an existing bag entry for a given saved pair id */
  findByPairId: (pairId: string) => BagPair | undefined;
  clear: () => void;
};

const STORAGE_KEY = "cobbli.bag.v2";
const OWNER_KEY = "cobbli.bag.owner";
const GUEST_OWNER = "guest";

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

const readOwner = (): string => {
  if (typeof window === "undefined") return GUEST_OWNER;
  try {
    return window.localStorage.getItem(OWNER_KEY) || GUEST_OWNER;
  } catch {
    return GUEST_OWNER;
  }
};

const writeOwner = (owner: string) => {
  try {
    window.localStorage.setItem(OWNER_KEY, owner);
  } catch {
    /* ignore */
  }
};

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const BagProvider = ({ children }: { children: ReactNode }) => {
  const [pairs, setPairs] = useState<BagPair[]>(() => readStorage());
  const ownerRef = useRef<string>(readOwner());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
    } catch {
      /* ignore quota errors */
    }
  }, [pairs]);

  // Enforce bag ownership against the authenticated user.
  // - guest items + sign-in => migrate (claim) by adopting the new user id
  // - different previous user => clear local bag, then load from Supabase
  // - same user => no-op
  // - sign-out => keep bag, mark owner as guest (preserve state across sign-out)
  useEffect(() => {
    let cancelled = false;

    const loadRemoteBag = async (_userId: string) => {
      // Best-effort: the app does not currently persist bag_items to Supabase.
      // When persistence is wired up, hydrate from there here.
      // const { data } = await supabase.from("bag_items").select("*").eq("user_id", userId);
      // setPairs(mapRemoteToLocal(data ?? []));
      return;
    };

    const reconcile = async (userId: string | null) => {
      const prevOwner = ownerRef.current;
      if (!userId) {
        // Signed out: preserve items but mark as guest so a different user
        // signing in next will see a mismatch and clear.
        if (prevOwner !== GUEST_OWNER) {
          ownerRef.current = GUEST_OWNER;
          writeOwner(GUEST_OWNER);
        }
        return;
      }

      if (prevOwner === userId) {
        // Same user — nothing to do.
        return;
      }

      if (prevOwner === GUEST_OWNER) {
        // Guest-to-account migration: claim the local bag for this user.
        ownerRef.current = userId;
        writeOwner(userId);
        return;
      }

      // Different previous user: clear local, then hydrate from remote.
      setPairs([]);
      ownerRef.current = userId;
      writeOwner(userId);
      try {
        await loadRemoteBag(userId);
      } catch {
        /* ignore */
      }
      if (cancelled) return;
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      reconcile(session?.user?.id ?? null);
    });

    supabase.auth.getSession().then(({ data }) => {
      reconcile(data.session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const addPair: BagState["addPair"] = useCallback((services, pairId, label, shoeType) => {
    setPairs((prev) => {
      if (pairId) {
        const idx = prev.findIndex((p) => p.pairId === pairId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            services,
            label: label ?? next[idx].label,
            shoeType: shoeType ?? next[idx].shoeType,
            addedAt: new Date().toISOString(),
          };
          return next;
        }
      }
      return [
        ...prev,
        { id: genId(), pairId, label, shoeType, addedAt: new Date().toISOString(), services },
      ];
    });
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

  const findByPairId = useCallback(
    (pairId: string) => pairs.find((p) => p.pairId === pairId),
    [pairs],
  );

  const clear = useCallback(() => setPairs([]), []);

  const value = useMemo<BagState>(() => {
    const itemCount = pairs.reduce((sum, p) => sum + p.services.length, 0);
    const subtotal = pairs.reduce(
      (sum, p) => sum + p.services.reduce((s, svc) => s + svc.price, 0),
      0,
    );
    return { pairs, itemCount, subtotal, addPair, removePair, removeService, findByPairId, clear };
  }, [pairs, addPair, removePair, removeService, findByPairId, clear]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
};

export const useBag = () => {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag must be used within a BagProvider");
  return ctx;
};

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
