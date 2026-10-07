import { useEffect, useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useParams } from "react-router-dom";
import { Calendar, CheckCircle2, Clock, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccount } from "@/context/AccountContext";
import { formatPrice } from "@/context/BagContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { fmtDateKey } from "@/lib/pickupTime";

type LoadedPair = {
  id: string;
  label?: string;
  services: { id: string; name: string; price: number; paintConsent?: "yes" | "no" }[];
};

type LoadedOrder = {
  id: string;
  number: string;
  email: string;
  status: string;
  address: {
    street: string;
    street2?: string;
    city: string;
    state: string;
    zip: string;
  };
  pairs: LoadedPair[];
  repairsSubtotal: number;
  courierFee: number;
  subtotal: number;
};

type DbOrderItem = {
  id: string;
  pair_snapshot: { id?: string; label?: string } | null;
  service_snapshot: { id?: string; name?: string; paint_consent?: "yes" | "no" } | null;
  price_cents: number;
};

// Live pickup/return scheduling data — fetched separately so it stays fresh
// even when the main order details come from the in-memory AccountContext.
type PickupInfo = {
  pickup_date: string | null;
  pickup_time_label: string | null;
  return_date: string | null;
  return_time_label: string | null;
  pickup_calendly_event_uri: string | null;
  return_calendly_event_uri: string | null;
  contact_phone: string | null;
};

type DbOrder = {
  id: string;
  order_number: string;
  status: string;
  contact_email: string | null;
  delivery_address: LoadedOrder["address"] | null;
  repairs_subtotal_cents: number | null;
  courier_fee_cents: number | null;
  total_cents: number | null;
  order_items: DbOrderItem[];
};

const mapDbOrder = (o: DbOrder): LoadedOrder => {
  const pairsMap = new Map<string, LoadedPair>();
  o.order_items.forEach((it, idx) => {
    const pairId = it.pair_snapshot?.id ?? `pair-${idx}`;
    const label = it.pair_snapshot?.label;
    if (!pairsMap.has(pairId)) {
      pairsMap.set(pairId, { id: pairId, label, services: [] });
    }
    pairsMap.get(pairId)!.services.push({
      id: it.service_snapshot?.id ?? it.id,
      name: it.service_snapshot?.name ?? "Service",
      price: it.price_cents,
      paintConsent: it.service_snapshot?.paint_consent,
    });
  });
  return {
    id: o.id,
    number: o.order_number,
    status: o.status ?? "placed",
    email: o.contact_email ?? "",
    address: o.delivery_address ?? { street: "", city: "", state: "", zip: "" },
    pairs: [...pairsMap.values()],
    repairsSubtotal: o.repairs_subtotal_cents ?? 0,
    courierFee: o.courier_fee_cents ?? 0,
    subtotal: o.total_cents ?? 0,
  };
};

// ─── component ───────────────────────────────────────────────────────────────

const OrderConfirmation = () => {
  const { id } = useParams();
  const { orders } = useAccount();
  const { user } = useAuth();
  const localOrder = orders.find((o) => o.id === id);

  const [remoteOrder, setRemoteOrder] = useState<LoadedOrder | null>(null);
  const [loading, setLoading] = useState(!localOrder);
  const [reworkOpen, setReworkOpen] = useState(false);
  const [reworkDesc, setReworkDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pickup / return scheduling state — fetched separately (always live from DB)
  const [pickupInfo, setPickupInfo] = useState<PickupInfo | null>(null);

  usePageMeta({
    title: "Order details — Cobbli",
    description:
      "Review your Cobbli shoe repair order details, services, and delivery information.",
  });

  useEffect(() => {
    if (localOrder || !id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      // Signed-in: scoped to that user's own order (existing RLS policy).
      // Guest (no `user`): the localStorage mirror from Checkout.tsx already
      // covers the common case (same browser, right after paying). This
      // fallback is for returning later / a different device — matched by
      // the order id alone, which is how guest orders are found (2026-09-24,
      // Danielle's call: guest checkout). The id is an unguessable UUID, and
      // the RLS policy ("Guests view own orders by id") only exposes rows
      // where user_id is null, so this never leaks a signed-in customer's
      // order to a guest request.
      const query = supabase
        .from("orders")
        .select(
          "id,order_number,status,contact_email,delivery_address,repairs_subtotal_cents,courier_fee_cents,total_cents,order_items(id,pair_snapshot,service_snapshot,price_cents)",
        )
        .eq("id", id);
      const { data, error } = await (user ? query.eq("user_id", user.id) : query).maybeSingle();
      if (cancelled) return;
      if (!error && data) setRemoteOrder(mapDbOrder(data as unknown as DbOrder));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, localOrder, user]);

  // Always fetch pickup/return scheduling fields live from the DB, even for
  // fresh (just-placed) orders where the main order data comes from the
  // in-memory AccountContext. This ensures the real pickup date/time shows
  // immediately on the confirmation page and stays fresh after a reschedule.
  useEffect(() => {
    if (!id || !user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("orders")
        .select(
          "pickup_date,pickup_time_label,return_date,return_time_label,pickup_calendly_event_uri,return_calendly_event_uri,contact_phone",
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data) setPickupInfo(data as PickupInfo);
    })();
    return () => { cancelled = true; };
  }, [id, user]);

  const order: LoadedOrder | null = useMemo(() => {
    if (localOrder) {
      return {
        id: localOrder.id,
        number: localOrder.number,
        status: "placed",
        email: localOrder.email,
        address: localOrder.address,
        pairs: localOrder.pairs.map((p, i) => ({
          id: p.id,
          label: p.label ?? `Pair ${i + 1}`,
          services: p.services.map((s) => ({ id: s.id, name: s.name, price: s.price, paintConsent: (s as { paintConsent?: "yes" | "no" }).paintConsent })),
        })),
        repairsSubtotal: localOrder.repairsSubtotal,
        courierFee: localOrder.courierFee,
        subtotal: localOrder.subtotal,
      };
    }
    return remoteOrder;
  }, [localOrder, remoteOrder]);

  const purchasedServices = useMemo(() => {
    if (!order) return [] as string[];
    const names = order.pairs.flatMap((p) => p.services.map((s) => s.name));
    return Array.from(new Set(names));
  }, [order]);

  // 2026-10-01: customer-facing rescheduling removed for the MVP — this page
  // is an old, still-reachable direct link (/order-confirmation/:id), so it
  // must not be able to reopen a reschedule flow or change an existing
  // booking. The reschedule state, dialog, and booking function that used to
  // live here have been removed; initial scheduling (when no pickup/return
  // is booked yet) is staff-initiated and isn't offered on this page.

  const submitRework = async () => {
    if (!order || !user || !reworkDesc.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("reworks" as never).insert({
      order_id: order.id,
      user_id: user.id,
      description: reworkDesc.trim(),
      services_in_scope: purchasedServices,
    } as never);
    setSubmitting(false);
    if (error) {
      toast.error("We couldn't submit your request. Please try again.");
      return;
    }
    toast.success("Rework request submitted");
    setReworkOpen(false);
    setReworkDesc("");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin" style={{ color: "#fdb600" }} />
        </main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1">
          <div className="container py-16 text-center">
            <h1
              className="text-2xl uppercase mb-3"
              style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
            >
              Order not found
            </h1>
            <Button asChild variant="hero">
              <Link to="/account/orders">View my orders</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const a = order.address;

  // Restyled 2026-08-26 (Danielle's call) — cream page bg + Header
  // theme="cream" + amber page heading only; the confirmation banner already
  // used cream/amber, and the pricing/scheduling/rework sections below keep
  // their existing functional styling (same page-shell-only scoping as the
  // rest of checkout).
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1">
        <div className="container py-10 max-w-3xl">
          {/* Confirmation banner — only meaningful for fresh orders */}
          {localOrder && (
            <div
              className="rounded-xl p-6 md:p-8 flex items-start gap-4 mb-8"
              style={{ backgroundColor: "#fdb600", border: "1px solid #fdb600" }}
            >
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#3d1700", color: "#fdb600" }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h1 className="text-2xl uppercase" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fff5cc" }}>Your Order is Confirmed!</h1>
                <p className="mt-1 text-sm md:text-base" style={{ color: "#fff5cc", opacity: 0.9 }}>
                  A confirmation email has been sent to {order.email}
                </p>
                <p className="mt-2 text-xs" style={{ color: "#fff5cc", opacity: 0.8 }}>Order #{order.number}</p>
              </div>
            </div>
          )}

          {!localOrder && (
            <div className="mb-6">
              <h1
                className="text-2xl uppercase"
                style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
              >
                Order #{order.number}
              </h1>
            </div>
          )}

          {/* Pickup & Return Details */}
          <section className="rounded-lg border border-border bg-card p-6 shadow-soft mb-6">
            <h2 className="text-lg font-semibold mb-4">Pickup &amp; Return Details</h2>

            {/* Delivery address */}
            <div className="text-sm space-y-1 mb-5">
              <p className="font-medium">Delivery address</p>
              <p className="text-foreground/80">
                {a.street}
                {a.street2 ? `, ${a.street2}` : ""}
                <br />
                {a.city}, {a.state} {a.zip}
              </p>
            </div>

            {/* Pickup window */}
            {(() => {
              const pd = pickupInfo?.pickup_date ?? null;
              const pl = pickupInfo?.pickup_time_label ?? null;
              return (
                <div className="mb-4">
                  <p className="text-sm font-medium mb-1">Pickup</p>
                  {pd && pl ? (
                    <div className="flex items-center gap-2 text-sm text-foreground/80">
                      <Calendar size={14} className="shrink-0 text-primary" />
                      <span>{fmtDateKey(pd)}</span>
                      <Clock size={14} className="shrink-0 text-primary" />
                      <span>{pl}</span>
                    </div>
                  ) : (
                    <div className="rounded-md bg-accent/30 border border-border p-3 flex items-start gap-2 text-sm">
                      <MessageSquare size={15} className="mt-0.5 shrink-0 text-primary" />
                      <span>We'll contact you to schedule your pickup window.</span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Return window — only shown once staff has scheduled it */}
            {pickupInfo?.return_date && pickupInfo?.return_time_label && (() => {
              const rd = pickupInfo.return_date!;
              const rl = pickupInfo.return_time_label!;
              return (
                <div>
                  <p className="text-sm font-medium mb-1">Return</p>
                  <div className="flex items-center gap-2 text-sm text-foreground/80">
                    <Calendar size={14} className="shrink-0 text-primary" />
                    <span>{fmtDateKey(rd)}</span>
                    <Clock size={14} className="shrink-0 text-primary" />
                    <span>{rl}</span>
                  </div>
                </div>
              );
            })()}
          </section>

          {/* Order summary */}
          <section className="rounded-lg border border-border bg-card p-6 shadow-soft mb-6">
            <h2 className="text-lg font-semibold mb-4">Order summary</h2>
            <ul className="space-y-4 mb-4">
              {order.pairs.map((pair, i) => (
                <li key={pair.id}>
                  <p className="font-medium mb-2">{pair.label ?? `Pair ${i + 1}`}</p>
                  <ul className="text-sm divide-y divide-border border-y border-border">
                    {pair.services.map((s) => (
                      <li key={s.id} className="py-2 flex justify-between gap-4">
                        <span>
                          {s.name}
                          {s.paintConsent && (
                            <span
                              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                s.paintConsent === "yes"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {s.paintConsent === "yes"
                                ? "Dye/paint: approved"
                                : "Dye/paint: declined"}
                            </span>
                          )}
                        </span>
                        <span>{formatPrice(s.price)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Repairs</dt>
                <dd>{formatPrice(order.repairsSubtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery &amp; Pickup Service</dt>
                <dd>{order.courierFee === 0 ? "Free" : formatPrice(order.courierFee)}</dd>
              </div>
              <div className="border-t border-border pt-2 flex justify-between font-semibold text-base">
                <dt>Subtotal</dt>
                <dd>{formatPrice(order.subtotal)}</dd>
              </div>
            </dl>
          </section>

          {/* Reworks — only on the order detail view, after the order is completed */}
          {!localOrder && order.status === "completed" && (
            <section className="rounded-lg border border-border bg-card p-6 shadow-soft mb-6">
              <h2 className="text-lg font-semibold mb-2">Not happy with your repair?</h2>
              <p className="text-sm text-foreground/80">
                We stand behind our work. If something isn't right, request a complimentary rework
                and we'll make it right.
              </p>
              <p className="text-sm text-foreground/80 mt-2">
                Reworks apply to the services you purchased.
              </p>
              <div className="mt-4">
                <Button variant="hero" onClick={() => setReworkOpen(true)}>
                  Request a rework
                </Button>
              </div>
            </section>
          )}

        </div>
      </main>
      <Footer />

      {/* Rework modal */}
      <Dialog open={reworkOpen} onOpenChange={setReworkOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request a rework</DialogTitle>
            <DialogDescription>
              Tell us what's not right and we'll take care of it at no charge.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Purchased services chips */}
            <div>
              <p className="text-sm font-medium mb-2">Your purchased services</p>
              <div className="flex flex-wrap gap-2">
                {purchasedServices.length === 0 ? (
                  <span className="text-sm text-muted-foreground">No services on file</span>
                ) : (
                  purchasedServices.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-foreground"
                    >
                      {name}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Scope banner */}
            <div
              className="rounded-md p-3 text-sm"
              style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600", color: "#fdb600" }}
            >
              Reworks cover issues with the services listed above. Concerns outside of your
              original order, like scratches on your shoe if you didn't purchase scratch repair,
              aren't eligible for a complimentary rework but can be added as a new order.
            </div>

            {/* Description */}
            <div>
              <label htmlFor="rework-desc" className="text-sm font-medium block mb-2">
                What needs to be fixed? <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="rework-desc"
                value={reworkDesc}
                onChange={(e) => setReworkDesc(e.target.value)}
                rows={5}
              />
            </div>

            {/* What happens next */}
            <div className="rounded-md bg-accent/30 border border-border p-3 text-sm">
              <p className="font-medium mb-1">What happens next</p>
              <p className="text-foreground/80">
                Our team will review your request and text you to schedule a pickup at no charge.
              </p>
            </div>
          </div>

          {!user && (
            <p className="text-xs text-destructive text-center">
              You'll need to be signed in to submit a rework request.
            </p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setReworkOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant="hero"
              onClick={submitRework}
              disabled={submitting || !reworkDesc.trim() || !user}
            >
              {submitting ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderConfirmation;
