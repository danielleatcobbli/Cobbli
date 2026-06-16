import { loadStripe, Stripe } from "@stripe/stripe-js";

const PUBLISHABLE_KEY =
  "pk_live_51T4kZ0JMi25gSdBj4jlvMmhJLCJm3fJExmxbACkie3rn2op6vmNqihiXCO7opCPQ9tQs6ipfrgIcOHSNZNdeOd4A00MqI2QctQ";

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
