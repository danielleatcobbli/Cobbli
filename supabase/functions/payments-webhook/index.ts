// Stripe webhook handler. Updates assessments.deposit_status and orders.payment_status
// when checkout sessions and payment intents resolve.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyWebhook, type StripeEnv } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

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

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    console.error("Webhook received with invalid env:", rawEnv);
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), { status: 200 });
  }
  const env: StripeEnv = rawEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("payments-webhook event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
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
        const pi = event.data.object;
        const meta = (pi.metadata ?? {}) as Record<string, string>;
        await markPaid(meta, pi.id);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object;
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
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
