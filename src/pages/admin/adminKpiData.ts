/**
 * adminKpiData
 *
 * Real Supabase reads backing the admin KPIs dashboard (AdminReports.tsx /
 * KpiDashboard.tsx). Follows the same "fetch raw rows, map/aggregate in
 * JS" convention as adminData.ts -- real order volume is tiny right now
 * (this is a brand-new system), so there's no need for server-side
 * date_trunc aggregation yet. See src/lib/kpi/periods.ts for where that
 * would plug in if volume grows enough to matter.
 *
 * Data-integrity note: every field read here comes straight from a real
 * table. Nothing in this file or in KpiDashboard.tsx fabricates a number
 * for a metric the schema can't actually support -- see the "not yet
 * trackable" list in KpiDashboard.tsx for the handful of KPIs from the
 * approved mockup that ship as labeled placeholders instead, and why.
 *
 * Real-time service names: order_items.service_id is a live FK into
 * services (added via the add_service_id_to_order_items migration). The
 * select below joins through it, so renaming a service or adding a new one
 * in the services table is reflected on the next fetch with no code
 * change here -- nothing in this file hardcodes a service name.
 */

import { supabase } from "@/integrations/supabase/client";

export type KpiOrderRow = {
  id: string;
  user_id: string;
  placed_at: string;
  status: string;
  delivery_address: { zip?: string } | null;
  repairs_subtotal_cents: number;
  courier_fee_cents: number;
  tax_cents: number;
  total_cents: number;
};

export async function fetchKpiOrders(): Promise<KpiOrderRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, user_id, placed_at, status, delivery_address, repairs_subtotal_cents, courier_fee_cents, tax_cents, total_cents",
    )
    .order("placed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as KpiOrderRow[];
}

export type KpiOrderItemRow = {
  id: string;
  order_id: string;
  price_cents: number;
  created_at: string;
  service_id: string | null;
  service_name: string;
};

type OrderItemJoinRow = {
  id: string;
  order_id: string;
  price_cents: number;
  created_at: string;
  service_id: string | null;
  service_snapshot: { name?: string } | null;
  services: { name: string } | null;
};

export async function fetchKpiOrderItems(): Promise<KpiOrderItemRow[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("id, order_id, price_cents, created_at, service_id, service_snapshot, services(name)");
  if (error) throw error;
  const rows = (data ?? []) as unknown as OrderItemJoinRow[];
  return rows.map((r) => ({
    id: r.id,
    order_id: r.order_id,
    price_cents: r.price_cents,
    created_at: r.created_at,
    service_id: r.service_id,
    // Prefer the live services.name join (real-time catalog); fall back to
    // the frozen snapshot only for the rare item with no service_id match.
    service_name: r.services?.name ?? r.service_snapshot?.name ?? "Unknown Service",
  }));
}

export type KpiOrderPairRow = { id: string; order_id: string };

export async function fetchKpiOrderPairs(): Promise<KpiOrderPairRow[]> {
  const { data, error } = await supabase.from("order_pairs").select("id, order_id");
  if (error) throw error;
  return (data ?? []) as KpiOrderPairRow[];
}

export type KpiReworkRow = { id: string; order_id: string; status: string; created_at: string };

/** reworks.status is written by the approve_rework / deny_rework RPCs as
 * 'approved' / 'denied'; anything else (the default pending state) counts
 * toward "requested" but not "approved". Free-text column, same
 * deliberate reasoning as orders.status in adminData.ts -- don't crash on
 * an unrecognized value, just don't count it as approved. */
export async function fetchKpiReworks(): Promise<KpiReworkRow[]> {
  const { data, error } = await supabase.from("reworks").select("id, order_id, status, created_at");
  if (error) throw error;
  return (data ?? []) as KpiReworkRow[];
}

export type KpiBundle = {
  orders: KpiOrderRow[];
  orderItems: KpiOrderItemRow[];
  orderPairs: KpiOrderPairRow[];
  reworks: KpiReworkRow[];
};

export async function fetchKpiBundle(): Promise<KpiBundle> {
  const [orders, orderItems, orderPairs, reworks] = await Promise.all([
    fetchKpiOrders(),
    fetchKpiOrderItems(),
    fetchKpiOrderPairs(),
    fetchKpiReworks(),
  ]);
  return { orders, orderItems, orderPairs, reworks };
}
