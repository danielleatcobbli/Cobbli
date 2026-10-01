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
  /** For services that require sole material selection (e.g. full-resole).
   *  "Rubber" also covers a lug-sole pick — lug is priced the same as
   *  standard rubber (2026-08-11, Danielle's call), so it isn't its own
   *  value here, just a different photo/label at selection time. */
  soleMaterial?: "Leather" | "Rubber";
  /** For full-resole picked via a specialty brand (Birkenstock, Golden
   *  Goose) instead of a sole material — fixed brand pricing, mutually
   *  exclusive with soleMaterial. Matches the brand's full-resole variant_key
   *  in Supabase (e.g. "golden-goose"). */
  resoleBrand?: string;
  /** Care tier snapshot — used by the live pricer to pick the correct variant column. */
  premium?: boolean;
};


export type BagPair = {
  id: string;
  /** Optional reference to the SavedPair this bag entry corresponds to */
  pairId?: string;
  /** Display label, snapshotted at add time so it survives sign-out / saved-pair deletion.
   *  Used as a text fallback (e.g. alt text, or before the thumbnail loads) —
   *  the primary visual identifier for items that came from a multi-item
   *  assessment is thumbnailPath below, not this label (2026-09-24,
   *  Danielle's call: don't ask customers to name their items). */
  label?: string;
  /** Storage path (in the "assessment-uploads" bucket) of this item's first
   *  uploaded photo, carried through from AssessmentProposal.tsx's onAccept
   *  — used as the item's identifier wherever the bag is summarized (Bag.tsx,
   *  Checkout.tsx) instead of a customer-authored name. Resolved to a signed
   *  URL at render time, same pattern as AssessmentProposal.tsx/Admin.tsx.
   *  Undefined for items added the old way (StartRepair.tsx's checklist
   *  flow), which never had photos to begin with. */
  thumbnailPath?: string;
  /** Shoe type snapshot — required to recompute live prices without depending on the saved pair */
  shoeType?: ShoeType;
  /** Free-text notes for this specific repair/visit — captured once on the
   *  "Describe this pair" step, distinct from the pair's own saved
   *  description: notes are about this repair (e.g. "there's a clicking
   *  sound"), not the pair's identity, so they're never written back to
   *  SavedPair. Carried through checkout as part of the order's item
   *  snapshot. */
  notes?: string;
  /** ISO timestamp; used to display in reverse order of addition */
  addedAt: string;
  services: BagService[];
  /** Which repair request (assessments.id) these services were accepted
   *  from, if any — set by RepairDetails.tsx / AssessmentProposal.tsx's
   *  onAccept flows (2026-10-02). Undefined for items added the regular way
   *  (StartRepair.tsx's checklist flow has no request to tag). Used only to
   *  detect — and warn about, rather than silently discard — the case where
   *  the bag already holds another request's accepted selections when a
   *  customer accepts a second one before checking out (see clear()'s
   *  caller in RepairDetails.tsx for the one-request-per-checkout guard this
   *  supports). Not read anywhere that enforces which items get submitted;
   *  Checkout.tsx still sends the whole bag, which is the known limitation
   *  this tag lets the caller detect and confirm rather than hide. */
  assessmentId?: string;
};

type BagState = {
  pairs: BagPair[];
  /** Total number of services across all pairs (used for header badge) */
  itemCount: number;
  /** Sum of snapshot service prices. Not authoritative — UIs should recompute from the live price list. */
  subtotal: number;
  /** Add a new bag entry, or update an existing one if pairId matches */
  addPair: (
    services: BagService[],
    pairId?: string,
    label?: string,
    shoeType?: ShoeType,
    notes?: string,
    thumbnailPath?: string,
    assessmentId?: string,
  ) => void;
  removePair: (pairId: string) => void;
  removeService: (pairId: string, serviceId: string) => void;
  /** Find an existing bag entry for a given saved pair id */
  findByPairId: (pairId: string) => BagPair | undefined;
  /** Every distinct assessmentId currently tagged on items in the bag
   *  (2026-10-02) — lets a caller about to clear() and add a different
   *  request's items check whether it would be discarding another request's
   *  still-unsaved selections first. */
  taggedAssessmentIds: () => string[];
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
        // Signed out: leave the owner as-is (the last signed-in user's id, or
        // GUEST_OWNER if it was never tied to an account). Do NOT collapse it
        // to GUEST_OWNER here — that previously made "sign out, sign in as a
        // different person" indistinguishable from "genuine guest cart, first
        // sign-in," so the next person to sign in silently inherited the
        // previous user's bag instead of getting a mismatch-and-clear. Leaving
        // the real owner in place means: the same user signing back in still
        // sees their bag (owner matches, no-op below), but a *different* user
        // signing in next correctly hits the "different previous user" branch
        // and clears it.
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

  const addPair: BagState["addPair"] = useCallback(
    (services, pairId, label, shoeType, notes, thumbnailPath, assessmentId) => {
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
              notes: notes ?? next[idx].notes,
              thumbnailPath: thumbnailPath ?? next[idx].thumbnailPath,
              assessmentId: assessmentId ?? next[idx].assessmentId,
              addedAt: new Date().toISOString(),
            };
            return next;
          }
        }
        return [
          ...prev,
          {
            id: genId(),
            pairId,
            label,
            shoeType,
            notes,
            thumbnailPath,
            assessmentId,
            addedAt: new Date().toISOString(),
            services,
          },
        ];
      });
    },
    [],
  );

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

  const taggedAssessmentIds = useCallback(
    () => Array.from(new Set(pairs.map((p) => p.assessmentId).filter((id): id is string => !!id))),
    [pairs],
  );

  const clear = useCallback(() => setPairs([]), []);

  const value = useMemo<BagState>(() => {
    const itemCount = pairs.reduce((sum, p) => sum + p.services.length, 0);
    const subtotal = pairs.reduce(
      (sum, p) => sum + p.services.reduce((s, svc) => s + svc.price, 0),
      0,
    );
    return {
      pairs,
      itemCount,
      subtotal,
      addPair,
      removePair,
      removeService,
      findByPairId,
      taggedAssessmentIds,
      clear,
    };
  }, [pairs, addPair, removePair, removeService, findByPairId, taggedAssessmentIds, clear]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
};

export const useBag = () => {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag must be used within a BagProvider");
  return ctx;
};

export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
