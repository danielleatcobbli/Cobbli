// Creates a Stripe Embedded Checkout session for an assessment deposit, an
// existing order row, or a brand-new cart (no DB row yet — the order is
// created by the webhook after payment is confirmed).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@17.5.0?target=denonext";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const DEPOSIT_AMOUNT_CENTS = 2000;
const META_CHUNK_SIZE = 450; // Stripe metadata: 500 chars/value, leave headroom
const MAX_META_CHUNKS = 30;

async function resolveOrCreateCustomer(
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

function chunkPayload(payload: unknown): Record<string, string> {
  const json = JSON.stringify(payload);
  const out: Record<string, string> = {};
  for (let i = 0, idx = 0; i < json.length; i += META_CHUNK_SIZE, idx++) {
    if (idx >= MAX_META_CHUNKS) {
      throw new Error("Cart payload exceeds metadata capacity");
    }
    out[`cart_${idx}`] = json.slice(i, i + META_CHUNK_SIZE);
  }
  return out;
}

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

function validateCartPayload(p: unknown): asserts p is CartPayload {
  if (!p || typeof p !== "object") throw new Error("Invalid cart payload");
  const c = p as Record<string, unknown>;
  if (typeof c.contact_email !== "string" || !c.contact_email.includes("@")) {
    throw new Error("Invalid contact_email");
  }
  if (typeof c.contact_phone !== "string") throw new Error("Invalid contact_phone");
  if (!c.delivery_address || typeof c.delivery_address !== "object") {
    throw new Error("Invalid delivery_address");
  }
  if (typeof c.total_cents !== "number" || c.total_cents < 50) {
    throw new Error("Invalid total_cents");
  }
  if (typeof c.repairs_subtotal_cents !== "number" || c.repairs_subtotal_cents < 0) {
    throw new Error("Invalid repairs_subtotal_cents");
  }
  if (typeof c.courier_fee_cents !== "number" || c.courier_fee_cents < 0) {
    throw new Error("Invalid courier_fee_cents");
  }
  if (!Array.isArray(c.items) || c.items.length === 0) {
    throw new Error("Cart has no items");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
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
    const kind = body.kind as "deposit" | "order" | "cart";
    const returnUrl = body.returnUrl as string;

    if (!kind || !returnUrl) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = await resolveOrCreateCustomer({
      email: user.email ?? undefined,
      userId: user.id,
    });

    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    let description: string;
    let metadata: Record<string, string>;

    if (kind === "deposit") {
      const rowId = body.rowId as string;
      if (!rowId) throw new Error("Missing rowId");
      const { data: row, error } = await supabase
        .from("assessments")
        .select("id, user_id, deposit_status")
        .eq("id", rowId)
        .maybeSingle();
      if (error || !row) throw new Error("Assessment not found");
      if (row.user_id !== user.id) throw new Error("Forbidden");
      if (row.deposit_status === "paid") throw new Error("Already paid");

      lineItems = [{
        price_data: {
          currency: "usd",
          product_data: { name: "Cobbli assessment deposit" },
          unit_amount: DEPOSIT_AMOUNT_CENTS,
        },
        quantity: 1,
      }];
      description = "Cobbli assessment deposit";
      metadata = { userId: user.id, kind, assessmentId: rowId };
    } else if (kind === "order") {
      const rowId = body.rowId as string;
      if (!rowId) throw new Error("Missing rowId");
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
    } else if (kind === "cart") {
      const payload = body.cartPayload;
      validateCartPayload(payload);

      lineItems = [{
        price_data: {
          currency: "usd",
          product_data: { name: "Cobbli order" },
          unit_amount: payload.total_cents,
        },
        quantity: 1,
      }];
      description = "Cobbli order";
      metadata = {
        userId: user.id,
        kind,
        ...chunkPayload(payload),
      };
    } else {
      throw new Error("Unknown kind");
    }

    const session = await stripe.checkout.sessions.create({
      line_items: lineItems,
      mode: "payment",
      ui_mode: "embedded",
      return_url: returnUrl,
      customer: customerId,
      payment_intent_data: { description, metadata },
      metadata,
    });

    if (kind === "deposit") {
      await supabase
        .from("assessments")
        .update({ stripe_session_id: session.id, deposit_amount_cents: DEPOSIT_AMOUNT_CENTS })
        .eq("id", body.rowId);
    } else if (kind === "order") {
      await supabase
        .from("orders")
        .update({ stripe_session_id: session.id })
        .eq("id", body.rowId);
    }
    // kind === "cart": nothing to persist yet — webhook creates the order row.

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
