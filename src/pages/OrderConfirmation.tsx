import { useCallback, useEffect, useMemo, useState } from "react";
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
import { PickupScheduler, type PickupWindow } from "@/components/cobbli/PickupScheduler";
import { useAccount } from "@/context/AccountContext";
import { formatPrice } from "@/context/BagContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

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

// ─── helpers ────────────────────────────────────────────────────────────────

const NY_TZ = "America/New_York";

/** YYYY-MM-DD in New York local time from a UTC ISO string. */
function toNyDateKey(isoUtc: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NY_TZ }).format(new Date(isoUtc));
}

/** "9:00 – 10:30 AM" or "11:30 AM – 1:00 PM" from two UTC ISO strings.
 *  Mirrors PickupScheduler.tsx formatTimeRange() and the stripe-webhook helper. */
function formatNyTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: NY_TZ })
      .format(new Date(iso));
  const startStr = fmt(startIso);
  const endStr = fmt(endIso);
  const startPeriod = startStr.slice(-2);
  const endPeriod = endStr.slice(-2);
  return startPeriod === endPeriod ? `${startStr.slice(0, -3)} – ${endStr}` : `${startStr} – ${endStr}`;
}

/** "Mon Jul 14" from a YYYY-MM-DD date key. */
function fmtDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" })
    .format(new Date(`${dateKey}T12:00:00`));
}

/** Returns true when the scheduled window is within 2 hours (or already past),
 *  locking out customer self-service reschedules.
 *  Uses the browser's local time as an approximation — acceptable for a
 *  customer-facing cutoff where a few minutes of drift is not material. */
function isWithin2Hours(dateKey: string | null, timeLabel: string | null): boolean {
  if (!dateKey || !timeLabel) return false;
  const dashIdx = timeLabel.indexOf(" – ");
  if (dashIdx === -1) return false;
  const startToken = timeLabel.slice(0, dashIdx).trim();      // "9:00" or "11:30 AM"
  const endToken = timeLabel.slice(dashIdx + 3).trim();        // "10:30 AM" or "1:00 PM"
  const startFull = /[AP]M$/i.test(startToken) ? startToken : `${startToken} ${endToken.slice(-2)}`;
  // Parse start time into hours/minutes
  const [timePart, period] = startFull.split(" ");
  const [h, m] = timePart.split(":").map(Number);
  let hour24 = h;
  if (period === "PM" && h !== 12) hour24 = h + 12;
  if (period === "AM" && h === 12) hour24 = 0;
  // Build approximate start Date in local time (fine for a 2-hour cutoff check)
  const startDt = new Date(
    `${dateKey}T${String(hour24).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00`,
  );
  if (isNaN(startDt.getTime())) return false;
  return Date.now() > startDt.getTime() - 2 * 60 * 60 * 1000;
}

// ─── component ───────────────────────────────────────────────────────────────

const OrderConfirmation = () => {
  const { id } = useParams();
  const { orders, user: accountUser } = useAccount();
  const { user } = useAuth();
  const localOrder = orders.find((o) => o.id === id);

  const [remoteOrder, setRemoteOrder] = useState<LoadedOrder | null>(null);
  const [loading, setLoading] = useState(!localOrder);
  const [reworkOpen, setReworkOpen] = useState(false);
  const [reworkDesc, setReworkDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pickup / return scheduling state — fetched separately (always live from DB)
  const [pickupInfo, setPickupInfo] = useState<PickupInfo | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState<"pickup" | "return" | null>(null);
  const [newWindow, setNewWindow] = useState<PickupWindow | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  usePageMeta({
    title: "Order details — Cobbli",
    description:
      "Review your Cobbli shoe repair order details, services, and delivery information.",
  });

  useEffect(() => {
    if (localOrder || !id || !user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id,order_number,status,contact_email,delivery_address,repairs_subtotal_cents,courier_fee_cents,total_cents,order_items(id,pair_snapshot,service_snapshot,price_cents)",
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
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

  const doReschedule = useCallback(async () => {
    if (!newWindow || !rescheduleSlot || !order || !user) return;
    setRescheduling(true);
    try {
      // Step 1 — cancel the existing Calendly event (if one was stored).
      const existingUri = rescheduleSlot === "pickup"
        ? (pickupInfo?.pickup_calendly_event_uri ?? null)
        : (pickupInfo?.return_calendly_event_uri ?? null);

      let cancelWarning: string | null = null;
      if (existingUri) {
        const { data: cancelData, error: cancelError } = await supabase.functions.invoke("cal-cancel", {
          body: { event_uri: existingUri },
        });
        if (cancelError) {
          // Non-fatal: warn but continue so the new booking still proceeds.
          cancelWarning = "The previous booking couldn't be cancelled automatically — please cancel it in Calendly directly.";
        } else if (cancelData?.skipped) {
          cancelWarning = cancelData.reason ?? "The previous booking couldn't be cancelled automatically — please cancel it in Calendly directly.";
        }
      }

      // Step 2 — book the new slot.
      const addrParts = [
        order.address.street,
        order.address.street2,
        `${order.address.city}, ${order.address.state} ${order.address.zip}`,
      ].filter(Boolean);

      const { data: bookData, error: bookError } = await supabase.functions.invoke("calendly-book", {
        body: {
          start_time: newWindow.start_time,
          name: accountUser?.name || user.email,
          email: order.email || user.email,
          phone: pickupInfo?.contact_phone || "",
          address: addrParts.join(", "),
          notes: `${rescheduleSlot === "pickup" ? "Pickup" : "Return"} reschedule — Order #${order.number}`,
        },
      });
      if (bookError) throw new Error(bookError.message);
      if (bookData?.error) throw new Error(bookData.error);

      // Step 3 — derive the human-readable label + store.
      const newDate = toNyDateKey(newWindow.start_time);
      const newLabel = formatNyTimeRange(newWindow.start_time, newWindow.end_time);
      const newEventUri: string | null = bookData?.event_uri ?? null;

      const updateFields: Record<string, string | null> = rescheduleSlot === "pickup"
        ? { pickup_date: newDate, pickup_time_label: newLabel, pickup_calendly_event_uri: newEventUri }
        : { return_date: newDate, return_time_label: newLabel, return_calendly_event_uri: newEventUri };

      const { error: updateError } = await supabase
        .from("orders")
        .update(updateFields)
        .eq("id", order.id)
        .eq("user_id", user.id);
      if (updateError) throw new Error(updateError.message);

      // Step 4 — update local state so the UI reflects the new time immediately.
      setPickupInfo(prev => prev ? { ...prev, ...updateFields } : prev);

      setRescheduleSlot(null);
      setNewWindow(null);

      if (cancelWarning) {
        toast.warning(cancelWarning);
      }
      if (bookData?.fallback) {
        toast.info("Your new pickup time is saved. Complete the Calendly booking via the link in your email.");
      } else {
        toast.success(`${rescheduleSlot === "pickup" ? "Pickup" : "Return"} rescheduled!`);
      }
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) ?? "Could not reschedule. Please try again.");
    } finally {
      setRescheduling(false);
    }
  }, [newWindow, rescheduleSlot, order, user, pickupInfo, accountUser]);

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
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-primary" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container py-16 text-center">
            <h1 className="text-2xl font-semibold mb-3">Order not found</h1>
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 max-w-3xl">
          {/* Confirmation banner — only meaningful for fresh orders */}
          {localOrder && (
            <div
              className="rounded-xl p-6 md:p-8 flex items-start gap-4 mb-8"
              style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
            >
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
              >
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h1 className="font-display text-2xl text-primary">Your Order is Confirmed!</h1>
                <p className="mt-1 text-sm md:text-base text-primary/80">
                  A confirmation email has been sent to {order.email}
                </p>
                <p className="mt-2 text-xs text-primary/70">Order #{order.number}</p>
              </div>
            </div>
          )}

          {!localOrder && (
            <div className="mb-6">
              <h1 className="font-display text-2xl text-primary">Order #{order.number}</h1>
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
              const locked = isWithin2Hours(pd, pl);
              return (
                <div className="mb-4">
                  <p className="text-sm font-medium mb-1">Pickup</p>
                  {pd && pl ? (
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-sm text-foreground/80">
                        <Calendar size={14} className="shrink-0 text-primary" />
                        <span>{fmtDateKey(pd)}</span>
                        <Clock size={14} className="shrink-0 text-primary" />
                        <span>{pl}</span>
                      </div>
                      {locked ? (
                        <span className="text-xs text-muted-foreground italic">
                          Within 2 hours — contact us to reschedule
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => { setRescheduleSlot("pickup"); setNewWindow(null); }}
                        >
                          Reschedule pickup
                        </Button>
                      )}
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
              const locked = isWithin2Hours(rd, rl);
              return (
                <div>
                  <p className="text-sm font-medium mb-1">Return</p>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-foreground/80">
                      <Calendar size={14} className="shrink-0 text-primary" />
                      <span>{fmtDateKey(rd)}</span>
                      <Clock size={14} className="shrink-0 text-primary" />
                      <span>{rl}</span>
                    </div>
                    {locked ? (
                      <span className="text-xs text-muted-foreground italic">
                        Within 2 hours — contact us to reschedule
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => { setRescheduleSlot("return"); setNewWindow(null); }}
                      >
                        Reschedule return
                      </Button>
                    )}
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

          <div className="flex gap-3">
            <Button asChild variant="hero">
              <Link to="/account/orders">View my orders</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </main>
      <Footer />

      {/* Reschedule dialog */}
      <Dialog
        open={!!rescheduleSlot}
        onOpenChange={(open) => { if (!open) { setRescheduleSlot(null); setNewWindow(null); } }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Reschedule your {rescheduleSlot === "pickup" ? "pickup" : "return"}
            </DialogTitle>
            <DialogDescription>
              Select a new window below. Your previous booking will be cancelled automatically when
              you confirm.
            </DialogDescription>
          </DialogHeader>
          <PickupScheduler selected={newWindow} onSelect={setNewWindow} />
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={rescheduling}
              onClick={() => { setRescheduleSlot(null); setNewWindow(null); }}
            >
              Cancel
            </Button>
            <Button
              variant="hero"
              disabled={!newWindow || rescheduling}
              onClick={doReschedule}
            >
              {rescheduling ? "Rescheduling…" : "Confirm new window"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600", color: "#3d1700" }}
            >
              Reworks cover issues with the services listed above. Concerns outside of your
              original order, like scratches on your shoe if you didn't purchase scratch repair,
              aren't eligible for a complimentary rework but can be added as a new order.
            </div>

            {/* Description */}
            <div>
              <label htmlFor="rework-desc" className="text-sm font-medium block mb-2">
                What needs to be fixed?
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
