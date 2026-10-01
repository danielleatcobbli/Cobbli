import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff, Pencil, ShoppingBag } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { US_STATES } from "@/context/AccountContext";
import { useServiceableZips } from "@/hooks/useServiceableZips";
import { cn } from "@/lib/utils";
import { REQUEST_STATUS, REPAIR_STATUS, fallbackMeta, type StatusMeta } from "@/lib/repairStatus";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { apiFetchJson } from "@/integrations/api/client";
import { StripeCardSetupForm } from "@/components/StripeCardSetup";

type Profile = {
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
};

type Address = {
  id: string;
  street: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  is_default: boolean;
};

type PaymentMethod = {
  id: string;
  card_brand: string;
  card_last4: string;
  exp_month: number;
  exp_year: number;
  is_default: boolean;
};

// pair_snapshot is a direct copy of BagContext's BagPair (see
// src/context/BagContext.tsx) — thumbnailPath is the customer's own first
// uploaded photo (bucket "assessment-uploads"), carried through from the
// proposal they accepted. shoeType/colors/brand are legacy fields from the
// pre-bag-repair era and are empty on every item that went through the
// current photo-intake flow — kept here only so old orders don't crash.
type PairSnapshot = {
  thumbnailPath?: string | null;
  label?: string | null;
  notes?: string | null;
  shoeType?: string | null;
  colors?: string[] | null;
  brand?: string | null;
};

type OrderItem = {
  pair_snapshot: PairSnapshot | null;
  service_snapshot: { name?: string } | null;
};

type Order = {
  id: string;
  order_number: string;
  placed_at: string;
  total_cents: number;
  status: string;
  order_items: OrderItem[];
};

// Matches what AssessmentUpload.tsx actually writes to assessments.pairs —
// see that file's onSubmit (2026-09-24, multi-item rewrite). shoeType/colors/
// brand are legacy fields from the pre-bag-repair era, always empty here.
type AssessmentPair = {
  photoPaths?: string[];
  description?: string | null;
  shoeType?: string | null;
  colors?: string[] | null;
  brand?: string | null;
};

type ProposedService = { service_id: string; name: string; price_cents: number; tier: "essential" | "recommended" };

type Assessment = {
  id: string;
  status: string;
  created_at: string;
  pairs: AssessmentPair[];
  proposed_services: ProposedService[] | null;
};


const NAV = [
  { to: "/account/orders", label: "My Repairs" },
  { to: "/account/addresses", label: "My Addresses" },
  { to: "/account/payment-methods", label: "My Payment Methods" },
  { to: "/account/password", label: "My Password" },
  { to: "/account/contact", label: "Contact Us" },
];

const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

const isExpired = (m: number, y: number) => {
  const now = new Date();
  const yy = now.getFullYear();
  const mm = now.getMonth() + 1;
  return y < yy || (y === yy && m < mm);
};

const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("first_name,last_name,email,phone")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data as Profile | null);
        setLoading(false);
      });
  }, [user]);
  return { profile, loading };
};

const Sidebar = ({ onSignOut }: { onSignOut: () => void }) => {
  const { profile, loading } = useProfile();
  const fullName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "";

  return (
    <aside className="md:w-64 md:shrink-0">
      <div className="mb-6 min-h-[3rem]">
        {loading ? (
          <BrandSpinner size="sm" className="justify-start" />
        ) : (
          <>
            <p className="font-semibold text-foreground">{fullName}</p>
            {profile?.email && (
              <p className="text-sm text-muted-foreground break-all">{profile.email}</p>
            )}
          </>
        )}
      </div>
      {/* Uppercase + Instrument Sans/bold 2026-08-27 (Danielle's call —
          Account section should use the same fonts/capitalization as the
          rest of the site, matching the header nav's uppercase treatment). */}
      <nav aria-label="Account" className="flex flex-col gap-1 text-sm uppercase tracking-wide" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "py-2 transition-colors hover:text-primary font-bold",
                isActive ? "underline underline-offset-4 text-primary" : "text-foreground/80",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
        {/* Bug fix (2026-09-01, Danielle's report) — this button sat inside
            the <nav>'s uppercase className same as every NavLink above it,
            but Tailwind's preflight reset sets `text-transform: none` on
            <button> specifically, silently overriding the inherited
            uppercase. Explicit `uppercase` here beats that reset. */}
        <button
          type="button"
          onClick={onSignOut}
          className="text-left py-2 font-bold uppercase text-foreground/80 hover:text-primary transition-colors"
        >
          Sign Out
        </button>
      </nav>
    </aside>
  );
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

const ClickableCard = ({
  to,
  children,
  borderLeftColor,
}: {
  to: string;
  children: React.ReactNode;
  borderLeftColor?: string;
}) => {
  const navigate = useNavigate();
  const go = () => navigate(to);
  return (
    <li
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
      className={cn(
        "rounded-lg border border-border bg-card p-5 shadow-soft cursor-pointer transition-shadow transition-colors hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40",
        borderLeftColor && "border-l-[3px]",
      )}
      style={borderLeftColor ? { borderLeftColor } : undefined}
    >
      {children}
    </li>
  );
};

// Normalized shape both a request (assessment) and a confirmed repair
// (order) render into, so there's one card component and one sort order —
// "the repair appears once in the customer's list" per Danielle's spec.
type Repair = {
  key: string;
  date: number;
  to: string;
  /** "Repair #<order_number>" or "Repair #<ref8>" — the SAME reference
   *  number shown as the page heading on Repair Details (2026-10-01,
   *  Danielle's call: this is the card's primary heading now, replacing the
   *  customer-entered item name/description that used to lead the card). No
   *  new reference numbers are generated here — this is the existing
   *  order_number / assessment id, just relabeled. */
  refLabel: string;
  dateLabel: string;
  thumbnailPath: string | null;
  meta: StatusMeta;
  priceLabel: string;
};

const RepairCard = ({ r, thumbUrl }: { r: Repair; thumbUrl: string | null | undefined }) => (
  <ClickableCard to={r.to}>
    <div className="flex gap-4">
      <div className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-md overflow-hidden bg-muted/40 border border-border flex items-center justify-center">
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <ShoppingBag className="text-muted-foreground/50" size={26} />
        )}
      </div>
      <div className="min-w-0 flex-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{r.refLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{r.dateLabel}</p>
          {r.meta.next && <p className="text-sm text-foreground/80 mt-2">{r.meta.next}</p>}
        </div>
        <div className="text-right shrink-0">
          <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold mb-2", r.meta.pill)}>
            {r.meta.label}
          </span>
          <p className="font-semibold text-sm">{r.priceLabel}</p>
        </div>
      </div>
    </div>
    <div className="mt-3 flex justify-end">
      <span className="text-sm text-primary underline underline-offset-4">{r.meta.action}</span>
    </div>
  </ClickableCard>
);

const EmptyState = ({
  message,
  cta,
  to,
}: {
  message: string;
  cta: string;
  to: string;
}) => (
  <div className="rounded-lg border border-border bg-card p-8 text-center">
    <p className="text-foreground/80 mb-4">{message}</p>
    <Button asChild variant="hero">
      <Link to={to}>{cta}</Link>
    </Button>
  </div>
);

// First-photo lookup, same pattern as AssessmentProposal.tsx/Admin.tsx —
// signed URLs from the "assessment-uploads" bucket, since that's where both
// a request's own uploads and an accepted order's carried-through
// thumbnailPath (see BagContext.tsx's BagPair) live.
const useThumbnails = (paths: (string | null)[]) => {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.filter(Boolean).join("|");
  useEffect(() => {
    let cancelled = false;
    const toFetch = Array.from(new Set(paths.filter((p): p is string => !!p)));
    if (toFetch.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        toFetch.map(async (path) => {
          const { data } = await supabase.storage.from("assessment-uploads").createSignedUrl(path, 3600);
          return [path, data?.signedUrl] as const;
        }),
      );
      if (cancelled) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const [path, url] of entries) if (url) next[path] = url;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
};

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [assessments, setAssessments] = useState<Assessment[] | null>(null);
  usePageMeta({
    title: "My repairs — Cobbli",
    description:
      "Track your Cobbli bag repair requests and confirmed repairs in one place, and start a new repair from your account dashboard.",
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("orders")
      .select("id,order_number,placed_at,total_cents,status,order_items(pair_snapshot,service_snapshot)")
      .eq("user_id", user.id)
      .order("placed_at", { ascending: false })
      .then(({ data }) => setOrders((data ?? []) as unknown as Order[]));
    // "booked" assessments are excluded here — once accepted, that repair
    // lives on as an order instead, so it isn't shown twice (see
    // AssessmentProposal.tsx's onAcceptAndCheckout / the booked-assessment→
    // order handoff this page intentionally didn't touch).
    supabase
      .from("assessments")
      .select("id,status,created_at,pairs,proposed_services")
      .eq("user_id", user.id)
      .neq("status", "booked")
      .order("created_at", { ascending: false })
      .then(({ data }) => setAssessments((data ?? []) as unknown as Assessment[]));
  }, [user]);

  const visibleRequests = useMemo(() => {
    if (!assessments) return [];
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return assessments.filter((a) => {
      if ((a.status === "declined" || a.status === "service_unavailable") && new Date(a.created_at).getTime() < cutoff) {
        return false;
      }
      return true;
    });
  }, [assessments]);

  const combined = useMemo<Repair[]>(() => {
    const items: Repair[] = [];

    (orders ?? []).forEach((o) => {
      const firstItem = o.order_items[0];
      const firstPair = firstItem?.pair_snapshot ?? null;
      items.push({
        key: `o-${o.id}`,
        date: new Date(o.placed_at).getTime(),
        to: `/repair/order/${o.id}`,
        // "Placed" uses the order's actual placement timestamp (placed_at)
        // — never relabeled from a request's submission date or an "updated
        // at" value (2026-10-01).
        refLabel: `Repair #${o.order_number}`,
        dateLabel: `Placed ${formatDate(o.placed_at)}`,
        thumbnailPath: firstPair?.thumbnailPath ?? null,
        meta: REPAIR_STATUS[o.status] ?? fallbackMeta(o.status),
        priceLabel: formatPrice(o.total_cents),
      });
    });

    visibleRequests.forEach((a) => {
      const ref = a.id.slice(0, 8).toUpperCase();
      const firstPair = a.pairs?.[0];
      const meta = REQUEST_STATUS[a.status] ?? fallbackMeta(a.status);
      const essentialServices = (a.proposed_services ?? []).filter((s) => s.tier === "essential");
      const essentialCents = essentialServices.reduce((sum, s) => sum + s.price_cents, 0);
      // Distinguish "staff hasn't priced this yet" from "staff priced it at
      // $0 on purpose" (e.g. a complimentary test repair) — same distinction
      // RepairDetails.tsx's Pricing section makes; a flat `>0` check here
      // would mislabel a genuine $0 service as still-pending (2026-10-01 fix).
      const priceLabel =
        essentialServices.length === 0
          ? "Price pending assessment"
          : essentialCents > 0
            ? formatPrice(essentialCents)
            : "Complimentary repair";
      items.push({
        key: `a-${a.id}`,
        date: new Date(a.created_at).getTime(),
        to: `/repair/request/${a.id}`,
        // "Submitted" uses the assessment's original created_at — never
        // relabeled "Placed" unless/until it actually becomes an order
        // (2026-10-01).
        refLabel: `Repair #${ref}`,
        dateLabel: `Submitted ${formatDate(a.created_at)}`,
        thumbnailPath: firstPair?.photoPaths?.[0] ?? null,
        meta,
        priceLabel,
      });
    });

    return items.sort((a, b) => b.date - a.date);
  }, [orders, visibleRequests]);

  const thumbUrls = useThumbnails(combined.map((r) => r.thumbnailPath));
  const loading = orders === null || assessments === null;

  return (
    <section>
      <h1
        className="text-2xl md:text-3xl uppercase mb-6"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
      >
        My Repairs
      </h1>

      {loading ? (
        <BrandSpinner className="py-10" />
      ) : combined.length === 0 ? (
        <EmptyState
          message="No repairs yet. Upload photos of your bag and we'll recommend the right repairs."
          cta="Start a repair"
          to="/start-repair/assessment"
        />
      ) : (
        <ul className="space-y-4">
          {combined.map((r) => (
            <RepairCard key={r.key} r={r} thumbUrl={r.thumbnailPath ? thumbUrls[r.thumbnailPath] : null} />
          ))}
        </ul>
      )}
    </section>
  );
};


const Addresses = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Address[] | null>(null);
  usePageMeta({
    title: "My addresses — Cobbli",
    description:
      "Manage the saved addresses on your Cobbli account for faster door-to-door shoe repair pickup and return scheduling across NYC.",
  });
  useEffect(() => {
    if (!user) return;
    supabase
      .from("addresses")
      .select("id,street,street2,city,state,zip,is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as Address[]));
  }, [user]);

  return (
    <section>
      <h1
        className="text-2xl md:text-3xl uppercase mb-6"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
      >
        My Addresses
      </h1>
      {items === null ? (
        <BrandSpinner className="py-10" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-foreground/80 mb-4">No addresses on file yet.</p>
          <Button asChild variant="hero">
            <Link to="/account/addresses/new">Add an address</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-card p-4 text-sm flex items-start justify-between gap-3">
                <p className="font-medium">
                  {a.street}
                  {a.street2 ? `, ${a.street2}` : ""}, {a.city}, {a.state} {a.zip}
                  {a.is_default && <span className="ml-2 text-xs text-muted-foreground">(Default)</span>}
                </p>
                <Link
                  to={`/account/addresses/${a.id}/edit`}
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4 shrink-0"
                >
                  <Pencil size={14} /> Edit
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/account/addresses/new">+ Add a new address</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
};

const PaymentMethods = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<PaymentMethod[] | null>(null);
  usePageMeta({
    title: "My payment methods — Cobbli",
    description:
      "Manage the cards saved on your Cobbli account for faster checkout when booking door-to-door shoe repairs across NYC.",
  });
  useEffect(() => {
    if (!user) return;
    supabase
      .from("payment_methods")
      .select("id,card_brand,card_last4,exp_month,exp_year,is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => setItems((data ?? []) as PaymentMethod[]));
  }, [user]);

  return (
    <section>
      <h1
        className="text-2xl md:text-3xl uppercase mb-6"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
      >
        My payment methods
      </h1>
      {items === null ? (
        <BrandSpinner className="py-10" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-foreground/80 mb-4">No payment methods on file yet.</p>
          <Button asChild variant="hero">
            <Link to="/account/payment-methods/new">Add a payment method</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((p) => {
              const expired = isExpired(p.exp_month, p.exp_year);
              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-border bg-card p-4 text-sm flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium">
                      {p.card_brand} ending in {p.card_last4}
                      {p.is_default && <span className="ml-2 text-xs text-muted-foreground">(Default)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Exp {String(p.exp_month).padStart(2, "0")}/{String(p.exp_year).slice(-2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {expired && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                        Expired
                      </span>
                    )}
                    <Link
                      to={`/account/payment-methods/${p.id}/edit`}
                      className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4"
                    >
                      <Pencil size={14} /> Edit
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4">
            <Button asChild variant="outline">
              <Link to="/account/payment-methods/new">+ Add a new payment method</Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
};

const AddAddress = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  usePageMeta({
    title: "Add address — Cobbli",
    description: "Save a new pickup and delivery address to your Cobbli account.",
  });
  const [form, setForm] = useState({
    street: "",
    street2: "",
    city: "",
    state: "NY",
    zip: "",
    makeDefault: false,
  });
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { isServiceable } = useServiceableZips();
  useEffect(() => {
    if (!user) return;
    supabase
      .from("addresses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setExistingCount(count ?? 0));
  }, [user]);
  const isFirst = existingCount === 0;
  // Flag invalid only on a definitive false (never while loading), and require
  // an explicit true for `valid` so submit waits for confirmed coverage.
  const zipInvalid = form.zip.length === 5 && isServiceable(form.zip) === false;
  const valid =
    form.street.trim() &&
    form.city.trim() &&
    form.state &&
    /^\d{5}$/.test(form.zip) &&
    isServiceable(form.zip) === true;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || !user || submitting) return;
    setSubmitting(true);
    const shouldBeDefault = isFirst || form.makeDefault;
    const { error } = await supabase.from("addresses").insert({
      user_id: user.id,
      street: form.street.trim(),
      street2: form.street2.trim() || null,
      city: form.city.trim(),
      state: form.state,
      zip: form.zip,
      is_default: shouldBeDefault,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not save address. Please try again.");
      return;
    }
    toast.success("Address saved.");
    navigate("/account/addresses");
  };

  return (
    <section className="max-w-lg">
      <h1
        className="text-2xl md:text-3xl uppercase mb-6"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
      >
        Add address
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="street">Street address <span className="text-destructive">*</span></Label>
          <Input id="street" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="street2">Apt, suite, etc.</Label>
          <Input id="street2" value={form.street2} onChange={(e) => setForm({ ...form, street2: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
            <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State <span className="text-destructive">*</span></Label>
            <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
              <SelectTrigger id="state"><SelectValue /></SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zip">ZIP code <span className="text-destructive">*</span></Label>
          <Input id="zip" inputMode="numeric" maxLength={5} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value.replace(/\D/g, "") })} />
          {zipInvalid && (
            <p className="text-sm text-destructive">We don't currently service this ZIP code.</p>
          )}
        </div>
        {!isFirst && existingCount !== null && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.makeDefault} onCheckedChange={(c) => setForm({ ...form, makeDefault: c === true })} />
            Set as default address
          </label>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="submit" variant="hero" disabled={!valid || submitting}>
            {submitting ? "Saving…" : "Save address"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/account/addresses")}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
};

const formatAddressOneLine = (a: Address) =>
  [a.street, a.street2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean).join(", ");

const AddPaymentMethod = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  usePageMeta({
    title: "Add payment method — Cobbli",
    description: "Save a card to your Cobbli account for faster checkout.",
  });
  const [form, setForm] = useState({
    cardholderName: "",
    billingAddressId: "",
    makeDefault: false,
  });
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count }) => setExistingCount(count ?? 0));
    supabase
      .from("addresses")
      .select("id,street,street2,city,state,zip,is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as Address[];
        setAddresses(list);
        const def = list.find((a) => a.is_default) ?? list[0];
        if (def) setForm((f) => (f.billingAddressId ? f : { ...f, billingAddressId: def.id }));
      });
  }, [user]);

  useEffect(() => {
    apiFetchJson<{ clientSecret?: string }>("/payment-methods/setup-intent", { method: "POST" })
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        else setLoadError("Could not start card setup. Please try again.");
      })
      .catch(() => setLoadError("Could not start card setup. Please try again."));
  }, []);

  const isFirst = existingCount === 0;
  const detailsValid = form.cardholderName.trim().length > 1 && !!form.billingAddressId;

  const handleSuccess = async (setupIntentId: string) => {
    if (!detailsValid) {
      setFormError("Please enter a cardholder name and billing address.");
      return;
    }
    setFormError(null);
    try {
      await apiFetchJson("/payment-methods/confirm", {
        method: "POST",
        body: JSON.stringify({
          setupIntentId,
          billingAddressId: form.billingAddressId,
          cardholderName: form.cardholderName.trim(),
          makeDefault: isFirst || form.makeDefault,
        }),
      });
      toast.success("Payment method saved.");
      navigate("/account/payment-methods");
    } catch {
      setFormError("Could not save payment method. Please try again.");
    }
  };

  return (
    <section className="max-w-lg">
      <h1
        className="text-2xl md:text-3xl uppercase mb-6"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
      >
        Add payment method
      </h1>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cardholder">Cardholder name <span className="text-destructive">*</span></Label>
          <Input
            id="cardholder"
            autoComplete="cc-name"
            value={form.cardholderName}
            onChange={(e) => setForm({ ...form, cardholderName: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="billing-address">Billing address <span className="text-destructive">*</span></Label>
          {addresses.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              You don't have any saved addresses yet.{" "}
              <Link to="/account/addresses/new" className="text-primary underline underline-offset-4">
                Add one first
              </Link>
              .
            </div>
          ) : (
            <Select
              value={form.billingAddressId}
              onValueChange={(v) => setForm({ ...form, billingAddressId: v })}
            >
              <SelectTrigger id="billing-address">
                <SelectValue placeholder="Select a billing address" />
              </SelectTrigger>
              <SelectContent>
                {addresses.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {formatAddressOneLine(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {!isFirst && existingCount !== null && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.makeDefault} onCheckedChange={(c) => setForm({ ...form, makeDefault: c === true })} />
            Set as default payment method
          </label>
        )}

        <div className="space-y-1.5">
          <Label>Card details <span className="text-destructive">*</span></Label>
          {loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : !clientSecret ? (
            <BrandSpinner className="py-6" />
          ) : (
            <StripeCardSetupForm
              clientSecret={clientSecret}
              submitLabel="Save payment method"
              disabled={!detailsValid}
              onSuccess={handleSuccess}
              onError={setFormError}
              onCancel={() => navigate("/account/payment-methods")}
            >
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </StripeCardSetupForm>
          )}
        </div>
      </div>
    </section>
  );
};

const EditAddress = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isServiceable } = useServiceableZips();
  usePageMeta({
    title: "Edit address — Cobbli",
    description: "Update a saved pickup and delivery address on your Cobbli account.",
  });
  const [form, setForm] = useState({
    street: "",
    street2: "",
    city: "",
    state: "NY",
    zip: "",
    makeDefault: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [wasDefault, setWasDefault] = useState(false);
  const [otherCount, setOtherCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data } = await supabase
        .from("addresses")
        .select("street,street2,city,state,zip,is_default")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          street: data.street ?? "",
          street2: data.street2 ?? "",
          city: data.city ?? "",
          state: data.state ?? "NY",
          zip: data.zip ?? "",
          makeDefault: !!data.is_default,
        });
        setWasDefault(!!data.is_default);
      }
      const { count } = await supabase
        .from("addresses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("id", id);
      setOtherCount(count ?? 0);
      setLoaded(true);
    })();
  }, [user, id]);

  const isOnly = otherCount === 0;
  const zipInvalid = form.zip.length === 5 && isServiceable(form.zip) === false;
  const valid =
    form.street.trim() &&
    form.city.trim() &&
    form.state &&
    /^\d{5}$/.test(form.zip) &&
    isServiceable(form.zip) === true;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || !user || !id || submitting) return;
    setSubmitting(true);
    // If this is the only address, keep it as default. Otherwise honor checkbox,
    // but never demote the previously-default unless another becomes default.
    const newDefault = isOnly ? true : wasDefault ? true : form.makeDefault;
    const { error } = await supabase
      .from("addresses")
      .update({
        street: form.street.trim(),
        street2: form.street2.trim() || null,
        city: form.city.trim(),
        state: form.state,
        zip: form.zip,
        is_default: newDefault,
      })
      .eq("id", id)
      .eq("user_id", user.id);
    setSubmitting(false);
    if (error) {
      toast.error("Could not update address. Please try again.");
      return;
    }
    toast.success("Address updated.");
    navigate("/account/addresses");
  };

  if (!loaded) return <BrandSpinner className="py-10" />;

  return (
    <section className="max-w-lg">
      <h1
        className="text-2xl md:text-3xl uppercase mb-6"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
      >
        Edit address
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="street">Street address <span className="text-destructive">*</span></Label>
          <Input id="street" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="street2">Apt, suite, etc.</Label>
          <Input id="street2" value={form.street2} onChange={(e) => setForm({ ...form, street2: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
            <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="state">State <span className="text-destructive">*</span></Label>
            <Select value={form.state} onValueChange={(v) => setForm({ ...form, state: v })}>
              <SelectTrigger id="state"><SelectValue /></SelectTrigger>
              <SelectContent>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zip">ZIP code <span className="text-destructive">*</span></Label>
          <Input id="zip" inputMode="numeric" maxLength={5} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value.replace(/\D/g, "") })} />
          {zipInvalid && (
            <p className="text-sm text-destructive">We don't currently service this ZIP code.</p>
          )}
        </div>
        {!isOnly && !wasDefault && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.makeDefault} onCheckedChange={(c) => setForm({ ...form, makeDefault: c === true })} />
            Set as default address
          </label>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="submit" variant="hero" disabled={!valid || submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/account/addresses")}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
};

const EditPaymentMethod = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isServiceable } = useServiceableZips();
  usePageMeta({
    title: "Edit payment method — Cobbli",
    description: "Update a saved card on your Cobbli account.",
  });
  const [existing, setExisting] = useState<{ brand: string; last4: string; isDefault: boolean } | null>(null);
  const [form, setForm] = useState({
    cardholderName: "",
    exp: "",
    replaceCard: false,
    makeDefault: false,
    billingAddressId: "",
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [newAddr, setNewAddr] = useState({
    street: "",
    street2: "",
    city: "",
    state: "NY",
    zip: "",
    makeDefault: false,
  });
  const isNewAddress = form.billingAddressId === "__new__";
  const newAddrZipInvalid = newAddr.zip.length === 5 && isServiceable(newAddr.zip) === false;
  const newAddrValid =
    !!newAddr.street.trim() &&
    !!newAddr.city.trim() &&
    !!newAddr.state &&
    /^\d{5}$/.test(newAddr.zip) &&
    isServiceable(newAddr.zip) === true;
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [otherCount, setOtherCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data } = await supabase
        .from("payment_methods")
        .select("card_brand,card_last4,exp_month,exp_year,is_default,cardholder_name,billing_address_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setExisting({
          brand: data.card_brand,
          last4: data.card_last4,
          isDefault: !!data.is_default,
        });
        const mm = String(data.exp_month).padStart(2, "0");
        const yy = String(data.exp_year).slice(-2);
        setForm((f) => ({
          ...f,
          exp: `${mm}/${yy}`,
          makeDefault: !!data.is_default,
          cardholderName: (data as { cardholder_name?: string | null }).cardholder_name ?? "",
          billingAddressId: (data as { billing_address_id?: string | null }).billing_address_id ?? "",
        }));
      }
      const { count } = await supabase
        .from("payment_methods")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .neq("id", id);
      setOtherCount(count ?? 0);
      const { data: addrs } = await supabase
        .from("addresses")
        .select("id,street,street2,city,state,zip,is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      setAddresses((addrs ?? []) as Address[]);
    })();
  }, [user, id]);

  useEffect(() => {
    if (!form.replaceCard || clientSecret) return;
    apiFetchJson<{ clientSecret?: string }>("/payment-methods/setup-intent", { method: "POST" })
      .then((data) => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
        else setSetupError("Could not start card setup. Please try again.");
      })
      .catch(() => setSetupError("Could not start card setup. Please try again."));
  }, [form.replaceCard, clientSecret]);

  const isOnly = otherCount === 0;
  const expMatch = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(form.exp);
  const detailsValid =
    !!existing &&
    form.cardholderName.trim().length > 1 &&
    !!form.billingAddressId &&
    (!isNewAddress || newAddrValid);
  const valid = detailsValid && !!expMatch;

  const resolveBillingAddressId = async (): Promise<string | null> => {
    if (!isNewAddress || !user) return form.billingAddressId;
    const { data: inserted, error: addrErr } = await supabase
      .from("addresses")
      .insert({
        user_id: user.id,
        street: newAddr.street.trim(),
        street2: newAddr.street2.trim() || null,
        city: newAddr.city.trim(),
        state: newAddr.state,
        zip: newAddr.zip,
        is_default: newAddr.makeDefault,
      })
      .select("id")
      .single();
    if (addrErr || !inserted) {
      toast.error("Could not save new address. Please try again.");
      return null;
    }
    return inserted.id;
  };

  const handleSubmit = async () => {
    if (!valid || !user || !id || submitting || !expMatch) return;
    setSubmitting(true);
    const billingAddressId = await resolveBillingAddressId();
    if (!billingAddressId) {
      setSubmitting(false);
      return;
    }
    const newDefault = isOnly ? true : existing!.isDefault ? true : form.makeDefault;
    try {
      await apiFetchJson(`/payment-methods/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          cardholderName: form.cardholderName.trim(),
          billingAddressId,
          makeDefault: newDefault,
          expMonth: Number(expMatch[1]),
          expYear: 2000 + Number(expMatch[2]),
        }),
      });
      toast.success("Payment method updated.");
      navigate("/account/payment-methods");
    } catch {
      toast.error("Could not update payment method. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplaceSuccess = async (setupIntentId: string) => {
    if (!detailsValid || !id) {
      setSetupError("Please enter a cardholder name and billing address.");
      return;
    }
    const billingAddressId = await resolveBillingAddressId();
    if (!billingAddressId) return;
    const newDefault = isOnly ? true : existing!.isDefault ? true : form.makeDefault;
    try {
      await apiFetchJson("/payment-methods/confirm", {
        method: "POST",
        body: JSON.stringify({
          setupIntentId,
          replaceId: id,
          billingAddressId,
          cardholderName: form.cardholderName.trim(),
          makeDefault: newDefault,
        }),
      });
      toast.success("Payment method updated.");
      navigate("/account/payment-methods");
    } catch {
      setSetupError("Could not update payment method. Please try again.");
    }
  };

  if (!existing) return <BrandSpinner className="py-10" />;

  const billingFields = (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="billing-address">Billing address <span className="text-destructive">*</span></Label>
        <Select
          value={form.billingAddressId}
          onValueChange={(v) => setForm({ ...form, billingAddressId: v })}
        >
          <SelectTrigger id="billing-address">
            <SelectValue placeholder="Select a billing address" />
          </SelectTrigger>
          <SelectContent>
            {addresses.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {formatAddressOneLine(a)}
              </SelectItem>
            ))}
            <SelectItem value="__new__">+ Add a new address</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isNewAddress && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-street">Street address <span className="text-destructive">*</span></Label>
            <Input
              id="new-street"
              value={newAddr.street}
              onChange={(e) => setNewAddr({ ...newAddr, street: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-street2">Apt, suite, etc.</Label>
            <Input
              id="new-street2"
              value={newAddr.street2}
              onChange={(e) => setNewAddr({ ...newAddr, street2: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-city">City <span className="text-destructive">*</span></Label>
              <Input
                id="new-city"
                value={newAddr.city}
                onChange={(e) => setNewAddr({ ...newAddr, city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-state">State <span className="text-destructive">*</span></Label>
              <Select value={newAddr.state} onValueChange={(v) => setNewAddr({ ...newAddr, state: v })}>
                <SelectTrigger id="new-state"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-zip">ZIP code <span className="text-destructive">*</span></Label>
            <Input
              id="new-zip"
              inputMode="numeric"
              maxLength={5}
              value={newAddr.zip}
              onChange={(e) => setNewAddr({ ...newAddr, zip: e.target.value.replace(/\D/g, "") })}
            />
            {newAddrZipInvalid && (
              <p className="text-sm text-destructive">We don't currently service this ZIP code.</p>
            )}
          </div>
          {addresses.length > 0 && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={newAddr.makeDefault}
                onCheckedChange={(c) => setNewAddr({ ...newAddr, makeDefault: c === true })}
              />
              Make this my default address
            </label>
          )}
        </div>
      )}

      {!isOnly && !existing.isDefault && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={form.makeDefault} onCheckedChange={(c) => setForm({ ...form, makeDefault: c === true })} />
          Set as default payment method
        </label>
      )}
    </>
  );

  return (
    <section className="max-w-lg">
      <h1
        className="text-2xl md:text-3xl uppercase mb-6"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
      >
        Edit payment method
      </h1>
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">
            {existing.brand} ending in {existing.last4}
          </p>
          <button
            type="button"
            onClick={() => setForm({ ...form, replaceCard: !form.replaceCard })}
            className="mt-2 text-sm text-primary underline underline-offset-4"
          >
            {form.replaceCard ? "Keep this card" : "Replace card details"}
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cardholder">Cardholder name <span className="text-destructive">*</span></Label>
          <Input
            id="cardholder"
            autoComplete="cc-name"
            value={form.cardholderName}
            onChange={(e) => setForm({ ...form, cardholderName: e.target.value })}
          />
        </div>

        {form.replaceCard ? (
          <>
            {billingFields}
            <div className="space-y-1.5">
              <Label>New card details <span className="text-destructive">*</span></Label>
              {setupError && !clientSecret && <p className="text-sm text-destructive">{setupError}</p>}
              {!clientSecret ? (
                !setupError && <BrandSpinner className="py-6" />
              ) : (
                <StripeCardSetupForm
                  clientSecret={clientSecret}
                  submitLabel="Save changes"
                  disabled={!detailsValid}
                  onSuccess={handleReplaceSuccess}
                  onError={setSetupError}
                  onCancel={() => navigate("/account/payment-methods")}
                >
                  {setupError && <p className="text-sm text-destructive">{setupError}</p>}
                </StripeCardSetupForm>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="exp">Expiration (MM/YY) <span className="text-destructive">*</span></Label>
              <Input
                id="exp"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={form.exp}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                  if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                  setForm({ ...form, exp: v });
                }}
              />
            </div>
            {billingFields}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="hero" disabled={!valid || submitting} onClick={handleSubmit}>
                {submitting ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/account/payment-methods")}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

const Password = () => {
  usePageMeta({
    title: "My password — Cobbli",
    description:
      "Update the password on your Cobbli account to keep your shoe repair orders, saved addresses and payment methods secure.",
  });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    current.length > 0 && next.length > 0 && confirm.length > 0 && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCurrentError(null);
    setSuccess(null);
    if (next !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (next.length < 8) {
      setError("Password too short");
      return;
    }
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email;
    if (!email) {
      setSubmitting(false);
      setError("You must be signed in to change your password.");
      return;
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: current,
    });
    if (signInErr) {
      setSubmitting(false);
      setCurrentError("Incorrect current password. Please try again.");
      return;
    }
    const { error: err } = await supabase.auth.updateUser({ password: next });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess("Your password has been updated.");
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  return (
    <section className="max-w-md">
      <h1
        className="text-2xl md:text-3xl uppercase mb-6"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
      >
        My Password
      </h1>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <PasswordField
          id="current-pw"
          label="Current Password"
          value={current}
          onChange={(v) => { setCurrent(v); if (currentError) setCurrentError(null); }}
          show={showCurrent}
          setShow={setShowCurrent}
          error={currentError}
        />
        <PasswordField id="new-pw" label="New Password" value={next} onChange={setNext} show={showNext} setShow={setShowNext} />
        <PasswordField id="confirm-pw" label="Confirm New Password" value={confirm} onChange={setConfirm} show={showConfirm} setShow={setShowConfirm} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-status-green">{success}</p>}
        <Button type="submit" variant="hero" size="lg" disabled={!canSubmit}>
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </section>
  );
};

const PasswordField = ({
  id,
  label,
  value,
  onChange,
  show,
  setShow,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (b: boolean) => void;
  error?: string | null;
}) => (
  <div className="space-y-2">
    <Label htmlFor={id}>{label}</Label>
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        aria-invalid={!!error}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
    {error && <p className="text-sm text-destructive">{error}</p>}
  </div>
);

const Contact = () => {
  usePageMeta({
    title: "Contact us — Cobbli",
    description:
      "Get in touch with the Cobbli team about your NYC shoe repair order, our service area, pickup scheduling or anything else. We're happy to help.",
  });
  return (
    <section className="max-w-2xl">
      <h1
        className="text-2xl md:text-3xl uppercase mb-4"
        style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
      >
        Contact Us
      </h1>
      <p className="text-foreground/90 leading-relaxed">
        We'd love to hear from you! You can reach us at{" "}
        <a href="mailto:support@cobbli.com" className="underline hover:text-primary">
          support@cobbli.com
        </a>{" "}
        and we will get back to you within 2 business days.
      </p>
    </section>
  );
};

const Account = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  // Show one-time "email verified" toast after the verification redirect.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verified") === "1") {
      toast.success("Your email has been verified.");
      params.delete("verified");
      const next = params.toString();
      navigate(
        { pathname: location.pathname, search: next ? `?${next}` : "" },
        { replace: true },
      );
    }
  }, [location.pathname, location.search, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin", { replace: true });
  };


  // Restyled 2026-08-26 (Danielle's call) — cream page bg + Header
  // theme="cream" only; the account dashboard itself (sidebar, orders table,
  // addresses, payment methods, settings forms) keeps its existing
  // functional styling, same page-shell-only scoping applied to the rest of
  // the account/checkout pages — this page in particular is too data-dense
  // to safely recolor wholesale in this pass.
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-14">
          <div className="flex flex-col md:flex-row gap-10 md:gap-14">
            <Sidebar onSignOut={handleSignOut} />
            <div className="flex-1 min-w-0">
              <Routes>
                <Route index element={<Navigate to="orders" replace />} />
                <Route path="orders" element={<Orders />} />
                <Route path="addresses" element={<Addresses />} />
                <Route path="addresses/new" element={<AddAddress />} />
                <Route path="addresses/:id/edit" element={<EditAddress />} />
                <Route path="payment-methods" element={<PaymentMethods />} />
                <Route path="payment-methods/new" element={<AddPaymentMethod />} />
                <Route path="payment-methods/:id/edit" element={<EditPaymentMethod />} />
                <Route path="password" element={<Password />} />
                <Route path="contact" element={<Contact />} />
                <Route path="*" element={<Navigate to="orders" replace />} />
              </Routes>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Account;
