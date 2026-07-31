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
  contact_name?: string;
  delivery_address: unknown;
  repairs_subtotal_cents: number;
  courier_fee_cents: number;
  tax_cents: number;
  total_cents: number;
  /** Set by Checkout.tsx when the customer selected a pickup window.
   * start/end are ISO 8601 UTC strings. No booking exists yet at this point —
   * see bookPickup() below for why the Cal.com booking is created here,
   * server-side, rather than client-side in Checkout.tsx. */
  pickup_window?: {
    start: string;
    end: string;
    address: string;
  };
  items: Array<{
    pair_snapshot: unknown;
    service_snapshot: { id: string; name: string };
    price_cents: number;
  }>;
}

// ─── Pickup-window helpers ────────────────────────────────────────────────────

const NY_TZ = "America/New_York";

/** Converts a UTC ISO string to YYYY-MM-DD in New York local time.
 * en-CA locale produces the ISO date format naturally. */
function toNyDateKey(isoUtc: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NY_TZ }).format(
    new Date(isoUtc),
  );
}

/** Formats a start/end UTC ISO pair as a human time range in New York time.
 * Mirrors PickupScheduler.tsx's formatTimeRange() exactly:
 *   same period → "9:00 – 10:30 AM"
 *   cross period → "11:30 AM – 1:00 PM" */
function formatNyTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: NY_TZ,
    }).format(new Date(iso));

  const startStr = fmt(startIso); // e.g. "9:00 AM"
  const endStr = fmt(endIso);     // e.g. "10:30 AM"

  const startPeriod = startStr.slice(-2); // "AM" | "PM"
  const endPeriod = endStr.slice(-2);

  // Compress shared AM/PM: "9:00 – 10:30 AM"
  if (startPeriod === endPeriod) {
    return `${startStr.slice(0, -3)} – ${endStr}`;
  }
  return `${startStr} – ${endStr}`;
}

// Creates the Cal.com booking server-side, only once payment has succeeded.
// Booking used to be created client-side (Checkout.tsx calling cal-book) the
// moment the customer opened the Payment step — meaning a real booking
// existed on the calendar before checkout was ever completed. If the
// customer then went back and picked a different pickup window, the earlier
// booking was never updated or cancelled (a real bug caught in testing): the
// Cal.com invite and the eventual order could end up showing two different
// times. Calling cal-book here instead means exactly one booking is ever
// created, and only for the window the customer actually checked out with.
async function bookPickup(
  pickupWindow: NonNullable<CartPayload["pickup_window"]>,
  contactName: string,
  contactEmail: string,
  contactPhone: string,
): Promise<string | null> {
  try {
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cal-book`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start_time: pickupWindow.start,
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
        address: pickupWindow.address,
      }),
    });
    if (!resp.ok) {
      console.error("cal-book failed during order creation:", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    if (data?.error) {
      console.error("cal-book returned an error during order creation:", data.error);
      return null;
    }
    return (data?.event_uri as string | undefined) ?? null;
  } catch (e) {
    // Payment has already succeeded at this point — never let a scheduling
    // hiccup block the order from being created. Log clearly so it's
    // traceable; pickup_calendly_event_uri is simply left null on the order.
    console.error("cal-book call threw during order creation:", e);
    return null;
  }
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
  sessionId: string | null,
  paymentIntentId: string | null,
  paidAmountCents: number | null,
) {
  const userId = meta.userId;
  if (!userId) {
    throw new Error("cart webhook missing userId metadata");
  }

  const lookupCol = paymentIntentId ? "stripe_payment_intent_id" : "stripe_session_id";
  const lookupVal = paymentIntentId ?? sessionId;
  if (!lookupVal) {
    throw new Error("cart webhook missing Stripe payment identifiers");
  }

  // A retry can arrive after the order insert succeeded but a later item/status
  // write failed. Resume pending orders instead of treating every existing row
  // as fully processed.
  const { data: existing, error: lookupErr } = await supabase
    .from("orders")
    .select("id,status")
    .eq(lookupCol, lookupVal)
    .maybeSingle();
  if (lookupErr) {
    throw new Error(`failed to check existing cart order: ${lookupErr.message}`);
  }
  if (existing?.status === "placed") {
    console.log("placed order already exists for", lookupCol, lookupVal);
    return;
  }

  const payload = reassembleCart(meta);
  if (!payload) {
    throw new Error("cart webhook missing/invalid payload metadata");
  }
  if (
    !Number.isInteger(payload.total_cents)
    || typeof paidAmountCents !== "number"
    || !Number.isInteger(paidAmountCents)
    || payload.total_cents !== paidAmountCents
  ) {
    throw new Error(
      `cart amount mismatch: metadata=${payload.total_cents} paid=${paidAmountCents}`,
    );
  }

  const nowIso = new Date().toISOString();

  // Derive pickup columns from the window the customer selected at checkout.
  // Both are null when no window was selected (older orders, walk-up, etc.).
  const pickupDate = payload.pickup_window
    ? toNyDateKey(payload.pickup_window.start)
    : null;
  const pickupTimeLabel = payload.pickup_window
    ? formatNyTimeRange(payload.pickup_window.start, payload.pickup_window.end)
    : null;

  let orderRow = existing;
  if (!orderRow) {
    // Create the booking only for a new order. A retry of a pending order
    // resumes its database writes without creating another Cal.com event.
    const pickupCalendlyEventUri = payload.pickup_window
      ? await bookPickup(
          payload.pickup_window,
          payload.contact_name || payload.contact_email.split("@")[0] || "Customer",
          payload.contact_email,
          payload.contact_phone,
        )
      : null;

    const { data: inserted, error: orderErr } = await supabase
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
        tax_cents: payload.tax_cents ?? 0,
        total_cents: payload.total_cents,
        payment_status: "paid",
        paid_at: nowIso,
        stripe_session_id: sessionId,
        stripe_payment_intent_id: paymentIntentId,
        pickup_date: pickupDate,
        pickup_time_label: pickupTimeLabel,
        pickup_calendly_event_uri: pickupCalendlyEventUri,
      })
      .select("id,status")
      .maybeSingle();

    if (orderErr) {
      if ((orderErr as { code?: string }).code !== "23505") {
        throw new Error(`failed to insert order from cart: ${orderErr.message}`);
      }

      // The other concurrent webhook delivery won the insert. Load that row
      // and either accept its completed work or resume its pending work.
      const { data: racedOrder, error: raceLookupErr } = await supabase
        .from("orders")
        .select("id,status")
        .eq(lookupCol, lookupVal)
        .maybeSingle();
      if (raceLookupErr || !racedOrder) {
        throw new Error(
          `duplicate cart order could not be loaded: ${raceLookupErr?.message ?? "no row"}`,
        );
      }
      if (racedOrder.status === "placed") {
        return;
      }
      orderRow = racedOrder;
    } else {
      orderRow = inserted;
    }
  }

  if (!orderRow) {
    throw new Error("cart order insert returned no row");
  }

  if (payload.items.length) {
    const { data: existingItems, error: itemsLookupErr } = await supabase
      .from("order_items")
      .select("id")
      .eq("order_id", orderRow.id)
      .limit(1);
    if (itemsLookupErr) {
      throw new Error(`failed to check existing order_items: ${itemsLookupErr.message}`);
    }

    if (!existingItems?.length) {
      const itemRows = payload.items.map((it) => ({
        order_id: orderRow.id,
        pair_snapshot: it.pair_snapshot as never,
        service_snapshot: it.service_snapshot as never,
        price_cents: it.price_cents,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
      if (itemsErr) {
        throw new Error(`failed to insert order_items: ${itemsErr.message}`);
      }
    }
  }

  const { data: placedOrder, error: statusErr } = await supabase
    .from("orders")
    .update({ status: "placed" })
    .eq("id", orderRow.id)
    .select("id")
    .maybeSingle();
  if (statusErr || !placedOrder) {
    throw new Error(
      `failed to flip order to placed: ${statusErr?.message ?? "no matching row"}`,
    );
  }
}

async function markPaid(
  meta: Record<string, string>,
  sessionId: string | null,
  paymentIntentId: string | null,
  paidAmountCents: number | null,
) {
  if (meta.kind === "cart") {
    await createOrderFromCart(meta, sessionId, paymentIntentId, paidAmountCents);
  } else if (meta.kind === "deposit" && meta.assessmentId) {
    const { data, error } = await supabase
      .from("assessments")
      .update({
        deposit_status: "paid",
        deposit_paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .eq("id", meta.assessmentId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      throw new Error(`failed to mark deposit paid: ${error?.message ?? "no matching row"}`);
    }
  } else if (meta.kind === "order" && meta.orderId) {
    const { data, error } = await supabase
      .from("orders")
      .update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
        status: "placed",
      })
      .eq("id", meta.orderId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      throw new Error(`failed to mark order paid: ${error?.message ?? "no matching row"}`);
    }
  }
}

async function markFailed(meta: Record<string, string>) {
  if (meta.kind === "deposit" && meta.assessmentId) {
    const { data, error } = await supabase
      .from("assessments")
      .update({ deposit_status: "failed" })
      .eq("id", meta.assessmentId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      throw new Error(`failed to mark deposit failed: ${error?.message ?? "no matching row"}`);
    }
  } else if (meta.kind === "order" && meta.orderId) {
    const { data, error } = await supabase
      .from("orders")
      .update({ payment_status: "failed" })
      .eq("id", meta.orderId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      throw new Error(`failed to mark order failed: ${error?.message ?? "no matching row"}`);
    }
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
          await markPaid(meta, session.id, paymentIntentId, session.amount_total);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const meta = (pi.metadata ?? {}) as Record<string, string>;
        await markPaid(meta, null, pi.id, pi.amount_received);
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
