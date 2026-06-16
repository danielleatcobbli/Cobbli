import { hasStripeKey, isStripeTestMode } from "@/lib/stripe";

export function PaymentTestModeBanner() {
  if (!hasStripeKey()) {
    return (
      <div className="w-full bg-red-100 border-b border-red-300 px-4 py-2 text-center text-sm text-red-800">
        Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in your environment to accept payments.
      </div>
    );
  }
  if (isStripeTestMode()) {
    return (
      <div className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 text-center text-sm text-orange-800">
        Test mode — use card{" "}
        <span className="font-mono">4242 4242 4242 4242</span> with any future expiry and any CVC.
      </div>
    );
  }
  return null;
}
