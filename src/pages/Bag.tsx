import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { useBag, formatPrice } from "@/context/BagContext";
import emptyBagIcon from "@/assets/icons/empty-bag.svg";

const Bag = () => {
  const { items, itemCount, subtotal, updateQuantity, removeItem } = useBag();
  const isEmpty = items.length === 0;
  const FREE_SHIPPING_THRESHOLD = 5000; // $50 in cents
  const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        <div className="container py-10">
          {!isEmpty && remainingForFree > 0 && (
            <p className="text-center text-sm text-foreground/80 mb-6">
              Free service to your door on orders over {formatPrice(FREE_SHIPPING_THRESHOLD)}
            </p>
          )}

          <h1 className="text-3xl md:text-4xl font-semibold mb-8">Shopping bag</h1>

          {isEmpty ? (
            <EmptyBag />
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              {/* Items */}
              <ul className="divide-y divide-border border-y border-border">
                {items.map((item) => (
                  <li key={item.id} className="py-6 flex gap-4">
                    <div className="h-20 w-20 rounded-md bg-muted shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-medium">{item.name}</h3>
                          {item.options && (
                            <p className="text-sm text-muted-foreground mt-1">{item.options}</p>
                          )}
                        </div>
                        <p className="font-medium whitespace-nowrap">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-md border border-input">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="h-9 w-9 flex items-center justify-center hover:bg-accent transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-sm" aria-live="polite">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="h-9 w-9 flex items-center justify-center hover:bg-accent transition-colors"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-sm text-muted-foreground hover:text-destructive inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Order summary */}
              <aside className="lg:sticky lg:top-32 h-fit">
                <div className="rounded-lg border border-border bg-card p-6 shadow-soft">
                  <h2 className="text-lg font-semibold mb-4">Order summary</h2>
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Items ({itemCount})</dt>
                      <dd>{formatPrice(subtotal)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Pickup &amp; return</dt>
                      <dd>{remainingForFree === 0 ? "Free" : "Calculated at checkout"}</dd>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between font-semibold text-base">
                      <dt>Subtotal</dt>
                      <dd>{formatPrice(subtotal)}</dd>
                    </div>
                  </dl>
                  <Button asChild variant="hero" size="lg" className="w-full mt-6">
                    <Link to="/checkout">Checkout</Link>
                  </Button>
                  <p className="mt-3 text-xs text-muted-foreground text-center">
                    Taxes calculated at checkout.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

const EmptyBag = () => (
  <div className="rounded-lg border border-border bg-card py-16 px-6 flex flex-col items-center text-center shadow-soft">
    <img src={emptyBagIcon} alt="" className="h-[72px] w-[72px] mb-6" />
    <h2 className="text-xl font-semibold mb-2">Your bag is empty</h2>
    <p className="text-muted-foreground mb-6 max-w-sm">
      Browse our services and add a repair to get started.
    </p>
    <Button asChild variant="hero" size="lg">
      <Link to="/#services">Start a repair</Link>
    </Button>
  </div>
);

export default Bag;
