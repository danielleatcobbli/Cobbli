/**
 * Shared period-bucketing engine for the admin KPIs dashboard.
 *
 * Mirrors the granularity design agreed on with Danielle during the mockup
 * review: the Day / Week / Month / Quarter / Year filter changes bucket
 * size for everything EXCEPT the all-time Customer Health cards, which are
 * intentionally never bucketed (see adminKpiData.ts).
 *
 *   Day     -> last 30 days, one bucket per day
 *   Week    -> last 12 weeks, one bucket per week (Mon-Sun)
 *   Month   -> last 12 months, one bucket per month
 *   Quarter -> last 4 quarters, one bucket per quarter
 *   Year    -> last 3 years, one bucket per year
 *
 * Real order volume is tiny right now (this is a brand-new system), so
 * bucketing is done client-side over a full fetch of the relevant tables
 * rather than pushed into SQL date_trunc/group-by queries. That keeps the
 * data-fetching layer simple (see adminKpiData.ts) and matches the
 * "fetch raw rows, map in JS" convention already used in adminData.ts. If
 * order volume grows enough that this becomes a real payload-size concern,
 * this is the layer to swap for server-side aggregation -- the bucket
 * boundaries computed here would carry over directly to a SQL version.
 */

import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subWeeks,
  subMonths,
  subQuarters,
  subYears,
  format,
} from "date-fns";

export type Period = "day" | "week" | "month" | "quarter" | "year";

export const PERIOD_LABELS: Record<Period, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

export const PERIOD_INFO: Record<Period, { label: string; prevLabel: string }> = {
  day: { label: "Today", prevLabel: "vs. yesterday" },
  week: { label: "This Week", prevLabel: "vs. last week" },
  month: { label: "This Month", prevLabel: "vs. last month" },
  quarter: { label: "This Quarter", prevLabel: "vs. last quarter" },
  year: { label: "This Year", prevLabel: "vs. last year" },
};

export type Bucket = { start: Date; end: Date; label: string };

const BUCKET_COUNT: Record<Period, number> = { day: 30, week: 12, month: 12, quarter: 4, year: 3 };

/** Returns the N buckets for a period, oldest first, ending with the
 * bucket containing `now`. Each bucket is a half-open [start, end) range. */
export function buildBuckets(period: Period, now: Date = new Date()): Bucket[] {
  const n = BUCKET_COUNT[period];
  const buckets: Bucket[] = [];

  for (let i = n - 1; i >= 0; i--) {
    let start: Date;
    let end: Date;
    let label: string;

    switch (period) {
      case "day": {
        start = startOfDay(subDays(now, i));
        end = startOfDay(subDays(now, i - 1));
        label = format(start, "MMM d");
        break;
      }
      case "week": {
        start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
        end = startOfWeek(subWeeks(now, i - 1), { weekStartsOn: 1 });
        label = "Wk of " + format(start, "MMM d");
        break;
      }
      case "month": {
        start = startOfMonth(subMonths(now, i));
        end = startOfMonth(subMonths(now, i - 1));
        label = format(start, "MMM ''yy");
        break;
      }
      case "quarter": {
        start = startOfQuarter(subQuarters(now, i));
        end = startOfQuarter(subQuarters(now, i - 1));
        label = "Q" + (Math.floor(start.getMonth() / 3) + 1) + " '" + format(start, "yy");
        break;
      }
      case "year": {
        start = startOfYear(subYears(now, i));
        end = startOfYear(subYears(now, i - 1));
        label = format(start, "yyyy");
        break;
      }
    }
    buckets.push({ start, end, label });
  }
  return buckets;
}

/** Assigns each ISO timestamp to a bucket index (or -1 if outside all
 * buckets), for whatever list of buckets buildBuckets() produced. */
export function bucketIndexFor(buckets: Bucket[], iso: string): number {
  const t = new Date(iso).getTime();
  for (let i = 0; i < buckets.length; i++) {
    if (t >= buckets[i].start.getTime() && t < buckets[i].end.getTime()) return i;
  }
  return -1;
}

export function pctChange(cur: number, prev: number): number {
  if (!prev) return 0;
  return ((cur - prev) / prev) * 100;
}

export const fmt = {
  money: (n: number) => "$" + Math.round(n).toLocaleString("en-US"),
  moneyD: (n: number) => "$" + n.toFixed(2),
  pct: (n: number) => n.toFixed(1) + "%",
  num: (n: number) => Math.round(n).toLocaleString("en-US"),
  days: (n: number) => n.toFixed(1) + " days",
};
