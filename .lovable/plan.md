## Goal
Replace the mocked payment flow with Lovable's built-in seamless Stripe integration, using **embedded in-page checkout**. Two paid flows:
1. **$20 assessment deposit** — charged upfront when user submits an assessment.
2. **Cart checkout total** — repairs subtotal + courier fee, charged at order placement.

No card hold (charge in full), no saved cards (guest-style each time).

---

## 1. Enable Stripe + create products

- Enable the seamless Stripe integration (sandbox auto-provisioned, live unlocked later via the go-live flow).
- Create one Stripe product/price:
  - `assessment_deposit` — fixed $20.00 one-time.
- For cart totals: use inline `price_data` per checkout session (amounts are dynamic — repairs + courier fee). No catalog price needed.
- Tax handling: enable full compliance handling (`managed_payments: { enabled: true }`) by default — Stripe handles tax calc/collection/filing for buyers in ~80 countries; +3.5% per transaction; bank statement shows `LINK.COM* Cobbli`. Can be changed later.

## 2. Backend (Supabase)

### Schema changes (one migration)
- `assessments`: add `deposit_status` (default `'pending'`), `stripe_session_id`, `stripe_payment_intent_id`, `deposit_amount_cents`, `deposit_paid_at`.
- `orders`: add `payment_status` (default `'pending'`), `stripe_session_id`, `stripe_payment_intent_id`, `paid_at`.
- Keep the local `payment_methods` table as-is for now, but stop writing to it from these flows.

### Edge functions
- `create-checkout` — accepts `{ kind: 'deposit' | 'order', assessmentId? | orderId?, environment }`, resolves/creates a Stripe Customer with `metadata.userId`, builds the Embedded Checkout session (`ui_mode: 'embedded_page'`, `managed_payments`, `return_url`), returns `clientSecret`. `verify_jwt = false` + in-code auth check.
- `payments-webhook` — handles `checkout.session.completed` and `payment_intent.succeeded`/`failed`. Updates `assessments.deposit_status` or `orders.payment_status` based on session metadata (`kind`, `assessmentId`/`orderId`). Idempotent.

### Row creation order
- **Assessment**: insert assessment row first (current behavior), then attach Stripe IDs and flip `deposit_status` on webhook.
- **Order**: insert `orders` row with `payment_status='pending'` first, open embedded checkout in-page, return URL navigates to `OrderConfirmation` which subscribes/polls until webhook marks it paid.

## 3. Frontend changes

- Install `@stripe/stripe-js@9.2.0` and `@stripe/react-stripe-js@6.2.0`.
- Add `src/lib/stripe.ts` (env detection from `VITE_PAYMENTS_CLIENT_TOKEN` prefix) and a `<PaymentTestModeBanner />` at the top of `AssessmentDeposit` and `Checkout`.
- New `StripeEmbeddedCheckout` component + `useStripeCheckout` hook.
- **`AssessmentDeposit.tsx`**: replace mock `pi_mock_...` submit with: insert assessment row → call `create-checkout` (`kind: 'deposit'`) → render embedded checkout in-page → on return, navigate to confirmation.
- **`Checkout.tsx`**: replace the existing "place order" handler that writes a fake `paymentLast4`. New flow: validate contact/address → insert `orders` row (pending) → embedded checkout → return URL hits `OrderConfirmation`, which shows a branded skeleton (per memory) until the webhook marks the order paid.
- Remove the "Payment processing is mocked" disclaimer copy on both pages.
- The existing Payment Methods page stays but is no longer part of these flows; we can deprecate it in a later sprint.

## 4. Out of scope (this pass)
- Saved cards / Stripe Customer Portal.
- Authorization-only card holds (charging full amount upfront).
- Refund automation (admin refunds from Stripe dashboard).
- Final repair charge after proposal acceptance (`AssessmentProposal.tsx`) — remains mocked unless you want it added.

## 5. Technical notes
- Stripe metadata: set `{ userId, kind, assessmentId | orderId }` on both Session and Customer so webhook + future read paths work.
- Webhook is idempotent via `onConflict` on `stripe_session_id`.
- `return_url` includes `{CHECKOUT_SESSION_ID}` so the return page can confirm session.
- Failure UX: if webhook reports failure, show retry CTA that re-opens checkout for the same row.
- `verify_jwt = false` on both payment edge functions (required for CORS preflight + webhook).

## Files touched (approx)
- **New**: `supabase/functions/create-checkout/index.ts`, `supabase/functions/payments-webhook/index.ts`, `supabase/functions/_shared/stripe.ts`, `src/lib/stripe.ts`, `src/components/StripeEmbeddedCheckout.tsx`, `src/components/PaymentTestModeBanner.tsx`, `src/hooks/useStripeCheckout.tsx`.
- **Edited**: `src/pages/AssessmentDeposit.tsx`, `src/pages/Checkout.tsx`, `src/pages/OrderConfirmation.tsx`, `src/pages/AssessmentConfirmation.tsx`, `supabase/config.toml`.
- **Migration**: payment columns on `assessments` + `orders`.
