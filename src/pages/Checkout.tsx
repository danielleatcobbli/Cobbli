import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Check, ChevronDown, Pencil } from "lucide-react";
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
import {
  useAccount,
  isExpired,
  US_STATES,
  type Address,
  type PaymentMethod,
} from "@/context/AccountContext";
import { isServiceableZip } from "@/data/serviceAreas";
import { cn } from "@/lib/utils";

const FREE_COURIER_THRESHOLD = 10000;
const COURIER_FEE = 1500;
type Step = "contact" | "address" | "payment";

const Checkout = () => {
  const navigate = useNavigate();
  const { pairs, subtotal, clear } = useBag();
  const {
    user,
    updateContact,
    addresses,
    addAddress,
    paymentMethods,
    addPaymentMethod,
    addOrder,
  } = useAccount();

  useEffect(() => {
    document.title = "Checkout — Cobbli";
  }, []);

  const courierFee = subtotal >= FREE_COURIER_THRESHOLD ? 0 : COURIER_FEE;
  const orderSubtotal = subtotal + courierFee;

  // ---------- Contact ----------
  const [contactEditing, setContactEditing] = useState(false);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [contactDone, setContactDone] = useState(true); // pre-filled from account
  const contactValid = /\S+@\S+\.\S+/.test(email) && phone.replace(/\D/g, "").length >= 10;

  // ---------- Address ----------
  const defaultAddrId = useMemo(
    () => addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null,
    [addresses],
  );
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(defaultAddrId);
  const [addingAddr, setAddingAddr] = useState(addresses.length === 0);
  const [addrForm, setAddrForm] = useState({
    street: "",
    street2: "",
    city: "",
    state: "NY",
    zip: "",
    makeDefault: false,
  });
  const zipInvalid = addrForm.zip.length === 5 && !isServiceableZip(addrForm.zip);
  const addrFormValid =
    addrForm.street.trim() &&
    addrForm.city.trim() &&
    addrForm.state &&
    /^\d{5}$/.test(addrForm.zip) &&
    isServiceableZip(addrForm.zip);
  const addressDone = !addingAddr && !!selectedAddrId;
  const selectedAddress = addresses.find((a) => a.id === selectedAddrId);

  // ---------- Payment ----------
  const validPMs = useMemo(() => paymentMethods.filter((p) => !isExpired(p)), [paymentMethods]);
  const defaultPMId = useMemo(
    () => validPMs.find((p) => p.isDefault)?.id ?? validPMs[0]?.id ?? null,
    [validPMs],
  );
  const [selectedPMId, setSelectedPMId] = useState<string | null>(defaultPMId);
  const [addingPM, setAddingPM] = useState(paymentMethods.length === 0);
  const [pmForm, setPmForm] = useState({
    cardNumber: "",
    exp: "", // MM/YY
    cvv: "",
    sameAsShipping: true,
    save: false,
  });
  const pmFormValid =
    pmForm.cardNumber.replace(/\s/g, "").length >= 13 &&
    /^(0[1-9]|1[0-2])\/\d{2}$/.test(pmForm.exp) &&
    /^\d{3,4}$/.test(pmForm.cvv);
  const paymentDone = !addingPM && !!selectedPMId;

  // ---------- Step orchestration ----------
  const [openStep, setOpenStep] = useState<Step>("contact");

  // Re-default selections when underlying lists change
  useEffect(() => {
    if (!selectedAddrId && defaultAddrId) setSelectedAddrId(defaultAddrId);
  }, [defaultAddrId, selectedAddrId]);
  useEffect(() => {
    if (!selectedPMId && defaultPMId) setSelectedPMId(defaultPMId);
  }, [defaultPMId, selectedPMId]);

  if (pairs.length === 0) return <Navigate to="/bag" replace />;

  // ----- handlers -----
  const saveContact = () => {
    if (!contactValid) return;
    updateContact(email, phone);
    setContactEditing(false);
    setContactDone(true);
    if (openStep === "contact") setOpenStep("address");
  };

  const saveAddress = () => {
    if (!addrFormValid) return;
    const addr = addAddress({
      street: addrForm.street.trim(),
      street2: addrForm.street2.trim() || undefined,
      city: addrForm.city.trim(),
      state: addrForm.state,
      zip: addrForm.zip,
      isDefault: addrForm.makeDefault || addresses.length === 0,
    });
    setSelectedAddrId(addr.id);
    setAddingAddr(false);
    setOpenStep("payment");
  };

  const continueAddress = () => {
    if (!selectedAddrId) return;
    setOpenStep("payment");
  };

  const savePayment = () => {
    if (!pmFormValid) return;
    const [mm, yy] = pmForm.exp.split("/");
    const last4 = pmForm.cardNumber.replace(/\s/g, "").slice(-4);
    const pm = addPaymentMethod({
      brand: detectBrand(pmForm.cardNumber),
      last4,
      expMonth: Number(mm),
      expYear: 2000 + Number(yy),
      isDefault: pmForm.save && paymentMethods.length === 0,
    });
    if (pmForm.save) {
      setSelectedPMId(pm.id);
    } else {
      setSelectedPMId(pm.id);
    }
    setAddingPM(false);
  };

  const allDone = contactDone && addressDone && paymentDone;

  const placeOrder = () => {
    if (!allDone || !selectedAddress || !selectedPMId) return;
    const pm = paymentMethods.find((p) => p.id === selectedPMId);
    const order = addOrder({
      email,
      phone,
      address: selectedAddress,
      paymentLast4: pm?.last4 ?? "0000",
      pairs,
      repairsSubtotal: subtotal,
      courierFee,
      subtotal: orderSubtotal,
    });
    clear();
    navigate(`/order-confirmation/${order.id}`, { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10">
          <h1 className="text-3xl md:text-4xl font-semibold mb-8">Checkout</h1>

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
                title="Address"
                open={openStep === "address"}
                done={addressDone && openStep !== "address"}
                onOpen={() => setOpenStep("address")}
                summary={
                  addressDone && selectedAddress && openStep !== "address" ? (
                    <span className="text-sm text-foreground/80">{formatAddr(selectedAddress)}</span>
                  ) : null
                }
              >
                {addresses.length > 0 && !addingAddr && (
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
                            <div className="text-sm">
                              <div className="font-medium">
                                {formatAddr(a)} {a.isDefault && <span className="ml-2 text-xs text-muted-foreground">(Default)</span>}
                              </div>
                            </div>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setAddingAddr(true)}
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

                {(addresses.length === 0 || addingAddr) && (
                  <div className="space-y-4">
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
                            <Link to="/faqs" className="underline">See our full service area</Link>.
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
                        Save &amp; Continue
                      </Button>
                      {addresses.length > 0 && (
                        <Button variant="ghost" onClick={() => setAddingAddr(false)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </StepCard>

              {/* Step 3: Payment */}
              <StepCard
                index={3}
                title="Payment"
                open={openStep === "payment"}
                done={paymentDone && openStep !== "payment"}
                onOpen={() => setOpenStep("payment")}
                summary={
                  paymentDone && selectedPMId && openStep !== "payment" ? (
                    <span className="text-sm text-foreground/80">
                      {(() => {
                        const pm = paymentMethods.find((p) => p.id === selectedPMId);
                        return pm ? `${pm.brand} ending in ${pm.last4}` : "";
                      })()}
                    </span>
                  ) : null
                }
              >
                {paymentMethods.length > 0 && !addingPM && (
                  <div className="space-y-3">
                    <ul className="space-y-2">
                      {paymentMethods.map((p) => {
                        const expired = isExpired(p);
                        return (
                          <li key={p.id}>
                            <label
                              className={cn(
                                "flex items-center gap-3 rounded-lg border p-4 transition-colors",
                                expired
                                  ? "border-border bg-muted/40 cursor-not-allowed opacity-60"
                                  : selectedPMId === p.id
                                  ? "border-primary bg-accent/30 cursor-pointer"
                                  : "border-border hover:bg-accent/20 cursor-pointer",
                              )}
                            >
                              <input
                                type="radio"
                                name="pm"
                                disabled={expired}
                                checked={selectedPMId === p.id}
                                onChange={() => setSelectedPMId(p.id)}
                              />
                              <div className="text-sm flex-1">
                                <div className="font-medium">
                                  {p.brand} ending in {p.last4}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Exp {String(p.expMonth).padStart(2, "0")}/{String(p.expYear).slice(-2)}
                                  {p.isDefault && <span className="ml-2">(Default)</span>}
                                </div>
                              </div>
                              {expired && (
                                <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                                  Expired
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setAddingPM(true)}
                      className="text-sm text-primary underline underline-offset-4"
                    >
                      + Add a new card
                    </button>
                  </div>
                )}

                {(paymentMethods.length === 0 || addingPM) && (
                  <div className="space-y-4">
                    <Field id="card" label="Card number">
                      <Input
                        id="card"
                        inputMode="numeric"
                        value={pmForm.cardNumber}
                        onChange={(e) =>
                          setPmForm({ ...pmForm, cardNumber: e.target.value.replace(/[^\d ]/g, "").slice(0, 19) })
                        }
                        placeholder="1234 5678 9012 3456"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field id="exp" label="Expiration (MM/YY)">
                        <Input
                          id="exp"
                          value={pmForm.exp}
                          onChange={(e) => setPmForm({ ...pmForm, exp: formatExp(e.target.value) })}
                          placeholder="MM/YY"
                          maxLength={5}
                        />
                      </Field>
                      <Field id="cvv" label="CVV">
                        <Input
                          id="cvv"
                          inputMode="numeric"
                          maxLength={4}
                          value={pmForm.cvv}
                          onChange={(e) => setPmForm({ ...pmForm, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        />
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={pmForm.sameAsShipping}
                        onCheckedChange={(v) => setPmForm({ ...pmForm, sameAsShipping: !!v })}
                      />
                      Billing address same as shipping address
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={pmForm.save}
                        onCheckedChange={(v) => setPmForm({ ...pmForm, save: !!v })}
                      />
                      Save this card to my account for faster checkout
                    </label>
                    <div className="flex gap-3">
                      <Button variant="hero" disabled={!pmFormValid} onClick={savePayment}>
                        Save card
                      </Button>
                      {paymentMethods.length > 0 && (
                        <Button variant="ghost" onClick={() => setAddingPM(false)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                )}
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
                  className="w-full mt-6"
                  disabled={!allDone}
                  onClick={placeOrder}
                >
                  Place Order
                </Button>
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  Taxes calculated after order placement.
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

const formatExp = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

const detectBrand = (num: string) => {
  const n = num.replace(/\D/g, "");
  if (n.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return "Mastercard";
  if (/^3[47]/.test(n)) return "Amex";
  if (/^6/.test(n)) return "Discover";
  return "Card";
};

export default Checkout;
