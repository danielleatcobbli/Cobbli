import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAccount, isExpired } from "@/context/AccountContext";
import { formatPrice } from "@/context/BagContext";
import { usePageMeta } from "@/hooks/usePageMeta";

// Mock signed-in user (UI only)
const MOCK_USER = {
  name: "Jane Doe",
  email: "[email protected]",
};

type NavItem = { to: string; label: string };
const NAV: NavItem[] = [
  { to: "/account/orders", label: "My Orders" },
  { to: "/account/addresses", label: "My Addresses" },
  { to: "/account/payment-methods", label: "My Payment Methods" },
  { to: "/account/password", label: "My Password" },
  { to: "/account/contact", label: "Contact Us" },
];

const Sidebar = ({ onSignOut }: { onSignOut: () => void }) => (
  <aside className="md:w-64 md:shrink-0">
    <div className="mb-6">
      <p className="font-semibold text-foreground">{MOCK_USER.name}</p>
      <p className="text-sm text-muted-foreground break-all">{MOCK_USER.email}</p>
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

// ---------- My Orders ----------
const Orders = () => {
  const { orders } = useAccount();
  usePageMeta({
    title: "My orders — Cobbli",
    description: "View your past Cobbli shoe repair orders, see what's been picked up and returned, and quickly start a new repair from your account dashboard.",
  });

  return (
    <section aria-labelledby="orders-h">
      <h1 id="orders-h" className="text-2xl md:text-3xl font-semibold mb-6">
        My Orders
      </h1>
      {orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-foreground/80 mb-4">You haven't placed any orders yet</p>
          <Button asChild variant="hero">
            <Link to="/start-repair">Start a repair</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => {
            const itemCount = o.pairs.reduce((s, p) => s + p.services.length, 0);
            return (
              <li key={o.id} className="rounded-lg border border-border bg-card p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Order #{o.number}</p>
                    <p className="text-sm text-muted-foreground">
                      Placed {new Date(o.placedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {o.pairs.length} pair{o.pairs.length === 1 ? "" : "s"} · {itemCount} service{itemCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(o.subtotal)}</p>
                    <Link
                      to={`/order-confirmation/${o.id}`}
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      View details
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// ---------- My Addresses ----------
const Addresses = () => {
  const { addresses } = useAccount();
  usePageMeta({
    title: "My addresses — Cobbli",
    description: "Manage the saved addresses on your Cobbli account for faster door-to-door shoe repair pickup and return scheduling across NYC.",
  });
  return (
    <section aria-labelledby="addr-h">
      <h1 id="addr-h" className="text-2xl md:text-3xl font-semibold mb-6">
        My Addresses
      </h1>
      {addresses.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-foreground/80">
          No addresses on file yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-card p-4 text-sm">
              <p className="font-medium">
                {a.street}{a.street2 ? `, ${a.street2}` : ""}, {a.city}, {a.state} {a.zip}
                {a.isDefault && <span className="ml-2 text-xs text-muted-foreground">(Default)</span>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// ---------- My Payment Methods ----------
const PaymentMethods = () => {
  const { paymentMethods } = useAccount();
  usePageMeta({
    title: "My payment methods — Cobbli",
    description: "Manage the cards saved on your Cobbli account for faster checkout when booking door-to-door shoe repairs across NYC.",
  });
  return (
    <section aria-labelledby="pm-h">
      <h1 id="pm-h" className="text-2xl md:text-3xl font-semibold mb-6">
        My Payment Methods
      </h1>
      {paymentMethods.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-foreground/80">
          No payment methods on file yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {paymentMethods.map((p) => {
            const expired = isExpired(p);
            return (
              <li key={p.id} className="rounded-lg border border-border bg-card p-4 text-sm flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {p.brand} ending in {p.last4}
                    {p.isDefault && <span className="ml-2 text-xs text-muted-foreground">(Default)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Exp {String(p.expMonth).padStart(2, "0")}/{String(p.expYear).slice(-2)}
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

// ---------- My Password ----------
const Password = () => {
  usePageMeta({
    title: "My password — Cobbli",
    description: "Update the password on your Cobbli account to keep your shoe repair orders, saved addresses and payment methods secure.",
  });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit =
    current.length > 0 && next.length > 0 && confirm.length > 0;

  const handleSubmit = (e: FormEvent) => {
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
    setSuccess("Your password has been updated.");
    setCurrent("");
    setNext("");
    setConfirm("");
  };

  return (
    <section aria-labelledby="pw-h" className="max-w-md">
      <h1 id="pw-h" className="text-2xl md:text-3xl font-semibold mb-6">
        My Password
      </h1>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <PasswordField
          id="current-pw"
          label="Current Password"
          value={current}
          onChange={setCurrent}
          show={showCurrent}
          setShow={setShowCurrent}
        />
        <PasswordField
          id="new-pw"
          label="New Password"
          value={next}
          onChange={setNext}
          show={showNext}
          setShow={setShowNext}
        />
        <PasswordField
          id="confirm-pw"
          label="Confirm New Password"
          value={confirm}
          onChange={setConfirm}
          show={showConfirm}
          setShow={setShowConfirm}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-status-green">{success}</p>}
        <Button type="submit" variant="hero" size="lg" disabled={!canSubmit}>
          Update password
        </Button>
      </form>
    </section>
  );
};

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  setShow: (b: boolean) => void;
};

const PasswordField = ({ id, label, value, onChange, show, setShow }: PasswordFieldProps) => (
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

// ---------- Contact Us ----------
const Contact = () => {
  usePageMeta({
    title: "Contact us — Cobbli",
    description: "Get in touch with the Cobbli team about your NYC shoe repair order, our service area, pickup scheduling or anything else. We're happy to help.",
  });
  return (
    <section aria-labelledby="contact-h" className="max-w-2xl">
      <h1 id="contact-h" className="text-2xl md:text-3xl font-semibold mb-4">
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

  const handleSignOut = () => {
    localStorage.removeItem("cobbli:signed-in");
    navigate("/", { replace: true });
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
