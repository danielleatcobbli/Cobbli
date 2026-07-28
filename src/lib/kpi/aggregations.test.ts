import { describe, it, expect } from "vitest";
import { subDays, subMonths } from "date-fns";
import type { KpiBundle } from "@/pages/admin/adminKpiData";
import {
  buildVolumeSeries,
  buildRevenueSeries,
  topLevelCards,
  buildServiceBreakdown,
  buildZipBreakdown,
  reworkRateCards,
  customerHealthAllTime,
} from "./aggregations";

function order(overrides: Partial<KpiBundle["orders"][number]> = {}): KpiBundle["orders"][number] {
  return {
    id: crypto.randomUUID(),
    user_id: "user-1",
    placed_at: new Date().toISOString(),
    status: "completed",
    delivery_address: { zip: "10001" },
    repairs_subtotal_cents: 10000,
    courier_fee_cents: 1000,
    tax_cents: 0,
    total_cents: 11000,
    ...overrides,
  };
}

describe("buildVolumeSeries / buildRevenueSeries", () => {
  it("buckets orders and revenue into the current month for a fresh order", () => {
    const bundle: KpiBundle = {
      orders: [order()],
      orderItems: [],
      orderPairs: [],
      reworks: [],
    };
    const volume = buildVolumeSeries(bundle, "month");
    expect(volume.orders[volume.orders.length - 1]).toBe(1);

    const revenue = buildRevenueSeries(bundle, "month");
    expect(revenue.servicesRevenue[revenue.servicesRevenue.length - 1]).toBeCloseTo(100);
    expect(revenue.shippingRevenue[revenue.shippingRevenue.length - 1]).toBeCloseTo(10);
  });

  it("counts an order pair as one shoe against its parent order's bucket", () => {
    const o = order();
    const bundle: KpiBundle = {
      orders: [o],
      orderItems: [],
      orderPairs: [{ id: "p1", order_id: o.id }, { id: "p2", order_id: o.id }],
      reworks: [],
    };
    const volume = buildVolumeSeries(bundle, "month");
    expect(volume.shoes[volume.shoes.length - 1]).toBe(2);
  });

  it("excludes orders outside the visible window", () => {
    const old = order({ placed_at: subMonths(new Date(), 20).toISOString() });
    const bundle: KpiBundle = { orders: [old], orderItems: [], orderPairs: [], reworks: [] };
    const volume = buildVolumeSeries(bundle, "month");
    expect(volume.orders.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("topLevelCards", () => {
  it("computes services + shipping revenue for the latest bucket, excluding tax", () => {
    const bundle: KpiBundle = {
      orders: [order({ repairs_subtotal_cents: 20000, courier_fee_cents: 500, tax_cents: 9999 })],
      orderItems: [],
      orderPairs: [],
      reworks: [],
    };
    const cards = topLevelCards(bundle, "month");
    expect(cards.servicesRevenue.current).toBeCloseTo(200);
    expect(cards.shippingRevenue.current).toBeCloseTo(5);
    expect(cards.totalRevenue.current).toBeCloseTo(205);
  });
});

describe("buildServiceBreakdown", () => {
  it("groups order items by live service name, not a hardcoded list", () => {
    const o = order();
    const bundle: KpiBundle = {
      orders: [o],
      orderItems: [
        { id: "i1", order_id: o.id, price_cents: 5000, created_at: o.placed_at, service_id: "s1", service_name: "Full Resole" },
        { id: "i2", order_id: o.id, price_cents: 3000, created_at: o.placed_at, service_id: "s2", service_name: "Deep Cleaning" },
        { id: "i3", order_id: o.id, price_cents: 3000, created_at: o.placed_at, service_id: "s1", service_name: "Full Resole" },
      ],
      orderPairs: [],
      reworks: [],
    };
    const breakdown = buildServiceBreakdown(bundle, "month");
    expect(breakdown[0]).toEqual({ name: "Full Resole", quantity: 2 });
    expect(breakdown[1]).toEqual({ name: "Deep Cleaning", quantity: 1 });
  });

  it("reflects a renamed service automatically (no hardcoded names)", () => {
    const o = order();
    const bundle: KpiBundle = {
      orders: [o],
      orderItems: [{ id: "i1", order_id: o.id, price_cents: 5000, created_at: o.placed_at, service_id: "s1", service_name: "Premium Resole" }],
      orderPairs: [],
      reworks: [],
    };
    const breakdown = buildServiceBreakdown(bundle, "month");
    expect(breakdown[0].name).toBe("Premium Resole");
  });
});

describe("buildZipBreakdown", () => {
  it("groups orders by delivery zip and computes percentages", () => {
    const bundle: KpiBundle = {
      orders: [
        order({ delivery_address: { zip: "10001" } }),
        order({ delivery_address: { zip: "10001" } }),
        order({ delivery_address: { zip: "90210" } }),
      ],
      orderItems: [],
      orderPairs: [],
      reworks: [],
    };
    const zips=buildZipBreakdown(bundle, "month");
    expect(zips[0].zip).toBe("10001");
    expect(zips[0].orders).toBe(2);
    expect(zips[0].pct).toBeCloseTo((2 / 3) * 100, 5);
  });
});

describe("reworkRateCards", () => {
  it("computes requested and approved rates against total orders in the bucket", () => {
    const o1 = order();
    const o2 = order();
    const bundle: KpiBundle = {
      orders: [o1, o2],
      orderItems: [],
      orderPairs: [],
      reworks: [
        { id: "r1", order_id: o1.id, status: "approved", created_at: o1.placed_at },
        { id: "r2", order_id: o2.id, status: "pending", created_at: o2.placed_at },
      ],
    };
    const rates = reworkRateCards(bundle, "month");
    expect(rates.requested.value).toBeCloseTo(100); // 2 requests / 2 orders
    expect(rates.approved.value).toBeCloseTo(50); // 1 approved / 2 orders
  });
});

describe("customerHealthAllTime", () => {
  it("computes unique customers, repeat rate, and LTV ignoring the period filter", () => {
    const bundle: KpiBundle = {
      orders: [
        order({ user_id: "a", repairs_subtotal_cents: 10000, courier_fee_cents: 0 }),
        order({ user_id: "a", repairs_subtotal_cents: 10000, courier_fee_cents: 0 }),
        order({ user_id: "b", repairs_subtotal_cents: 20000, courier_fee_cents: 0 }),
      ],
      orderItems: [],
      orderPairs: [],
      reworks: [],
    };
    const health = customerHealthAllTime(bundle);
    expect(health.uniqueCustomers.value).toBe(2);
    expect(health.repeatPurchaseRate.value).toBeCloseTo(50); // 1 of 2 customers has >1 order
    expect(health.ltv.value).toBeCloseTo(400 / 2); // $400 total / 2 customers = $200
  });

  it("returns zeros without dividing by zero when there are no orders", () => {
    const bundle: KpiBundle = { orders: [], orderItems: [], orderPairs: [], reworks: [] };
    const health = customerHealthAllTime(bundle);
    expect(health.uniqueCustomers.value).toBe(0);
    expect(health.repeatPurchaseRate.value).toBe(0);
    expect(health.ltv.value).toBe(0);
  });
});
