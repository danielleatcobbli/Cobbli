import { useCallback, useMemo } from "react";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { apiFetchJson } from "@/integrations/api/client";

export type CheckoutKind = "deposit" | "order" | "cart";

interface StripeEmbeddedCheckoutProps {
  kind: CheckoutKind;
  /** assessmentId for kind="deposit", orderId for kind="order". Omit for kind="cart". */
  rowId?: string;
  /** Required for kind="cart" — full order data, persisted only after Stripe confirms payment. */
  cartPayload?: unknown;
  returnUrl: string;
  /** A session prepared by the parent, allowing other checkout work to run in parallel. */
  clientSecret?: string;
}

export function StripeEmbeddedCheckoutPanel({
  kind,
  rowId,
  cartPayload,
  returnUrl,
  clientSecret,
}: StripeEmbeddedCheckoutProps) {
  const fetchClientSecret = useCallback(async (): Promise<string> => {
    const data = await apiFetchJson<{ clientSecret?: string }>("/checkout/", {
      method: "POST",
      body: JSON.stringify({ kind, rowId, cartPayload, returnUrl }),
    });
    if (!data?.clientSecret) {
      throw new Error("Failed to create checkout session");
    }
    return data.clientSecret;
  }, [kind, rowId, cartPayload, returnUrl]);

  // Stripe's EmbeddedCheckoutProvider only ever calls fetchClientSecret once
  // and refuses to pick up a new one on re-render ("Unsupported prop change"
  // warning) — it just silently keeps using the very first Checkout Session
  // it fetched. That meant every subsequent placeOrder() (fresh cartPayload,
  // fresh /checkout/ session — e.g. with an up-to-date saved-card config)
  // was invisible to the already-mounted embed. Keying on the inputs forces
  // React to fully unmount/remount the provider so it actually fetches a new
  // session instead of reusing a stale one.
  const instanceKey = useMemo(
    () => clientSecret ?? JSON.stringify({ kind, rowId, cartPayload }),
    [clientSecret, kind, rowId, cartPayload],
  );
  const options = useMemo(
    () => (clientSecret ? { clientSecret } : { fetchClientSecret }),
    [clientSecret, fetchClientSecret],
  );

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider key={instanceKey} stripe={getStripe()} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
