import { usePageMeta } from "@/hooks/usePageMeta";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, MessageSquare } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/context/AccountContext";
import { formatPrice } from "@/context/BagContext";

const OrderConfirmation = () => {
  const { id } = useParams();
  const { orders } = useAccount();
  const order = orders.find((o) => o.id === id);

  usePageMeta({
    title: "Order confirmed — Cobbli",
    description:
      "Your Cobbli shoe repair order is confirmed. We'll text you to coordinate your door-to-door pickup and return windows across NYC.",
  });

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1">
          <div className="container py-16 text-center">
            <h1 className="text-2xl font-semibold mb-3">Order not found</h1>
            <Button asChild variant="hero"><Link to="/account/orders">View my orders</Link></Button>
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
          {/* Confirmation banner */}
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
                A confirmation email has been sent to {order.email}.
              </p>
              <p className="mt-2 text-xs text-primary/70">Order #{order.number}</p>
            </div>
          </div>

          {/* Pickup & Return Details */}
          <section className="rounded-lg border border-border bg-card p-6 shadow-soft mb-6">
            <h2 className="text-lg font-semibold mb-4">Pickup &amp; Return Details</h2>
            <div className="text-sm space-y-1 mb-4">
              <p className="font-medium">Delivery address</p>
              <p className="text-foreground/80">
                {a.street}{a.street2 ? `, ${a.street2}` : ""}<br />
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
                        <span>{s.name}</span>
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

          <div className="flex gap-3">
            <Button asChild variant="hero"><Link to="/account/orders">View my orders</Link></Button>
            <Button asChild variant="ghost"><Link to="/">Back to home</Link></Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default OrderConfirmation;
