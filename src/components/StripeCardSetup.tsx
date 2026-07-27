import { useState, type FormEvent, type ReactNode } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe";
import { Button } from "@/components/ui/button";

interface StripeCardSetupFormProps {
  /** client_secret from a Stripe SetupIntent (see /payment-methods/setup-intent). */
  clientSecret: string;
  submitLabel: string;
  /** Gate submission on fields collected outside this component (e.g. cardholder name). */
  disabled?: boolean;
  onSuccess: (setupIntentId: string) => void | Promise<void>;
  onError: (message: string) => void;
  onCancel?: () => void;
  /** Extra content rendered above the card element, e.g. validation errors. */
  children?: ReactNode;
}

function InnerForm({
  submitLabel,
  disabled,
  onSuccess,
  onError,
  onCancel,
  children,
}: Omit<StripeCardSetupFormProps, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting || disabled) return;
    setSubmitting(true);
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (error) {
      setSubmitting(false);
      onError(error.message ?? "Could not save card. Please try again.");
      return;
    }
    if (setupIntent?.status === "succeeded") {
      await onSuccess(setupIntent.id);
      setSubmitting(false);
    } else {
      setSubmitting(false);
      onError("Could not verify your card. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {children}
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="hero" disabled={!stripe || submitting || disabled}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** Securely collects a card via Stripe Elements and confirms a SetupIntent,
 * so we tokenize with Stripe directly and never see raw card data ourselves. */
export function StripeCardSetupForm({ clientSecret, ...rest }: StripeCardSetupFormProps) {
  return (
    <Elements stripe={getStripe()} options={{ clientSecret }}>
      <InnerForm {...rest} />
    </Elements>
  );
}
