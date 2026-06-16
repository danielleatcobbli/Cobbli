## Goal
Remove the Lovable-managed (seamless) Stripe integration and replace it with a bring-your-own-key (BYOK) setup using your own Stripe account.

Heads up: the seamless integration is generally smoother (no key rotation, no webhook setup, managed go-live). Going BYOK means you manage your Stripe account, keys, and webhook endpoint yourself. Confirming this is what you want before I touch anything.

## What gets deleted

Files that exist purely to support the gateway-proxied seamless flow:

- `src/lib/stripe.ts` — reads `VITE_PAYMENTS_CLIENT_TOKEN` and derives sandbox/live from the token prefix
- `src/components/PaymentTestModeBanner.tsx` — banner driven by the seamless token
- `src/components/StripeEmbeddedCheckout.tsx` — current wrapper (will be rebuilt simpler)
- `supabase/functions/_shared/stripe.ts` — connector-gateway proxy client
- `supabase/functions/create-checkout/index.ts` — gateway-based session creator
- `supabase/functions/payments-webhook/index.ts` — gateway webhook handler
- Corresponding `[functions.create-checkout]` / `[functions.payments-webhook]` blocks in `supabase/config.toml`
- The two deployed edge functions removed from the backend

I will also unwire any imports of the deleted modules in `src/pages/Checkout.tsx` and `src/pages/AssessmentDeposit.tsx` so the app keeps compiling. Those two pages currently call into the seamless checkout — see "Open question" below for how you want them rebuilt.

## What gets added (BYOK)

1. **Secrets** (via the secrets tool, not committed to `.env`):
   - `STRIPE_SECRET_KEY` — your `sk_test_...` or `sk_live_...` key
   - `STRIPE_WEBHOOK_SECRET` — `whsec_...` from the webhook endpoint you create in your Stripe dashboard
2. **Publishable key in env** (safe to commit):
   - `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` in `.env` / `.env.development`
3. **New `src/lib/stripe.ts`** — `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`
4. **New edge functions** using the Stripe SDK directly with `STRIPE_SECRET_KEY`:
   - `create-checkout` — creates an Embedded Checkout session, returns `clientSecret`
   - `stripe-webhook` — verifies signature with `STRIPE_WEBHOOK_SECRET` and handles `checkout.session.completed`, etc.
5. **Rebuilt `StripeEmbeddedCheckout.tsx`** — same UX (embedded, inline), just pointed at the new function and using the publishable key directly.
6. **Webhook URL** I'll give you after deploy — you paste it into Stripe Dashboard → Webhooks, then send me back the signing secret to store.

## Order of operations

1. You confirm the plan.
2. I delete the seamless files + config blocks and call `supabase--delete_edge_functions` for the two old functions.
3. I request `STRIPE_SECRET_KEY` via the secrets tool (you paste it in the secure form).
4. I add `VITE_STRIPE_PUBLISHABLE_KEY` to `.env` (you tell me the `pk_...` value or paste it — publishable keys are safe in code).
5. I write the new `src/lib/stripe.ts`, edge functions, and rebuilt embedded checkout component, and rewire `Checkout.tsx` / `AssessmentDeposit.tsx`.
6. I give you the webhook URL; you create the endpoint in Stripe and send back `whsec_...`; I store it as `STRIPE_WEBHOOK_SECRET`.

## Open question

`Checkout.tsx` and `AssessmentDeposit.tsx` are real app flows (not just demo). Do you want me to:
- **(a)** Port them 1:1 to the new BYOK setup (same UX, same prices, just different backend) — recommended, or
- **(b)** Strip the Stripe wiring out of them entirely and leave them as placeholders for you to rebuild later?

Also: do you already have the Stripe account ready (test mode keys handy), or do you need a moment to grab them before I proceed?
