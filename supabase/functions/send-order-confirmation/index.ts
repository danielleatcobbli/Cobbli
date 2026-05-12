// Sends the door-to-door order confirmation email (Brevo template 1).
// Triggered by a database webhook on INSERT into public.orders where
// delivery_method = 'door-to-door'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendBrevoEmail, corsHeaders } from "../_shared/brevo.ts";

interface OrderRow {
  id: string;
  user_id: string;
  order_number: string;
  delivery_method: string;
  contact_email: string;
  delivery_address: Record<string, unknown> | null;
  repairs_subtotal_cents: number;
  courier_fee_cents: number;
  tax_cents: number;
  total_cents: number;
}

const fmt = (cents: number) =>
  `$${(cents / 100).toFixed(2)}`;

const formatAddress = (a: Record<string, unknown> | null) => {
  if (!a) return "";
  const parts = [a.street, a.street2, a.city, a.state, a.zip]
    .filter((p) => typeof p === "string" && p.length > 0);
  return parts.join(", ");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const order: OrderRow = body.record ?? body.order ?? body;
    if (!order?.id) throw new Error("Missing order record");
    if (order.delivery_method !== "door-to-door") {
      return new Response(JSON.stringify({ skipped: "not door-to-door" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch profile + items
    const [{ data: profile }, { data: items }] = await Promise.all([
      supabase.from("profiles").select("first_name, email").eq("user_id", order.user_id).maybeSingle(),
      supabase.from("order_items").select("pair_snapshot, service_snapshot, price_cents").eq("order_id", order.id),
    ]);

    const firstItem = items?.[0];
    const pairSnap = (firstItem?.pair_snapshot ?? {}) as Record<string, unknown>;
    const pairIdentifier = [pairSnap.brand, pairSnap.shoe_type].filter(Boolean).join(" ") || "Your pair";
    const serviceNames = (items ?? []).map((i) => {
      const s = (i.service_snapshot ?? {}) as Record<string, unknown>;
      return (s.name as string) ?? "Service";
    });

    const params = {
      first_name: profile?.first_name ?? "",
      order_number: order.order_number,
      pair_identifier: pairIdentifier,
      service_1: serviceNames[0] ?? "",
      service_2: serviceNames[1] ?? "",
      price: fmt(firstItem?.price_cents ?? 0),
      pickup_address: formatAddress(order.delivery_address),
      repairs_subtotal: fmt(order.repairs_subtotal_cents),
      courier_fee: fmt(order.courier_fee_cents),
      tax: fmt(order.tax_cents),
      order_total: fmt(order.total_cents),
    };

    const result = await sendBrevoEmail({
      templateId: 1,
      to: [{ email: order.contact_email, name: profile?.first_name }],
      params,
      tags: ["order-confirmation"],
    });

    return new Response(JSON.stringify({ ok: true, brevo: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-order-confirmation error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
