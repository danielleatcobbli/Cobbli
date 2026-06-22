// Stripe webhook handler (BYOK). Verifies signatures with STRIPE_WEBHOOK_SECRET
// and either flips an existing row to paid (deposit/order) or creates the order
// row + items from session metadata (cart) once Stripe confirms payment.
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

interface CartPayload {
  contact_email: string;
  contact_phone: string;
  delivery_address: unknown;
  repairs_subtotal_cents: number;
  courier_fee_cents: number;
  total_cents: number;
  items: Array<{
    pair_snapshot: unknown;
    service_snapshot: { id: string; name: string };
    price_cents: number;
  }>;
}

function reassembleCart(meta: Record<string, string>): CartPayload | null {
  const chunks: string[] = [];
  for (let i = 0; i < 50; i++) {
    const c = meta[`cart_${i}`];
    if (c === undefined) break;
    chunks.push(c);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(chunks.join("")) as CartPayload;
  } catch (e) {
    console.error("Failed to parse cart payload from metadata", e);
    return null;
  }
}

async function createOrderFromCart(
  meta: Record<string, string>,
  session: Stripe.Checkout.Session,
  paymentIntentId: string | null,
) {
  const userId = meta.userId;
  if (!userId) {
    console.error("cart webhook missing userId metadata");
    return;
  }

  // Idempotency: if a row already exists for this Stripe session, skip.
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing) {
    console.log("order already exists for session", session.id);
    return;
  }

  const payload = reassembleCart(meta);
  if (!payload) {
    console.error("cart webhook missing/invalid payload metadata");
    return;
  }

  const nowIso = new Date().toISOString();

  // Insert as pending_payment first, then flip to 'placed' so the existing
  // notify_order_confirmation trigger (fires on UPDATE OF status -> 'placed')
  // sends the confirmation email.
  const { data: orderRow, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      status: "pending_payment",
      delivery_method: "door-to-door",
      delivery_address: payload.delivery_address as never,
      contact_email: payload.contact_email,
      contact_phone: payload.contact_phone,
      payment_method_snapshot: null,
      repairs_subtotal_cents: payload.repairs_subtotal_cents,
      courier_fee_cents: payload.courier_fee_cents,
      tax_cents: 0,
      total_cents: payload.total_cents,
      payment_status: "paid",
      paid_at: nowIso,
      stripe_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
    })
    .select("id")
    .single();
  if (orderErr || !orderRow) {
    console.error("failed to insert order from cart", orderErr);
    return;
  }

  if (payload.items.length) {
    const itemRows = payload.items.map((it) => ({
      order_id: orderRow.id,
      pair_snapshot: it.pair_snapshot as never,
      service_snapshot: it.service_snapshot as never,
      price_cents: it.price_cents,
    }));
    const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
    if (itemsErr) console.error("failed to insert order_items", itemsErr);
  }

  const { error: statusErr } = await supabase
    .from("orders")
    .update({ status: "placed" })
    .eq("id", orderRow.id);
  if (statusErr) console.error("failed to flip order to placed", statusErr);
}

async function markPaid(
  meta: Record<string, string>,
  session: Stripe.Checkout.Session | null,
  paymentIntentId: string | null,
) {
  if (meta.kind === "cart") {
    if (!session) {
      console.error("cart webhook requires session context");
      return;
    }
    await createOrderFromCart(meta, session, paymentIntentId);
  } else if (meta.kind === "deposit" && meta.assessmentId) {
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
  // kind === "cart": no row exists yet — nothing to mark.
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
          await markPaid(meta, session, paymentIntentId);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const meta = (pi.metadata ?? {}) as Record<string, string>;
        // Cart orders are created from the session event, which carries the
        // chunked cart_* metadata. PI metadata may be truncated/missing it.
        if (meta.kind !== "cart") {
          await markPaid(meta, null, pi.id);
        }
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
