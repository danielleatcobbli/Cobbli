// TEMPORARY smoke test — do not ship. Exercises create-checkout flows
// (deposit + order) and simulates the webhook row update without an
// authenticated user. Delete after testing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeClient } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (_req) => {
  const out: Record<string, unknown> = {};
  try {
    const userId = "c2335c45-e420-42fc-bf1e-c42694f4c6ac";
    const stripe = createStripeClient("sandbox");

    // 1. Verify the assessment deposit price exists.
    const prices = await stripe.prices.list({ lookup_keys: ["assessment_deposit_20"] });
    out.deposit_price = prices.data[0] ? { id: prices.data[0].id, amount: prices.data[0].unit_amount } : null;
    if (!prices.data.length) throw new Error("Deposit price missing");

    // 2. Seed a test assessment row.
    const { data: asmt, error: aErr } = await supabase
      .from("assessments")
      .insert({ user_id: userId, deposit_status: "pending", status: "submitted" })
      .select("id")
      .single();
    if (aErr) throw aErr;
    out.assessment_id = asmt.id;

    // 3. Create a deposit checkout session.
    const customer = await stripe.customers.create({ metadata: { userId, smoke: "1" } });
    const depositSession = await stripe.checkout.sessions.create({
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: "https://example.com/return?session_id={CHECKOUT_SESSION_ID}",
      customer: customer.id,
      payment_intent_data: { description: "Cobbli assessment deposit (smoke)" },
      metadata: { userId, kind: "deposit", assessmentId: asmt.id },
      
    });
    out.deposit_session = { id: depositSession.id, has_secret: !!depositSession.client_secret };

    // 4. Seed an order + create order checkout session with price_data.
    const { data: ord, error: oErr } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        order_number: "CB-SMOKE",
        payment_status: "pending_payment",
        total_cents: 4599,
        subtotal_cents: 4599,
        delivery_method: "door-to-door",
        status: "pending",
      })
      .select("id, order_number, total_cents")
      .single();
    if (oErr) throw oErr;
    out.order_id = ord.id;

    const orderSession = await stripe.checkout.sessions.create({
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: `Cobbli order ${ord.order_number}` },
          unit_amount: ord.total_cents,
          
        },
        quantity: 1,
      }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: "https://example.com/return?session_id={CHECKOUT_SESSION_ID}",
      customer: customer.id,
      payment_intent_data: { description: `Cobbli order ${ord.order_number} (smoke)` },
      metadata: { userId, kind: "order", orderId: ord.id },
      
    });
    out.order_session = { id: orderSession.id, has_secret: !!orderSession.client_secret };

    // 5. Simulate webhook handler updating rows to "paid".
    await supabase.from("assessments").update({
      deposit_status: "paid",
      stripe_session_id: depositSession.id,
      deposit_paid_at: new Date().toISOString(),
    }).eq("id", asmt.id);
    await supabase.from("orders").update({
      payment_status: "paid",
      stripe_session_id: orderSession.id,
      paid_at: new Date().toISOString(),
    }).eq("id", ord.id);

    const { data: a2 } = await supabase.from("assessments").select("deposit_status, stripe_session_id").eq("id", asmt.id).single();
    const { data: o2 } = await supabase.from("orders").select("payment_status, stripe_session_id").eq("id", ord.id).single();
    out.assessment_after = a2;
    out.order_after = o2;

    // Cleanup test rows so the user's account isn't littered.
    await supabase.from("orders").delete().eq("id", ord.id);
    await supabase.from("assessments").delete().eq("id", asmt.id);

    return new Response(JSON.stringify({ ok: true, ...out }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err), ...out }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
