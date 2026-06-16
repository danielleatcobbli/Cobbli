import { loadStripe, Stripe } from "@stripe/stripe-js";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as
  | string
  | undefined;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!publishableKey) {
    throw new Error(
      "VITE_STRIPE_PUBLISHABLE_KEY is not set. Add it to your environment to enable checkout.",
    );
  }
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}

export function hasStripeKey(): boolean {
  return !!publishableKey;
}

export function isStripeTestMode(): boolean {
  return !!publishableKey?.startsWith("pk_test_");
}
