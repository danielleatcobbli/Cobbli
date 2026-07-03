import { useEffect, useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Check, ChevronDown, Pencil, Lock, MessageSquare } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
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
import { useBag, formatPrice } from "@/context/BagContext";
import { useLivePricedBag } from "@/hooks/useLivePricedBag";
import {
  useAccount,
  US_STATES,
  type Address,
} from "@/context/AccountContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useServiceableZips } from "@/hooks/useServiceableZips";
import { cn } from "@/lib/utils";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckoutPanel } from "@/components/StripeEmbeddedCheckout";

const FREE_COURIER_THRESHOLD = 10000;
const COURIER_FEE = 1500;
type Step = "contact" | "address" | "payment";

const Checkout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: authUser } = useAuth();
  const { isServiceable } = useServiceableZips();
  const { pairs: rawPairs, clear } = useBag();
  const { pairs, subtotal } = useLivePricedBag(rawPairs);
  const {
    user,
    updateContact,
    addresses,
    addAddress,
    updateAddress,
    paymentMethods,
    addOrder,
  } = useAccount();


  usePageMeta({
    title: "Checkout — Cobbli",
    description:
      "Complete your Cobbli shoe repair order: confirm contact information, delivery address and payment for door-to-door pickup and return across NYC.",
  });

  const courierFee = subtotal >= FREE_COURIER_THRESHOLD ? 0 : COURIER_FEE;
  const orderSubtotal = subtotal + courierFee;

  // Stripe returns user here with ?session_id=...&order_id=...
  const returningSessionId = searchParams.get("session_id");


  // ---------- Contact ----------
  const [contactEditing, setContactEditing] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [contactDone, setContactDone] = useState(true);
  const contactValid = /\S+@\S+\.\S+/.test(email) && phone.replace(/\D/g, "").length >= 10;

  // ---------- Address ----------
  const defaultAddrId = useMemo(
    () => addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
    [addresses],
  );
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(defaultAddrId);
  const [addingAddr, setAddingAddr] = useState(addresses.length === 0);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({
    street: "",
    street2: "",
    city: "",
    state: "NY",
    zip: "",
    makeDefault: false,
  });
  // Only flag as invalid on a definitive "not serviceable" (false) — never
  // while the zip list is still loading (null), to avoid false-failing a valid
  // address. `valid` requires an explicit true, so submit stays disabled until
  // the list confirms coverage.
  const zipInvalid = addrForm.zip.length === 5 && isServiceable(addrForm.zip) === false;
  const addrFormValid =
    addrForm.street.trim() &&
    addrForm.city.trim() &&
    addrForm.state &&
    /^\d{5}$/.test(addrForm.zip) &&
    isServiceable(addrForm.zip) === true;
  const showAddrForm = addingAddr || editingAddrId !== null;
  const addressDone = !showAddrForm && !!selectedAddrId;
  const selectedAddress = addresses.find((a) => a.id === selectedAddrId);

  // ---------- Payment ----------
  // If the user has a saved payment method, let them either keep it or
  // switch to a new card (collected via Stripe on the next step).
  const defaultPmId = useMemo(
    () => paymentMethods.find((p) => p.isDefault)?.id ?? paymentMethods[0]?.id ?? null,
    [paymentMethods],
  );
  const [selectedPmId, setSelectedPmId] = useState<string | null>(defaultPmId);
  const [useNewCard, setUseNewCard] = useState(paymentMethods.length === 0);
  useEffect(() => {
    if (!selectedPmId && defaultPmId) setSelectedPmId(defaultPmId);
    if (paymentMethods.length === 0) setUseNewCard(true);
  }, [defaultPmId, selectedPmId, paymentMethods.length]);
  const paymentDone = addressDone && (useNewCard || !!selectedPmId);


  // ---------- Step orchestration ----------
  const [openStep, setOpenStep] = useState<Step>("contact");
  const [placing, setPlacing] = useState(false);
  const [cartPayload, setCartPayload] = useState<unknown | null>(null);
  const [showStripe, setShowStripe] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    if (!selectedAddrId && defaultAddrId) setSelectedAddrId(defaultAddrId);
  }, [defaultAddrId, selectedAddrId]);

  // Handle return from Stripe — Stripe only sends the user back to return_url
  // after payment is confirmed, so clear the bag immediately. Then poll the
  // orders table (populated asynchronously by the webhook) and navigate to
  // the confirmation page as soon as the row appears.
  useEffect(() => {
    if (!returningSessionId) return;
    let cancelled = false;
    setFinalizing(true);

    // Payment is confirmed at this point — clear the bag right away so the
    // user never sees a stale cart, even if the webhook lags behind.
    clear();

    const addr = addresses.find((a) => a.id === selectedAddrId) ?? addresses[0];

    const finalize = async () => {
      // Poll for up to ~60s. Keep the user on the Finalizing screen the
      // whole time rather than bouncing them to an empty My Orders list.
      let dbOrderId: string | null = null;
      for (let i = 0; i < 60 && !cancelled; i++) {
        const { data } = await supabase
          .from("orders")
          .select("id")
          .eq("stripe_session_id", returningSessionId)
          .maybeSingle();
        if (data?.id) {
          dbOrderId = data.id;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (cancelled) return;

      if (!dbOrderId) {
        toast({
          title: "Still finalizing your order",
          description:
            "Your payment was received. Your order will appear in My Orders shortly — refresh in a moment if you don't see it.",
        });
        navigate("/account/orders", { replace: true });
        return;
      }

      if (!addr || pairs.length === 0) {
        navigate(`/order-confirmation/${dbOrderId}`, { replace: true });
        return;
      }

      const order = addOrder({
        email,
        phone,
        address: addr,
        paymentLast4: "••••",
        pairs,
        repairsSubtotal: subtotal,
        courierFee,
        subtotal: orderSubtotal,
      });
      navigate(`/order-confirmation/${order.id}`, { replace: true });
    };

    finalize();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returningSessionId]);

  if (pairs.length === 0 && !returningSessionId) return <Navigate to="/bag" replace />;

  // ----- handlers -----
  const saveContact = () => {
    if (!contactValid) return;
    updateContact(email, phone);
    setContactEditing(false);
    setContactDone(true);
    if (openStep === "contact") setOpenStep("address");
  };

  const beginAddAddress = () => {
    setAddrForm({ street: "", street2: "", city: "", state: "NY", zip: "", makeDefault: false });
    setEditingAddrId(null);
    setAddingAddr(true);
  };

  const beginEditAddress = (a: Address) => {
    setAddrForm({
      street: a.street,
      street2: a.street2 ?? "",
      city: a.city,
      state: a.state,
      zip: a.zip,
      makeDefault: a.isDefault,
    });
    setAddingAddr(false);
    setEditingAddrId(a.id);
  };

  const cancelAddressForm = () => {
    setAddingAddr(false);
    setEditingAddrId(null);
  };

  const saveAddress = () => {
    if (!addrFormValid) return;
    const payload = {
      street: addrForm.street.trim(),
      street2: addrForm.street2.trim() || undefined,
      city: addrForm.city.trim(),
      state: addrForm.state,
      zip: addrForm.zip,
      isDefault: addrForm.makeDefault || addresses.length === 0,
    };
    if (editingAddrId) {
      const updated = updateAddress(editingAddrId, payload);
      if (updated) setSelectedAddrId(updated.id);
      setEditingAddrId(null);
    } else {
      const addr = addAddress(payload);
      setSelectedAddrId(addr.id);
      setAddingAddr(false);
    }
    setOpenStep("payment");
  };


  const continueAddress = () => {
    if (!selectedAddrId) return;
    setOpenStep("payment");
  };

  const allDone = contactDone && addressDone && paymentDone;

  const placeOrder = async () => {
    if (!allDone || !selectedAddress || !authUser || placing) return;
    setPlacing(true);
    try {
      // Build the payload that the webhook will use to create the orders row
      // and order_items rows once Stripe confirms payment. No DB writes happen
      // here — abandoned checkouts leave nothing behind.
      const payload = {
        contact_email: email,
        contact_phone: phone,
        delivery_address: selectedAddress,
        repairs_subtotal_cents: subtotal,
        courier_fee_cents: courierFee,
        total_cents: orderSubtotal,
        items: pairs.flatMap((p) =>
          p.services.map((s) => ({
            pair_snapshot: p,
            service_snapshot: {
              id: s.id,
              name: s.name,
              ...(s.paintConsent ? { paint_consent: s.paintConsent } : {}),
            },
            price_cents: s.price,
          })),
        ),
      };
      setCartPayload(payload);
      setShowStripe(true);
    } catch (e: any) {
      console.error("place order failed", e);
      toast({
        title: "Could not start checkout",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
      setPlacing(false);
    }
  };

  const returnUrl = `${window.location.origin}/checkout?session_id={CHECKOUT_SESSION_ID}`;

  if (returningSessionId && finalizing) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container py-16 text-center">
            <h1 className="text-2xl font-semibold mb-3">Finalizing your order…</h1>
            <p className="text-sm text-muted-foreground">
              Hang tight — we're confirming your payment.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (showStripe && cartPayload) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <PaymentTestModeBanner />
        <main className="flex-1">
          <div className="container py-10 max-w-2xl">
            <h1 className="text-2xl md:text-3xl font-semibold mb-2">Payment</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Total <span className="font-medium text-foreground">{formatPrice(orderSubtotal)}</span> — payment is processed securely by Stripe.
            </p>
            <div className="rounded-lg border border-border overflow-hidden bg-card">
              <StripeEmbeddedCheckoutPanel
                kind="cart"
                cartPayload={cartPayload}
                returnUrl={returnUrl}
              />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <PaymentTestModeBanner />
      <main className="flex-1">
        <div className="container py-10">
          <h1 className="text-3xl md:text-4xl font-semibold mb-6">Checkout</h1>

          <div
            className="rounded-lg p-4 mb-8 flex items-start gap-3"
            style={{ backgroundColor: "#fff8e7", border: "1px solid #f0d870" }}
          >
            <MessageSquare size={18} className="mt-0.5 shrink-0" style={{ color: "#3d1700" }} />
            <p className="text-sm" style={{ color: "#3d1700" }}>
              <span className="font-bold" style={{ color: "#3d1700" }}>We'll text you</span>{" "}
              to schedule your pickup and return windows once your order is placed.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {/* Step 1: Contact */}
              <StepCard
                index={1}
                title="Contact information"
                open={openStep === "contact"}
                done={contactDone && !contactEditing}
                onOpen={() => setOpenStep("contact")}
                summary={
                  contactDone && !contactEditing ? (
                    <span className="text-sm text-foreground/80">
                      {email} · {phone}
                    </span>
                  ) : null
                }
              >
                {!contactEditing ? (
                  <div className="space-y-3">
                    <Row label="Email" value={email} />
                    <Row label="Phone" value={phone} />
                    <p className="text-xs -mt-1.5" style={{ color: "#7a5c40" }}>
                      We'll text this number to coordinate your pickup and return
                    </p>
                    <button
                      type="button"
                      onClick={() => setContactEditing(true)}
                      className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4"
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <div>
                      <Button variant="hero" onClick={() => setOpenStep("address")}>
                        Continue
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Field id="email" label="Email">
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </Field>
                    <Field id="phone" label="Phone">
                      <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      <p className="text-xs mt-1.5" style={{ color: "#7a5c40" }}>
                        We'll text this number to coordinate your pickup and return
                      </p>
                    </Field>
                    <Button variant="hero" disabled={!contactValid} onClick={saveContact}>
                      Save &amp; Continue
                    </Button>
                  </div>
                )}
              </StepCard>

              {/* Step 2: Address */}
              <StepCard
                index={2}
                title="Where should we get your shoes?"
                open={openStep === "address"}
                done={addressDone && openStep !== "address"}
                onOpen={() => setOpenStep("address")}
                summary={
                  addressDone && selectedAddress && openStep !== "address" ? (
                    <span className="text-sm text-foreground/80">{formatAddr(selectedAddress)}</span>
                  ) : null
                }
              >
                {addresses.length > 0 && !showAddrForm && (
                  <div className="space-y-3">
                    <ul className="space-y-2">
                      {addresses.map((a) => (
                        <li key={a.id}>
                          <label
                            className={cn(
                              "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                              selectedAddrId === a.id ? "border-primary bg-accent/30" : "border-border hover:bg-accent/20",
                            )}
                          >
                            <input
                              type="radio"
                              name="address"
                              checked={selectedAddrId === a.id}
                              onChange={() => setSelectedAddrId(a.id)}
                              className="mt-1"
                            />
                            <div className="flex-1 text-sm">
                              <div className="font-medium">
                                {formatAddr(a)} {a.isDefault && <span className="ml-2 text-xs text-muted-foreground">(Default)</span>}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                beginEditAddress(a);
                              }}
                              className="text-sm text-primary underline underline-offset-4 shrink-0"
                            >
                              Edit
                            </button>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={beginAddAddress}
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      + Add a new address
                    </button>
                    <div>
                      <Button variant="hero" disabled={!selectedAddrId} onClick={continueAddress}>
                        Save &amp; Continue
                      </Button>
                    </div>
                  </div>
                )}

                {showAddrForm && (
                  <div className="space-y-4">
                    {editingAddrId && (
                      <p className="text-sm text-muted-foreground">Edit this address</p>
                    )}
                    <Field id="street" label="Street Address">
                      <Input
                        id="street"
                        value={addrForm.street}
                        onChange={(e) => setAddrForm({ ...addrForm, street: e.target.value })}
                      />
                    </Field>
                    <Field id="street2" label="Address 2 (optional)">
                      <Input
                        id="street2"
                        value={addrForm.street2}
                        onChange={(e) => setAddrForm({ ...addrForm, street2: e.target.value })}
                      />
                    </Field>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Field id="city" label="City">
                        <Input
                          id="city"
                          value={addrForm.city}
                          onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                        />
                      </Field>
                      <Field id="state" label="State">
                        <Select
                          value={addrForm.state}
                          onValueChange={(v) => setAddrForm({ ...addrForm, state: v })}
                        >
                          <SelectTrigger id="state"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field id="zip" label="Zip Code">
                        <Input
                          id="zip"
                          inputMode="numeric"
                          maxLength={5}
                          value={addrForm.zip}
                          onChange={(e) =>
                            setAddrForm({ ...addrForm, zip: e.target.value.replace(/\D/g, "").slice(0, 5) })
                          }
                          aria-invalid={zipInvalid}
                        />
                        {zipInvalid && (
                          <p className="text-xs text-destructive mt-1">
                            We don't currently deliver to {addrForm.zip}.{" "}
                            <Link to="/faqs" className="underline">See our service areas and request a new service area</Link>.
                          </p>
                        )}
                      </Field>
                    </div>
                    {addresses.length > 0 && (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={addrForm.makeDefault}
                          onCheckedChange={(v) => setAddrForm({ ...addrForm, makeDefault: !!v })}
                        />
                        Make this my default address
                      </label>
                    )}
                    <div className="flex gap-3">
                      <Button variant="hero" disabled={!addrFormValid} onClick={saveAddress}>
                        {editingAddrId ? "Save changes" : "Save & Continue"}
                      </Button>
                      {addresses.length > 0 && (
                        <Button variant="ghost" onClick={cancelAddressForm}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </StepCard>

              {/* Step 3: Payment — handled by Stripe */}
              <StepCard
                index={3}
                title="Payment"
                open={openStep === "payment"}
                done={paymentDone && openStep !== "payment"}
                onOpen={() => addressDone && setOpenStep("payment")}
                summary={
                  paymentDone && openStep !== "payment" ? (
                    <span className="text-sm text-foreground/80 inline-flex items-center gap-1.5">
                      <Lock size={12} />
                      {!useNewCard && selectedPmId
                        ? (() => {
                            const pm = paymentMethods.find((p) => p.id === selectedPmId);
                            return pm ? `${pm.brand} ending in ${pm.last4}` : "Securely collected by Stripe";
                          })()
                        : "Securely collected by Stripe"}
                    </span>
                  ) : null
                }
              >
                <div className="space-y-4">
                  {paymentMethods.length > 0 && (
                    <div className="space-y-3">
                      <ul className="space-y-2">
                        {paymentMethods.map((pm) => (
                          <li key={pm.id}>
                            <label
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                                !useNewCard && selectedPmId === pm.id
                                  ? "border-primary bg-accent/30"
                                  : "border-border hover:bg-accent/20",
                              )}
                            >
                              <input
                                type="radio"
                                name="payment"
                                checked={!useNewCard && selectedPmId === pm.id}
                                onChange={() => {
                                  setSelectedPmId(pm.id);
                                  setUseNewCard(false);
                                }}
                                className="mt-1"
                              />
                              <div className="flex-1 text-sm">
                                <div className="font-medium">
                                  {pm.brand} ending in {pm.last4}
                                  {pm.isDefault && (
                                    <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Expires {String(pm.expMonth).padStart(2, "0")}/{String(pm.expYear).slice(-2)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setUseNewCard(true);
                                }}
                                className="text-sm text-primary underline underline-offset-4 shrink-0"
                              >
                                Change
                              </button>
                            </label>
                          </li>
                        ))}
                      </ul>
                      <label
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                          useNewCard ? "border-primary bg-accent/30" : "border-border hover:bg-accent/20",
                        )}
                      >
                        <input
                          type="radio"
                          name="payment"
                          checked={useNewCard}
                          onChange={() => setUseNewCard(true)}
                          className="mt-1"
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium">Use a different card</div>
                          <div className="text-xs text-muted-foreground">
                            Enter new card details securely on the next step.
                          </div>
                        </div>
                      </label>
                    </div>
                  )}

                  {(paymentMethods.length === 0 || useNewCard) && (
                    <>
                      <p className="text-sm text-foreground/80 inline-flex items-center gap-2">
                        <Lock size={14} className="text-primary" />
                        Your card details are entered securely on the next step, powered by Stripe.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        We accept all major credit and debit cards. You'll review your total before confirming the payment.
                      </p>
                    </>
                  )}
                </div>
              </StepCard>

            </div>

            {/* Order summary */}
            <aside className="lg:sticky lg:top-32 h-fit">
              <div className="rounded-lg border border-border bg-card p-6 shadow-soft">
                <h2 className="text-lg font-semibold mb-4">Order summary</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Repairs</dt>
                    <dd>{formatPrice(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery &amp; Pickup Service</dt>
                    <dd>{courierFee === 0 ? "Free" : formatPrice(courierFee)}</dd>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-semibold text-base">
                    <dt>Subtotal</dt>
                    <dd>{formatPrice(orderSubtotal)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  Free courier service on orders over $100
                </p>
                <Button
                  type="button"
                  variant="hero"
                  size="lg"
                  className={cn("w-full mt-6", (!allDone || placing) && "opacity-50 cursor-not-allowed")}
                  disabled={!allDone || placing}
                  onClick={placeOrder}
                >
                  {placing ? "Preparing payment…" : "Continue to payment"}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  Taxes calculated at the payment step.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

// ----- helpers / sub-components -----
const StepCard = ({
  index,
  title,
  open,
  done,
  onOpen,
  summary,
  children,
}: {
  index: number;
  title: string;
  open: boolean;
  done: boolean;
  onOpen: () => void;
  summary?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section
    className={cn(
      "rounded-lg border bg-card shadow-soft overflow-hidden",
      open ? "border-primary" : "border-border",
    )}
  >
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 p-5 text-left"
    >
      <span
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
          done ? "bg-status-green/20 text-foreground" : "bg-primary text-primary-foreground",
        )}
        aria-hidden
      >
        {done ? <Check size={16} /> : index}
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        {summary && !open && <span className="block mt-0.5">{summary}</span>}
      </span>
      <ChevronDown
        size={18}
        className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
      />
    </button>
    {open && <div className="px-5 pb-6 pt-1 border-t border-border">{children}</div>}
  </section>
);

const Field = ({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

const formatAddr = (a: Address) =>
  `${a.street}${a.street2 ? `, ${a.street2}` : ""}, ${a.city}, ${a.state} ${a.zip}`;

export default Checkout;
