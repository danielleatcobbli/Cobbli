import { useEffect, useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, MessageSquare, Loader2 } from "lucide-react";
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
            <div className="text-sm space-y-1 mb-4">
              <p className="font-medium">Delivery address</p>
              <p className="text-foreground/80">
                {a.street}
                {a.street2 ? `, ${a.street2}` : ""}
                <br />
                {a.city}, {a.state} {a.zip}
              </p>
            </div>
            <div className="rounded-md bg-accent/30 border border-border p-3 flex items-start gap-2 text-sm">
              <MessageSquare size={16} className="mt-0.5 shrink-0 text-primary" />
              <span>We'll text you to coordinate your pickup and return windows.</span>
            </div>
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
