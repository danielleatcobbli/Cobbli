/**
 * Turns the raw rows from adminKpiData.ts into the series/values the KPIs
 * dashboard renders, for a given Period. Pure functions, no fetching --
 * kept separate from KpiDashboard.tsx so the math can be reasoned about
 * (and unit-tested) independent of rendering.
 */

import type { KpiBundle, KpiOrderRow } from "@/pages/admin/adminKpiData";
import { buildBuckets, bucketIndexFor, type Period, type Bucket } from "./periods";

function last<T>(arr: T[]): T {
  return arr[arr.length - 1];
}
function prevOf<T>(arr: T[]): T {
  return arr.length > 1 ? arr[arr.length - 2] : arr[arr.length - 1];
}

/** Revenue split matches the two lines actually itemized on every order
 * (repairs_subtotal_cents, courier_fee_cents). tax_cents is deliberately
 * excluded from "revenue" -- sales tax collected is a pass-through
 * liability, not income, so Total Revenue here is Services + Shipping,
 * same as the approved mockup (which predates tax being modeled at all). */
function servicesRevenueOf(o: KpiOrderRow): number {
  return o.repairs_subtotal_cents / 100;
}
function shippingRevenueOf(o: KpiOrderRow): number {
  return o.courier_fee_cents / 100;
}

export type SeriesResult = { labels: string[]; data: number[] };

/** Buckets a numeric value derived from orders (via `pick`) into the
 * buckets for `period`, summing within each bucket. */
function sumByBucket(orders: KpiOrderRow[], period: Period, pick: (o: KpiOrderRow) => number): SeriesResult {
  const buckets = buildBuckets(period);
  const data = new Array(buckets.length).fill(0);
  for (const o of orders) {
    const idx = bucketIndexFor(buckets, o.placed_at);
    if (idx >= 0) data[idx] += pick(o);
  }
  return { labels: buckets.map((b) => b.label), data };
}

/** Same as sumByBucket, but averages instead of summing (for rate-style
 * or per-order metrics where a straight sum would be meaningless). */
function avgByBucket(orders: KpiOrderRow[], period: Period, pick: (o: KpiOrderRow) => number): SeriesResult {
  const buckets = buildBuckets(period);
  const sums = new Array(buckets.length).fill(0);
  const counts = new Array(buckets.length).fill(0);
  for (const o of orders) {
    const idx = bucketIndexFor(buckets, o.placed_at);
    if (idx >= 0) {
      sums[idx] += pick(o);
      counts[idx] += 1;
    }
  }
  const data = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
  return { labels: buckets.map((b) => b.label), data };
}

export function buildVolumeSeries(bundle: KpiBundle, period: Period) {
  const buckets = buildBuckets(period);
  const orderCounts = new Array(buckets.length).fill(0);
  const shoeCounts = new Array(buckets.length).fill(0);

  const orderPlacedAt = new Map(bundle.orders.map((o) => [o.id, o.placed_at]));
  for (const o of bundle.orders) {
    const idx = bucketIndexFor(buckets, o.placed_at);
    if (idx >= 0) orderCounts[idx] += 1;
  }
  for (const p of bundle.orderPairs) {
    const placedAt = orderPlacedAt.get(p.order_id);
    if (!placedAt) continue;
    const idx = bucketIndexFor(buckets, placedAt);
    if (idx >= 0) shoeCounts[idx] += 1;
  }
  return { labels: buckets.map((b) => b.label), orders: orderCounts, shoes: shoeCounts };
}

export function buildRevenueSeries(bundle: KpiBundle, period: Period) {
  const svc = sumByBucket(bundle.orders, period, servicesRevenueOf);
  const ship = sumByBucket(bundle.orders, period, shippingRevenueOf);
  return { labels: svc.labels, servicesRevenue: svc.data, shippingRevenue: ship.data };
}

export function topLevelCards(bundle: KpiBundle, period: Period) {
  const rev = buildRevenueSeries(bundle, period);
  const svcCur = last(rev.servicesRevenue);
  const svcPrev = prevOf(rev.servicesRevenue);
  const shipCur = last(rev.shippingRevenue);
  const shipPrev = prevOf(rev.shippingRevenue);
  return {
    servicesRevenue: { current: svcCur, previous: svcPrev },
    shippingRevenue: { current: shipCur, previous: shipPrev },
    totalRevenue: { current: svcCur + shipCur, previous: svcPrev + shipPrev },
  };
}

/** Order Economics + Workshop stat-card rows share this shape: a headline
 * number for the selected period's latest bucket, plus a sparkline that
 * (per the approved mockup) always shows the trailing 12 months
 * regardless of what granularity is selected up top. */
export function economicsCard(bundle: KpiBundle, period: Period, pick: (o: KpiOrderRow) => number) {
  const headline = avgByBucket(bundle.orders, period, pick);
  const trend = avgByBucket(bundle.orders, "month", pick);
  return { value: last(headline.data), sparkline: trend.data };
}

export function pctWithShippingCard(bundle: KpiBundle, period: Period) {
  const buckets = buildBuckets(period);
  const withShip = new Array(buckets.length).fill(0);
  const total = new Array(buckets.length).fill(0);
  for (const o of bundle.orders) {
    const idx = bucketIndexFor(buckets, o.placed_at);
    if (idx < 0) continue;
    total[idx] += 1;
    if (o.courier_fee_cents > 0) withShip[idx] += 1;
  }
  const headline = total[total.length - 1] > 0 ? (withShip[withShip.length - 1] / total[total.length - 1]) * 100 : 0;

  const monthBuckets = buildBuckets("month");
  const mWithShip = new Array(monthBuckets.length).fill(0);
  const mTotal = new Array(monthBuckets.length).fill(0);
  for (const o of bundle.orders) {
    const idx = bucketIndexFor(monthBuckets, o.placed_at);
    if (idx < 0) continue;
    mTotal[idx] += 1;
    if (o.courier_fee_cents > 0) mWithShip[idx] += 1;
  }
  const sparkline = mTotal.map((t, i) => (t > 0 ? (mWithShip[i] / t) * 100 : 0));
  return { value: headline, sparkline };
}

export type ServiceRow = { name: string; quantity: number };

/** Orders by Service, for the selected period's full visible window (not
 * just the latest bucket) -- e.g. on "Month" this is the trailing 12
 * months combined, on "Day" the trailing 30 days combined, etc. Grouped
 * by the live services.name join, so a rename or a newly added service
 * shows up automatically with no code change (see adminKpiData.ts). */
export function buildServiceBreakdown(bundle: KpiBundle, period: Period): ServiceRow[] {
  const buckets = buildBuckets(period);
  const windowStart = buckets[0].start.getTime();
  const orderPlacedAt = new Map(bundle.orders.map((o) => [o.id, o.placed_at]));
  const counts = new Map<string, number>();

  for (const item of bundle.orderItems) {
    const placedAt = orderPlacedAt.get(item.order_id);
    if (!placedAt || new Date(placedAt).getTime() < windowStart) continue;
    counts.set(item.service_name, (counts.get(item.service_name) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
}

export type ZipRow = { zip: string; orders: number; pct: number };

export function buildZipBreakdown(bundle: KpiBundle, period: Period): ZipRow[] {
  const buckets = buildBuckets(period);
  const windowStart = buckets[0].start.getTime();
  const counts = new Map<string, number>();
  let total = 0;

  for (const o of bundle.orders) {
    if (new Date(o.placed_at).getTime() < windowStart) continue;
    const zip = o.delivery_address?.zip ?? "Unknown";
    counts.set(zip, (counts.get(zip) ?? 0) + 1);
    total += 1;
  }

  return Array.from(counts.entries())
    .map(([zip, orders]) => ({ zip, orders, pct: total > 0 ? (orders / total) * 100 : 0 }))
    .sort((a, b) => b.orders - a.orders);
}

/** Rework rates. reworks.created_at is the request timestamp; status is
 * read at fetch time (current state), not historical -- so "approved
 * rate" reflects requests from a bucket that have SINCE been approved,
 * not necessarily approved within that same bucket. Good enough for a
 * trend read at today's real order volumes; would need a status-history
 * table to make the timing itself period-accurate. */
export function reworkRateCards(bundle: KpiBundle, period: Period) {
  function ratesFor(p: Period) {
    const buckets = buildBuckets(p);
    const orderCounts = new Array(buckets.length).fill(0);
    const requested = new Array(buckets.length).fill(0);
    const approved = new Array(buckets.length).fill(0);
    for (const o of bundle.orders) {
      const idx = bucketIndexFor(buckets, o.placed_at);
      if (idx >= 0) orderCounts[idx] += 1;
    }
    for (const r of bundle.reworks) {
      const idx = bucketIndexFor(buckets, r.created_at);
      if (idx < 0) continue;
      requested[idx] += 1;
      if (r.status === "approved") approved[idx] += 1;
    }
    const requestedRate = requested.map((r, i) => (orderCounts[i] > 0 ? (r / orderCounts[i]) * 100 : 0));
    const approvedRate = approved.map((a, i) => (orderCounts[i] > 0 ? (a / orderCounts[i]) * 100 : 0));
    return { requestedRate, approvedRate };
  }
  const headline = ratesFor(period);
  const trend = ratesFor("month");
  return {
    requested: { value: last(headline.requestedRate), sparkline: trend.requestedRate },
    approved: { value: last(headline.approvedRate), sparkline: trend.approvedRate },
  };
}

/** Customer Health -- deliberately NEVER period-filtered. These describe
 * the whole customer relationship to date, computed over every order
 * regardless of the Day/Week/Month/Quarter/Year filter above (per
 * Danielle's explicit call during mockup review). */
export function customerHealthAllTime(bundle: KpiBundle) {
  const byCustomer = new Map<string, number>();
  let totalRevenue = 0;
  for (const o of bundle.orders) {
    byCustomer.set(o.user_id, (byCustomer.get(o.user_id) ?? 0) + 1);
    totalRevenue += servicesRevenueOf(o) + shippingRevenueOf(o);
  }
  const uniqueCustomers = byCustomer.size;
  const repeatCustomers = Array.from(byCustomer.values()).filter((c) => c > 1).length;
  const repeatPurchaseRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;
  const ltv = uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0;

  // Cumulative-to-date trend (trailing 12 months) for the sparklines --
  // at each month-end, snapshot cumulative unique customers, cumulative
  // revenue, and repeat-purchase rate using only orders placed by that
  // point, so the trend line reflects how the relationship has actually
  // built up over time rather than a flat "today's value" repeated.
  const buckets = buildBuckets("month");
  const cumCustomers: number[] = [];
  const cumRevenue: number[] = [];
  const cumRepeatRate: number[] = [];
  const runningByCustomer = new Map<string, number>();
  let runningRev = 0;
  const ordersByTime = [...bundle.orders].sort(
    (a, b) => new Date(a.placed_at).getTime() - new Date(b.placed_at).getTime(),
  );
  let cursor = 0;
  for (const bucket of buckets) {
    while (cursor < ordersByTime.length && new Date(ordersByTime[cursor].placed_at).getTime() < bucket.end.getTime()) {
      const o = ordersByTime[cursor];
      runningByCustomer.set(o.user_id, (runningByCustomer.get(o.user_id) ?? 0) + 1);
      runningRev += servicesRevenueOf(o) + shippingRevenueOf(o);
      cursor += 1;
    }
    const custSoFar = runningByCustomer.size;
    const repeatSoFar = Array.from(runningByCustomer.values()).filter((c) => c > 1).length;
    cumCustomers.push(custSoFar);
    cumRevenue.push(runningRev);
    cumRepeatRate.push(custSoFar > 0 ? (repeatSoFar / custSoFar) * 100 : 0);
  }
  const ltvTrend = cumCustomers.map((c, i) => (c > 0 ? cumRevenue[i] / c : 0));

  return {
    uniqueCustomers: { value: uniqueCustomers, sparkline: cumCustomers },
    repeatPurchaseRate: { value: repeatPurchaseRate, sparkline: cumRepeatRate },
    ltv: { value: ltv, sparkline: ltvTrend },
  };
}

export type { Bucket };
