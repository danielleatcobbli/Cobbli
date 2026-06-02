import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BagPair } from "./BagContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";


export type Address = {
  id: string;
  street: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  isDefault: boolean;
};

export type PaymentMethod = {
  id: string;
  brand: string; // e.g. "Visa"
  last4: string;
  expMonth: number;
  expYear: number;
  billingAddressId?: string;
  isDefault: boolean;
};

export type Order = {
  id: string;
  number: string;
  placedAt: string;
  email: string;
  phone: string;
  address: Address;
  paymentLast4: string;
  pairs: BagPair[];
  repairsSubtotal: number;
  courierFee: number;
  subtotal: number;
};

type AccountState = {
  user: { name: string; email: string; phone: string };
  updateContact: (email: string, phone: string) => void;
  addresses: Address[];
  addAddress: (a: Omit<Address, "id">) => Address;
  paymentMethods: PaymentMethod[];
  addPaymentMethod: (p: Omit<PaymentMethod, "id">) => PaymentMethod;
  orders: Order[];
  addOrder: (o: Omit<Order, "id" | "number" | "placedAt">) => Order;
};

const STORAGE_KEY = "cobbli.account.v1";
const AccountContext = createContext<AccountState | undefined>(undefined);

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

type Persisted = {
  user: { name: string; email: string; phone: string };
  addresses: Address[];
  paymentMethods: PaymentMethod[];
  orders: Order[];
};

const DEFAULT: Persisted = {
  user: { name: "Jane Doe", email: "[email protected]", phone: "(212) 555-0142" },
  addresses: [],
  paymentMethods: [],
  orders: [],
};

const read = (): Persisted => {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
};

export const AccountProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<Persisted>(() => read());
  const [needsName, setNeedsName] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [nameForm, setNameForm] = useState({ first: "", last: "" });
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const syncProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const user = authData.user;
    setAuthUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("user_id", user.id)
      .single();

    let firstName = profile?.first_name ?? null;
    let lastName = profile?.last_name ?? null;

    // If profile lacks a name, try to derive one from OAuth metadata (e.g. Google).
    if (!firstName && !lastName) {
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const fullName =
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        ([meta.given_name, meta.family_name].filter(Boolean).join(" ").trim() || null);

      const given = (meta.given_name as string | undefined) ?? null;
      const family = (meta.family_name as string | undefined) ?? null;

      if (given || family) {
        firstName = given;
        lastName = family;
      } else if (fullName) {
        const parts = fullName.trim().split(/\s+/);
        firstName = parts[0] ?? null;
        lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
      }

      if (firstName || lastName) {
        await supabase
          .from("profiles")
          .update({ first_name: firstName, last_name: lastName })
          .eq("user_id", user.id);
      }
    }

    const hasName = Boolean((firstName && firstName.trim()) || (lastName && lastName.trim()));

    setState((s) => ({
      ...s,
      user: {
        name: hasName
          ? `${firstName ?? ""} ${lastName ?? ""}`.trim()
          : s.user.name,
        email: user.email ?? s.user.email,
        phone: profile?.phone ?? s.user.phone,
      },
    }));

    if (!hasName) setNeedsName(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await syncProfile();
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setTimeout(() => { syncProfile(); }, 0);
      } else {
        setAuthUserId(null);
        setNeedsName(false);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [syncProfile]);

  const submitName = async () => {
    const first = nameForm.first.trim();
    const last = nameForm.last.trim();
    if (!first || !last || !authUserId) return;
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ first_name: first, last_name: last })
      .eq("user_id", authUserId);
    setSavingName(false);
    if (error) return;
    setState((s) => ({ ...s, user: { ...s.user, name: `${first} ${last}` } }));
    setNeedsName(false);
    setNameForm({ first: "", last: "" });
  };



  const updateContact = useCallback((email: string, phone: string) => {
    setState((s) => ({ ...s, user: { ...s.user, email, phone } }));
  }, []);

  const addAddress: AccountState["addAddress"] = useCallback((a) => {
    const addr: Address = { ...a, id: genId() };
    setState((s) => ({
      ...s,
      addresses: addr.isDefault
        ? [...s.addresses.map((x) => ({ ...x, isDefault: false })), addr]
        : [...s.addresses, addr],
    }));
    return addr;
  }, []);

  const addPaymentMethod: AccountState["addPaymentMethod"] = useCallback((p) => {
    const pm: PaymentMethod = { ...p, id: genId() };
    setState((s) => ({
      ...s,
      paymentMethods: pm.isDefault
        ? [...s.paymentMethods.map((x) => ({ ...x, isDefault: false })), pm]
        : [...s.paymentMethods, pm],
    }));
    return pm;
  }, []);

  const addOrder: AccountState["addOrder"] = useCallback((o) => {
    const order: Order = {
      ...o,
      id: genId(),
      number: `CB-${Date.now().toString().slice(-6)}`,
      placedAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, orders: [order, ...s.orders] }));
    return order;
  }, []);

  const value = useMemo<AccountState>(
    () => ({ ...state, updateContact, addAddress, addPaymentMethod, addOrder }),
    [state, updateContact, addAddress, addPaymentMethod, addOrder],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
};

export const useAccount = () => {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within an AccountProvider");
  return ctx;
};

export const isExpired = (pm: PaymentMethod, now = new Date()) => {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return pm.expYear < y || (pm.expYear === y && pm.expMonth < m);
};

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
] as const;
