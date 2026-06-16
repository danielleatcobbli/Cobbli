import { loadStripe, Stripe } from "@stripe/stripe-js";

const PUBLISHADOWABLE_KEY =
  "pk_test_51T4kZ0JMi25gSdBjocbDzVWiHwyFcEG5Gl9uupHVvDnWKgCIlkovH0PPWP7ObWBsEfootUkROq9MlrwmBqOzoshc00nSD3Yu0H";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(PUBLISHABLE_KEY);
  }
  return stripePromise;
}

export function hasStripeKey(): boolean {
  return true;
}

export function isStripeTestMode(): boolean {
  return PUBLISHABLE_KEY.startsWith("pk_test_");
}
