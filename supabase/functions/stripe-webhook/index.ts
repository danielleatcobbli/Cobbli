// Stripe webhook handler (BYOK). Verifies signatures with STRIPE_WEBHOOK_SECRET
// and updates assessments.deposit_status / orders.payment_status.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@17.5.0?target=denonext";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

async function markPaid(meta: Record<string, string>, paymentIntentId: string | null) {
  if (meta.kind === "deposit" && meta.assessmentId) {
    await supabase
      .from("assessments")
      .update({
        deposit_status: "paid",
        deposit_paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", meta.assessmentId);
  } else if (meta.kind === "order" && meta.orderId) {
    await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
        status: "placed",
      })
      .eq("id", meta.orderId);
  }
}

async function markFailed(meta: Record<string, string>) {
  if (meta.kind === "deposit" && meta.assessmentId) {
    await supabase
      .from("assessments")
      .update({ deposit_status: "failed" })
      .eq("id", meta.assessmentId);
  } else if (meta.kind === "order" && meta.orderId) {
    await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", meta.orderId);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
  } catch (e) {
    console.error("Signature verification failed:", e);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    console.log("stripe-webhook event:", event.type);
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const meta = (session.metadata ?? {}) as Record<string, string>;
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        if (session.payment_status === "paid") {
          await markPaid(meta, paymentIntentId);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const meta = (pi.metadata ?? {}) as Record<string, string>;
        await markPaid(meta, pi.id);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const meta = (pi.metadata ?? {}) as Record<string, string>;
        await markFailed(meta);
        break;
      }
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook handler error:", e);
    return new Response("Webhook error", { status: 500 });
  }
});
