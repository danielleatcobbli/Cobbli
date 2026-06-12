// Creates a Stripe Embedded Checkout session for either an assessment deposit
// or a cart order. Returns { clientSecret } for the frontend to mount.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createStripeClient, corsHeaders, type StripeEnv } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const DEPOSIT_PRICE_LOOKUP_KEY = "assessment_deposit_20";

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");

  const found = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;

  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (c.metadata?.userId !== options.userId) {
        await stripe.customers.update(c.id, {
          metadata: { ...c.metadata, userId: options.userId },
        });
      }
      return c.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Auth check
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const kind = body.kind as "deposit" | "order";
    const rowId = body.rowId as string;
    const returnUrl = body.returnUrl as string;
    const environment = body.environment as StripeEnv;

    if (!kind || !rowId || !returnUrl || (environment !== "sandbox" && environment !== "live")) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = createStripeClient(environment);
    const customerId = await resolveOrCreateCustomer(stripe, {
      email: user.email ?? undefined,
      userId: user.id,
    });

    let lineItems: any[];
    let description: string;
    let metadata: Record<string, string>;

    if (kind === "deposit") {
      // Verify the assessment belongs to this user and is unpaid.
      const { data: row, error } = await supabase
        .from("assessments")
        .select("id, user_id, deposit_status")
        .eq("id", rowId)
        .maybeSingle();
      if (error || !row) throw new Error("Assessment not found");
      if (row.user_id !== user.id) throw new Error("Forbidden");
      if (row.deposit_status === "paid") throw new Error("Already paid");

      const prices = await stripe.prices.list({ lookup_keys: [DEPOSIT_PRICE_LOOKUP_KEY] });
      if (!prices.data.length) throw new Error("Deposit price not configured");
      lineItems = [{ price: prices.data[0].id, quantity: 1 }];
      description = "Cobbli assessment deposit";
      metadata = { userId: user.id, kind, assessmentId: rowId };
    } else {
      // order: build inline price_data from the orders row total
      const { data: row, error } = await supabase
        .from("orders")
        .select("id, user_id, payment_status, total_cents, order_number")
        .eq("id", rowId)
        .maybeSingle();
      if (error || !row) throw new Error("Order not found");
      if (row.user_id !== user.id) throw new Error("Forbidden");
      if (row.payment_status === "paid") throw new Error("Already paid");
      if (!row.total_cents || row.total_cents < 50) throw new Error("Invalid order total");

      lineItems = [{
        price_data: {
          currency: "usd",
          product_data: { name: `Cobbli order ${row.order_number}` },
          unit_amount: row.total_cents,
        },
        quantity: 1,
      }];
      description = `Cobbli order ${row.order_number}`;
      metadata = { userId: user.id, kind, orderId: rowId };
    }

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      customer: customerId,
      payment_intent_data: {
        description,
        metadata,
      },
      metadata,
    });

    // Stamp the row with the session id so the webhook can update it.
    if (kind === "deposit") {
      await supabase
        .from("assessments")
        .update({ stripe_session_id: session.id, deposit_amount_cents: 2000 })
        .eq("id", rowId);
    } else {
      await supabase
        .from("orders")
        .update({ stripe_session_id: session.id })
        .eq("id", rowId);
    }

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
