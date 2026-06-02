import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
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
import { isServiceableZip } from "@/data/serviceAreas";
import { cn } from "@/lib/utils";
import { usePageMeta } from "@/hooks/usePageMeta";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

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

type Order = {
  id: string;
  order_number: string;
  placed_at: string;
  total_cents: number;
};

const NAV = [
  { to: "/account/orders", label: "My Orders" },
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
      <nav aria-label="Account" className="flex flex-col gap-1 text-sm">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "py-2 transition-colors hover:text-primary",
                isActive ? "underline underline-offset-4 font-medium text-primary" : "text-foreground/80",
              )
            }
          >
            {item.label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onSignOut}
          className="text-left py-2 text-foreground/80 hover:text-primary transition-colors"
        >
          Sign Out
        </button>
      </nav>
    </aside>
  );
};

const Orders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  usePageMeta({
    title: "My orders — Cobbli",
    description:
      "View your past Cobbli shoe repair orders, see what's been picked up and returned, and quickly start a new repair from your account dashboard.",
  });
  useEffect(() => {
    if (!user) return;
    supabase
      .from("orders")
      .select("id,order_number,placed_at,total_cents")
      .eq("user_id", user.id)
      .order("placed_at", { ascending: false })
      .then(({ data }) => setOrders((data ?? []) as Order[]));
  }, [user]);

  return (
    <section>
      <h1 className="text-2xl md:text-3xl font-semibold mb-6">My Orders</h1>
      {orders === null ? (
        <BrandSpinner className="py-10" />
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-foreground/80 mb-4">You haven't placed any orders yet</p>
          <Button asChild variant="hero">
            <Link to="/start-repair">Start a repair</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-lg border border-border bg-card p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Order #{o.order_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Placed{" "}
                    {new Date(o.placed_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatPrice(o.total_cents)}</p>
                  <Link
                    to={`/order-confirmation/${o.id}`}
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    View details
                  </Link>
                </div>
              </div>
            </li>
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
      <h1 className="text-2xl md:text-3xl font-semibold mb-6">My Addresses</h1>
      {items === null ? (
        <BrandSpinner className="py-10" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-foreground/80 mb-4">No addresses on file yet.</p>
          <Button asChild variant="hero">
            <Link to="/start-repair">Add an address</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-medium">
                {a.street}
                {a.street2 ? `, ${a.street2}` : ""}, {a.city}, {a.state} {a.zip}
                {a.is_default && <span className="ml-2 text-xs text-muted-foreground">(Default)</span>}
              </p>
            </li>
          ))}
        </ul>
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
      <h1 className="text-2xl md:text-3xl font-semibold mb-6">My Payment Methods</h1>
      {items === null ? (
        <BrandSpinner className="py-10" />
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-foreground/80 mb-4">No payment methods on file yet.</p>
          <Button asChild variant="hero">
            <Link to="/start-repair">Add a payment method</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const expired = isExpired(p.exp_month, p.exp_year);
            return (
              <li
                key={p.id}
                className="rounded-lg border border-border bg-card p-4 text-sm flex items-center justify-between"
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
                {expired && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                    Expired
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const Password = () => {
  usePageMeta({
    title: "My password — Cobbli",
    description:
      "Update the password on your Cobbli account to keep your shoe repair orders, saved addresses and payment methods secure.",
  });
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = next.length > 0 && confirm.length > 0 && !submitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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
    const { error: err } = await supabase.auth.updateUser({ password: next });
    setSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess("Your password has been updated.");
    setNext("");
    setConfirm("");
  };

  return (
    <section className="max-w-md">
      <h1 className="text-2xl md:text-3xl font-semibold mb-6">My Password</h1>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (b: boolean) => void;
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
      <h1 className="text-2xl md:text-3xl font-semibold mb-4">Contact Us</h1>
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


  return (
    <div className="min-h-screen flex flex-col bg-background">
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
                <Route path="payment-methods" element={<PaymentMethods />} />
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
