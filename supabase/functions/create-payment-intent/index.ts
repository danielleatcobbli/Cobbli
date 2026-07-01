// Creates a Stripe PaymentIntent for a cart checkout. The cart payload is
// chunked into PI metadata so the webhook can build the orders row + items
// after payment is confirmed (no DB row created until then).
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

const META_CHUNK_SIZE = 450;
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
    const payload = body.cartPayload;
    const existingIntentId = body.paymentIntentId as string | undefined;
    validateCartPayload(payload);

    const customerId = await resolveOrCreateCustomer({
      email: user.email ?? undefined,
      userId: user.id,
    });

    const metadata = {
      userId: user.id,
      kind: "cart",
      ...chunkPayload(payload),
    };

    // If the client passed an existing PI id, update it in place (covers users
    // editing their cart/address before placing the order).
    if (existingIntentId) {
      try {
        const existing = await stripe.paymentIntents.retrieve(existingIntentId);
        if (
          existing.status !== "succeeded" &&
          existing.status !== "canceled" &&
          existing.metadata?.userId === user.id
        ) {
          const updated = await stripe.paymentIntents.update(existingIntentId, {
            amount: payload.total_cents,
            metadata,
            description: "Cobbli order",
          });
          return new Response(
            JSON.stringify({
              clientSecret: updated.client_secret,
              paymentIntentId: updated.id,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (e) {
        console.warn("could not reuse PI, creating new one", e);
      }
    }

    const pi = await stripe.paymentIntents.create({
      amount: payload.total_cents,
      currency: "usd",
      customer: customerId,
      description: "Cobbli order",
      automatic_payment_methods: { enabled: true },
      metadata,
    });

    return new Response(
      JSON.stringify({ clientSecret: pi.client_secret, paymentIntentId: pi.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("create-payment-intent error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
