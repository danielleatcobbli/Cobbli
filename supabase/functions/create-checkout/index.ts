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

// ---------------------------------------------------------------------------
// Server-side price recomputation (2026-08-11, security fix) — the "cart"
// branch below used to trust payload.total_cents and each item's
// payload.price_cents wholesale, both for the actual Stripe charge AND for
// the metadata the webhook later reads to create the order/order_items rows.
// Since both numbers came from the same untouched client payload, they were
// self-consistent even when tampered with (e.g. via devtools), so nothing
// ever caught it. Every item's price is now recomputed here from the live
// Supabase catalog and used for both the charge and the metadata, mirroring
// the same lookup rules the frontend uses (fullResolePrice / resolePriceForKey
// / priceForShoeType in src/types/service.ts, usePackagePrices.ts) so the
// price a customer sees on screen still matches what they're charged.
// ---------------------------------------------------------------------------

const LEGACY_PACKAGE_ALIASES: Record<string, string> = {
  "standard-repair-sole-upper-interior": "standard-service",
  "exterior-repair-sole-upper": "full-exterior-repair",
};
const canonicalPackageSlug = (slug: string) => LEGACY_PACKAGE_ALIASES[slug] ?? slug;

const SHOE_TYPE_VARIANT_KEY: Record<string, string> = {
  Boots: "boots",
  "Ankle boots": "ankle_boots",
};

type VariantRow = { variant_key: string; standard_cents: number; premium_cents: number | null; rank: number };
type ServiceRow = { slug: string; service_variants: VariantRow[] };

/** Authoritative price (cents) for one cart item, given the live catalog row
 *  for its slug. Mirrors, in order: full-resole priced by brand, full-resole
 *  priced by sole material, then the general shoe-type/premium variant
 *  lookup every other service uses. Throws rather than returning 0 for
 *  anything unrecognized -- an unknown variant should never silently become
 *  a free line item. */
function priceForItem(
  service: ServiceRow,
  item: { pair_snapshot: unknown; service_snapshot: Record<string, unknown> },
): number {
  const variants = [...service.service_variants].sort((a, b) => a.rank - b.rank);
  if (variants.length === 0) throw new Error(`Service ${service.slug} has no priced variants`);

  const snap = item.service_snapshot ?? {};
  const premium = snap.premium === true;
  const withPremium = (v: VariantRow) => (premium && v.premium_cents != null ? v.premium_cents : v.standard_cents);

  if (service.slug === "full-resole" && typeof snap.resole_brand === "string") {
    const v = variants.find((x) => x.variant_key === snap.resole_brand);
    if (!v) throw new Error(`Unknown resole brand variant: ${snap.resole_brand}`);
    return v.standard_cents;
  }
  if (service.slug === "full-resole" && typeof snap.sole_material === "string") {
    const key = (snap.sole_material as string).toLowerCase();
    const v = variants.find((x) => x.variant_key === key);
    if (!v) throw new Error(`Unknown sole material variant: ${snap.sole_material}`);
    return withPremium(v);
  }

  const shoeType = (item.pair_snapshot as { shoeType?: string } | null)?.shoeType;
  const wanted = shoeType ? (SHOE_TYPE_VARIANT_KEY[shoeType] ?? "other") : "other";
  const byShoe = variants.find((x) => x.variant_key === wanted);
  return withPremium(byShoe ?? variants[0]);
}

/** Recomputes every item's price and the cart totals from the live catalog,
 *  ignoring whatever the client sent for price_cents/total_cents/
 *  repairs_subtotal_cents. Returns a corrected payload, used for both the
 *  Stripe line item and the metadata the webhook reads. */
async function repriceCartPayload(payload: CartPayload): Promise<CartPayload> {
  const serviceSlugs = new Set<string>();
  const bundleSlugs = new Set<string>();
  for (const item of payload.items) {
    const id = item.service_snapshot.id;
    if (id.startsWith("bundle-")) bundleSlugs.add(canonicalPackageSlug(id.slice("bundle-".length)));
    else serviceSlugs.add(id);
  }

  const [servicesRes, packagesRes] = await Promise.all([
    serviceSlugs.size
      ? supabase.from("services").select("slug, service_variants(variant_key, standard_cents, premium_cents, rank)").in("slug", Array.from(serviceSlugs))
      : Promise.resolve({ data: [] as ServiceRow[], error: null }),
    bundleSlugs.size
      ? supabase.from("repair_packages").select("slug, price_cents").eq("is_active", true).in("slug", Array.from(bundleSlugs))
      : Promise.resolve({ data: [] as { slug: string; price_cents: number }[], error: null }),
  ]);
  if (servicesRes.error) throw servicesRes.error;
  if (packagesRes.error) throw packagesRes.error;

  const serviceBySlug = new Map((servicesRes.data as ServiceRow[]).map((s) => [s.slug, s]));
  const packageBySlug = new Map((packagesRes.data ?? []).map((p) => [p.slug, p.price_cents]));

  let repairsSubtotalCents = 0;
  const items = payload.items.map((item) => {
    const id = item.service_snapshot.id;
    let priceCents: number;
    if (id.startsWith("bundle-")) {
      const slug = canonicalPackageSlug(id.slice("bundle-".length));
      const price = packageBySlug.get(slug);
      if (price === undefined) throw new Error(`Unknown or inactive package: ${slug}`);
      priceCents = price;
    } else {
      const service = serviceBySlug.get(id);
      if (!service) throw new Error(`Unknown or inactive service: ${id}`);
      priceCents = priceForItem(service, item);
    }
    repairsSubtotalCents += priceCents;
    return { ...item, price_cents: priceCents };
  });

  const { data: feeRows, error: feeError } = await supabase
    .from("pricing_config")
    .select("key, value_cents")
    .in("key", ["courier_fee_cents", "free_courier_threshold_cents"]);
  if (feeError) throw feeError;
  const fee = (key: string, fallback: number) => feeRows?.find((r) => r.key === key)?.value_cents ?? fallback;
  const courierFeeCents = repairsSubtotalCents >= fee("free_courier_threshold_cents", 10000) ? 0 : fee("courier_fee_cents", 1500);

  return {
    ...payload,
    items,
    repairs_subtotal_cents: repairsSubtotalCents,
    courier_fee_cents: courierFeeCents,
    total_cents: repairsSubtotalCents + courierFeeCents,
  };
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
    service_snapshot: {
      id: string;
      name: string;
      sole_material?: string;
      resole_brand?: string;
      premium?: boolean;
      [key: string]: unknown;
    };
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
      const rawPayload = body.cartPayload;
      validateCartPayload(rawPayload);
      // Recomputed from the live catalog -- see repriceCartPayload above.
      // rawPayload's own price_cents/total_cents are never used past this
      // point; only the corrected payload feeds the Stripe charge and the
      // metadata the webhook uses to create the order.
      const payload = await repriceCartPayload(rawPayload);
      if (payload.total_cents !== rawPayload.total_cents) {
        console.warn(
          `create-checkout: cart total mismatch, client=${rawPayload.total_cents} recomputed=${payload.total_cents} user=${user.id}`,
        );
      }

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
