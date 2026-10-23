import { loadStripe, Stripe } from "@stripe/stripe-js";

const PUBLISHABLE_KEY = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "").trim();

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!hasStripeKey()) return Promise.resolve(null);
  if (!stripePromise) {
    stripePromise = loadStripe(PUBLISHABLE_KEY);
  }
  return stripePromise;
}

export function hasStripeKey(): boolean {
  return /^pk_(test|live)_/.test(PUBLISHABLE_KEY);
}

export function isStripeTestMode(): boolean {
  return PUBLISHABLE_KEY.startsWith("pk_test_");
}
