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
}

export function StripeEmbeddedCheckoutPanel({
  kind,
  rowId,
  cartPayload,
  returnUrl,
}: StripeEmbeddedCheckoutProps) {
  const fetchClientSecret = async (): Promise<string> => {
    const data = await apiFetchJson<{ clientSecret?: string }>("/checkout/", {
      method: "POST",
      body: JSON.stringify({ kind, rowId, cartPayload, returnUrl }),
    });
    if (!data?.clientSecret) {
      throw new Error("Failed to create checkout session");
    }
    return data.clientSecret;
  };

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
