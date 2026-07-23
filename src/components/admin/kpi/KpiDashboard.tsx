import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { fetchKpiBundle, type KpiBundle } from "@/pages/admin/adminKpiData";
import { buildBuckets, PERIOD_INFO, PERIOD_LABELS, pctChange, fmt, type Period } from "@/lib/kpi/periods";
import {
  buildVolumeSeries,
  buildRevenueSeries,
  topLevelCards,
  economicsCard,
  pctWithShippingCard,
  buildServiceBreakdown,
  buildZipBreakdown,
  reworkRateCards,
  customerHealthAllTime,
} from "@/lib/kpi/aggregations";
import { downloadSheets } from "@/lib/kpi/exportXlsx";
import StatCard from "./StatCard";
import PlaceholderMetric from "./PlaceholderMetric";

const ON_TIME_BENCHMARK = 98;
const COLORS = {
  services: "#3d7bfd",
  shipping: "#22b8a0",
  shoes: "#22b8a0",
  amber: "#e0a13c",
  purple: "#8a5cf6",
  red: "#e0473c",
};
const CHANNEL_COLORS = ["#3d7bfd", "#22b8a0", "#e0a13c"];

function SectionHeader({ title, description, badge }: { title: string; description?: string; badge?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {badge && (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[9px] px-1.5 py-0">{badge}</Badge>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{description}</p>}
    </div>
  );
}

function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="whitespace-nowrap">
      Export to Excel
    </Button>
  );
}

function ChartBox({ height = 280, children }: { height?: number; children: React.ReactElement }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const KpiDashboard = () => {
  const [period, setPeriod] = useState<Period>("month");
  const { data: bundle, isLoading, error } = useQuery({
    queryKey: ["admin-kpis", "bundle"],
    queryFn: fetchKpiBundle,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Couldn't load KPI data",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  }, [error]);

  const empty: KpiBundle = { orders: [], orderItems: [], orderPairs: [], reworks: [] };
  const data = bundle ?? empty;

  const info = PERIOD_INFO[period];
  const top = useMemo(() => topLevelCards(data, period), [data, period]);
  const volume = useMemo(() => buildVolumeSeries(data, period), [data, period]);
  const revenue = useMemo(() => buildRevenueSeries(data, period), [data, period]);
  const services = useMemo(() => buildServiceBreakdown(data, period), [data, period]);
  const zips = useMemo(() => buildZipBreakdown(data, period), [data, period]);
  const rework = useMemo(() => reworkRateCards(data, period), [data, period]);
  const customerHealth = useMemo(() => customerHealthAllTime(data), [data]);

  const aov = useMemo(
    () => economicsCard(data, period, (o) => (o.repairs_subtotal_cents + o.courier_fee_cents) / 100),
    [data, period],
  );
  const avgShipCost = useMemo(
    () => economicsCard(data, period, (o) => o.courier_fee_cents / 100),
    [data, period],
  );
  const pctShipping = useMemo(() => pctWithShippingCard(data, period), [data, period]);

  const avgServicesPerOrder = useMemo(() => {
    const buckets = buildBuckets(period);
    const orderIds = new Set(data.orders.map((o) => o.id));
    const counts = new Map<string, number>();
    for (const item of data.orderItems) {
      if (!orderIds.has(item.order_id)) continue;
      counts.set(item.order_id, (counts.get(item.order_id) ?? 0) + 1);
    }
    const cur = data.orders.filter((o) => {
      const idx = buckets.findIndex((b) => new Date(o.placed_at) >= b.start && new Date(o.placed_at) < b.end);
      return idx === buckets.length - 1;
    });
    const curAvg = cur.length > 0 ? cur.reduce((s, o) => s + (counts.get(o.id) ?? 0), 0) / cur.length : 0;

    const monthBuckets = buildBuckets("month");
    const sparkline = monthBuckets.map((b) => {
      const inBucket = data.orders.filter((o) => new Date(o.placed_at) >= b.start && new Date(o.placed_at) < b.end);
      return inBucket.length > 0 ? inBucket.reduce((s, o) => s + (counts.get(o.id) ?? 0), 0) / inBucket.length : 0;
    });
    return { value: curAvg, sparkline };
  }, [data, period]);

  const avgShoesPerOrder = useMemo(() => {
    const orderIds = new Set(data.orders.map((o) => o.id));
    const counts = new Map<string, number>();
    for (const p of data.orderPairs) {
      if (!orderIds.has(p.order_id)) continue;
      counts.set(p.order_id, (counts.get(p.order_id) ?? 0) + 1);
    }
    const buckets = buildBuckets(period);
    const cur = data.orders.filter((o) => {
      const idx = buckets.findIndex((b) => new Date(o.placed_at) >= b.start && new Date(o.placed_at) < b.end);
      return idx === buckets.length - 1;
    });
    const curAvg = cur.length > 0 ? cur.reduce((s, o) => s + (counts.get(o.id) ?? 0), 0) / cur.length : 0;

    const monthBuckets = buildBuckets("month");
    const sparkline = monthBuckets.map((b) => {
      const inBucket = data.orders.filter((o) => new Date(o.placed_at) >= b.start && new Date(o.placed_at) < b.end);
      return inBucket.length > 0 ? inBucket.reduce((s, o) => s + (counts.get(o.id) ?? 0), 0) / inBucket.length : 0;
    });
    return { value: curAvg, sparkline };
  }, [data, period]);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-12 text-center">Loading KPIs…</div>;
  }

  const volumeChartData = volume.labels.map((label, i) => ({
    label,
    "Orders Submitted": volume.orders[i],
    "Shoes Submitted": volume.shoes[i],
  }));
  const revenueChartData = revenue.labels.map((label, i) => ({
    label,
    "Services Revenue": Math.round(revenue.servicesRevenue[i]),
    "Shipping Revenue": Math.round(revenue.shippingRevenue[i]),
  }));
  const serviceChartData = services.map((s) => ({ name: s.name, Quantity: s.quantity })).slice(0, 20);
  const zipChartData = zips.slice(0, 15).map((z) => ({ zip: z.zip, Orders: z.orders }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">KPIs</h1>
          <p className="text-sm text-muted-foreground">Order tracking metrics, live from Supabase.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as Period)}>
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <ToggleGroupItem key={p} value={p} className="text-xs px-3">
                {PERIOD_LABELS[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button
            size="sm"
            onClick={() =>
              downloadSheets("kpi_dashboard_all_data.xlsx", [
                {
                  name: "Revenue Trend",
                  rows: revenue.labels.map((p, i) => ({
                    Period: p,
                    "Services Revenue": Math.round(revenue.servicesRevenue[i]),
                    "Shipping Revenue": Math.round(revenue.shippingRevenue[i]),
                    "Total Revenue": Math.round(revenue.servicesRevenue[i] + revenue.shippingRevenue[i]),
                  })),
                },
                {
                  name: "Order Volume",
                  rows: volume.labels.map((p, i) => ({
                    Period: p,
                    "Orders Submitted": volume.orders[i],
                    "Shoes Submitted": volume.shoes[i],
                  })),
                },
                { name: "Services", rows: services.map((s) => ({ Service: s.name, "Quantity Ordered": s.quantity })) },
                {
                  name: "Orders by Zip",
                  rows: zips.map((z) => ({ Zip: z.zip, Orders: z.orders, "% of Total": z.pct.toFixed(1) })),
                },
                {
                  name: "Customer Health (All-Time)",
                  rows: [
                    {
                      "Unique Customers (All-Time)": customerHealth.uniqueCustomers.value,
                      "Repeat Purchase Rate % (All-Time)": customerHealth.repeatPurchaseRate.value.toFixed(1),
                      "Lifetime Value $ (All-Time)": customerHealth.ltv.value.toFixed(2),
                    },
                  ],
                },
                {
                  name: "Rework Rates",
                  rows: [
                    { Metric: "Rework Requested Rate %", Value: rework.requested.value.toFixed(1) },
                    { Metric: "Rework Approved Rate %", Value: rework.approved.value.toFixed(1) },
                  ],
                },
              ])
            }
          >
            Export All Data (.xlsx)
          </Button>
        </div>
      </div>

      {/* TOP LEVEL */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { lbl: `Service Revenue (${info.label})`, val: top.servicesRevenue },
          { lbl: `Shipping Revenue (${info.label})`, val: top.shippingRevenue },
          { lbl: `Total Revenue (${info.label})`, val: top.totalRevenue },
        ].map((c) => {
          const delta = pctChange(c.val.current, c.val.previous);
          const up = delta >= 0;
          return (
            <Card key={c.lbl}>
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.lbl}</div>
                <div className="text-2xl font-bold text-foreground mt-1.5 mb-1">{fmt.money(c.val.current)}</div>
                <div className={`text-xs font-semibold ${up ? "text-emerald-600" : "text-red-600"}`}>
                  {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}% {info.prevLabel}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* CUSTOMER HEALTH — ALL-TIME */}
      <Card>
        <CardHeader>
          <SectionHeader
            title="Customer Health"
            badge="ALL-TIME"
            description="These don't respond to the filter above on purpose — lifetime-style metrics describe the whole customer relationship to date, not a period snapshot."
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <StatCard
              allTime
              label="Order Conversion Rate"
              sublabel="(all-time orders ÷ all-time visitors)"
              value="—"
            />
            <StatCard
              allTime
              label="Repeat Purchase Rate"
              sublabel="(customers with >1 order, to date)"
              value={fmt.pct(customerHealth.repeatPurchaseRate.value)}
              sparkline={customerHealth.repeatPurchaseRate.sparkline}
              color={COLORS.services}
            />
            <StatCard
              allTime
              label="Lifetime Value (LTV)"
              sublabel="(all-time revenue ÷ unique customers)"
              value={fmt.money(customerHealth.ltv.value)}
              sparkline={customerHealth.ltv.sparkline}
              color={COLORS.purple}
            />
            <StatCard
              allTime
              label="Unique Customers"
              sublabel="(distinct customers, to date)"
              value={fmt.num(customerHealth.uniqueCustomers.value)}
              sparkline={customerHealth.uniqueCustomers.sparkline}
              color={COLORS.amber}
            />
          </div>
          <div className="mt-3">
            <PlaceholderMetric reason="Order Conversion Rate needs visitor/traffic data, which isn't captured anywhere in this app yet (no analytics tool is wired up). Once one is, this card can compute all-time orders ÷ all-time visitors the same way the other three do." />
          </div>
        </CardContent>
      </Card>

      {/* REVENUE TRENDS */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <SectionHeader
            title="Revenue Trends"
            description="Stacked bar so the total bar height reads as combined revenue while still showing the services vs. shipping split. Granularity follows the filter above."
          />
          <ExportButton
            onClick={() =>
              downloadSheets("revenue_trend.xlsx", [
                {
                  name: "Revenue Trend",
                  rows: revenue.labels.map((p, i) => ({
                    Period: p,
                    "Services Revenue": Math.round(revenue.servicesRevenue[i]),
                    "Shipping Revenue": Math.round(revenue.shippingRevenue[i]),
                    "Total Revenue": Math.round(revenue.servicesRevenue[i] + revenue.shippingRevenue[i]),
                  })),
                },
              ])
            }
          />
        </CardHeader>
        <CardContent>
          <ChartBox>
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => "$" + v.toLocaleString()} />
              <Tooltip formatter={(v: number) => "$" + v.toLocaleString()} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Services Revenue" stackId="rev" fill={COLORS.services} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Shipping Revenue" stackId="rev" fill={COLORS.shipping} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </CardContent>
      </Card>

      {/* ORDER TRENDS */}
      <Card>
        <CardHeader>
          <SectionHeader
            title="Order Trends"
            description="Order volume responds to the filter above; order-value stats are grouped separately since they mix currency, counts, and percentages."
          />
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <div className="flex items-start justify-between gap-3 mb-2 pt-1">
              <div>
                <h3 className="text-sm font-bold text-foreground">Order & Shoe Volumes</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  Grouped bars so the two series stay independently readable at different scales.
                </p>
              </div>
              <ExportButton
                onClick={() =>
                  downloadSheets("order_volume_trend.xlsx", [
                    {
                      name: "Orders & Shoes Submitted",
                      rows: volume.labels.map((p, i) => ({
                        Period: p,
                        "Orders Submitted": volume.orders[i],
                        "Shoes Submitted": volume.shoes[i],
                      })),
                    },
                  ])
                }
              />
            </div>
            <ChartBox>
              <BarChart data={volumeChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Orders Submitted" fill={COLORS.services} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Shoes Submitted" fill={COLORS.shoes} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartBox>
          </div>

          <div className="border-t border-dashed pt-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Order Economics</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  The number above each trend is your current filter selection; the sparkline is always the trailing
                  12 months.
                </p>
              </div>
              <ExportButton
                onClick={() =>
                  downloadSheets("order_economics.xlsx", [
                    {
                      name: "Order Economics",
                      rows: [
                        { Metric: "Average Order Value", Value: fmt.moneyD(aov.value) },
                        { Metric: "Avg. Services / Order", Value: avgServicesPerOrder.value.toFixed(2) },
                        { Metric: "Avg. Shoes / Order", Value: avgShoesPerOrder.value.toFixed(2) },
                        { Metric: "Avg. Shipping Cost / Order", Value: fmt.moneyD(avgShipCost.value) },
                        { Metric: "% Orders w/ Shipping", Value: fmt.pct(pctShipping.value) },
                      ],
                    },
                  ])
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              <StatCard label="Average Order Value" value={fmt.moneyD(aov.value)} sparkline={aov.sparkline} color={COLORS.services} />
              <StatCard
                label="Avg. Services / Order"
                value={avgServicesPerOrder.value.toFixed(2)}
                sparkline={avgServicesPerOrder.sparkline}
                color={COLORS.shipping}
              />
              <StatCard
                label="Avg. Shoes / Order"
                value={avgShoesPerOrder.value.toFixed(2)}
                sparkline={avgShoesPerOrder.sparkline}
                color={COLORS.amber}
              />
              <StatCard
                label="Avg. Shipping Cost / Order"
                value={fmt.moneyD(avgShipCost.value)}
                sparkline={avgShipCost.sparkline}
                color={COLORS.purple}
              />
              <StatCard
                label="% Orders w/ Shipping"
                value={fmt.pct(pctShipping.value)}
                sparkline={pctShipping.sparkline}
                color={COLORS.red}
              />
            </div>
          </div>

          <div className="border-t border-dashed pt-6">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">Orders by Service</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  Sorted high to low, for the selected period. Pulled live from the services catalog, so a renamed
                  or newly added service shows up automatically.
                </p>
              </div>
              <ExportButton
                onClick={() =>
                  downloadSheets("service_quantity.xlsx", [
                    { name: "Service Quantity", rows: services.map((s) => ({ Service: s.name, "Quantity Ordered": s.quantity })) },
                  ])
                }
              />
            </div>
            <ChartBox height={Math.max(220, serviceChartData.length * 32)}>
              <BarChart data={serviceChartData} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                <Tooltip />
                <Bar dataKey="Quantity" fill={COLORS.services} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartBox>
          </div>

          <div className="border-t border-dashed pt-6">
            <div className="mb-2">
              <h3 className="text-sm font-bold text-foreground">Order Intake Channel</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                % of orders by how the customer started them — Photo Submission, Guided Form, or Service Card.
              </p>
            </div>
            <PlaceholderMetric reason="Not tracked anywhere yet — see the separate order-intake-channel requirements doc for what it'd take to start capturing it." />
          </div>

          <div className="border-t border-dashed pt-6">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">Orders by Zip Code</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  Unlike Customer Health above, this evolves with the filter — useful for spotting where recent
                  demand is coming from. Top 15 shown in chart; full list in the export.
                </p>
              </div>
              <ExportButton
                onClick={() =>
                  downloadSheets("orders_by_zip.xlsx", [
                    { name: "Orders by Zip", rows: zips.map((z) => ({ Zip: z.zip, Orders: z.orders, "% of Total": z.pct.toFixed(1) })) },
                  ])
                }
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
              <ChartBox>
                <BarChart data={zipChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="zip" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Orders" fill={COLORS.services} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartBox>
              <div className="max-h-[290px] overflow-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/60">
                    <tr>
                      <th className="text-left font-semibold text-muted-foreground p-2">Zip</th>
                      <th className="text-left font-semibold text-muted-foreground p-2">Orders</th>
                      <th className="text-left font-semibold text-muted-foreground p-2">% of total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zips.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-3 text-muted-foreground text-center">
                          No orders in this period yet.
                        </td>
                      </tr>
                    )}
                    {zips.map((z) => (
                      <tr key={z.zip} className="border-t">
                        <td className="p-2">{z.zip}</td>
                        <td className="p-2">{z.orders}</td>
                        <td className="p-2">{z.pct.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WORKSHOP & DISPATCH METRICS */}
      <Card>
        <CardHeader>
          <SectionHeader title="Workshop & Dispatch Metrics" description="Granularity follows the filter above." />
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <div className="mb-2">
              <h3 className="text-sm font-bold text-foreground">On-Time Completion Rate</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                % of orders completed within their quoted turnaround window. Target benchmark: {ON_TIME_BENCHMARK}%
                — industry-leading, on purpose.
              </p>
            </div>
            <PlaceholderMetric reason={`Not computable yet: the schema tracks a current order status but not a history of when each status changed, so "arrival" and "completion" timestamps can't be derived accurately. Needs an order-status-history table (or per-status timestamp columns) before this can show a real number against the ${ON_TIME_BENCHMARK}% target.`} />
          </div>

          <div className="border-t border-dashed pt-6">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">Rework, Fulfillment & Response Time</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                  Rework rates come straight from the reworks table (request + approve/deny are native order
                  actions, not a manual log). Fulfillment and reply times need timestamps the schema doesn't have
                  yet — see below.
                </p>
              </div>
              <ExportButton
                onClick={() =>
                  downloadSheets("workshop_stats.xlsx", [
                    {
                      name: "Rework Rates",
                      rows: [
                        { Metric: "Rework Requested Rate %", Value: rework.requested.value.toFixed(1) },
                        { Metric: "Rework Approved Rate %", Value: rework.approved.value.toFixed(1) },
                      ],
                    },
                  ])
                }
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <StatCard
                label="Rework Requested Rate"
                sublabel="(requests / total orders)"
                value={fmt.pct(rework.requested.value)}
                sparkline={rework.requested.sparkline}
                color={COLORS.amber}
              />
              <StatCard
                label="Rework Approved Rate"
                sublabel="(approved / total orders)"
                value={fmt.pct(rework.approved.value)}
                sparkline={rework.approved.sparkline}
                color={COLORS.red}
              />
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-snug min-h-[28px]">
                  Avg. Fulfillment Time
                  <div className="font-normal normal-case tracking-normal mt-0.5">(arrival → completion, days)</div>
                </div>
                <PlaceholderMetric reason="Needs a status-history table to know when an order arrived vs. completed." />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-snug min-h-[28px]">
                  Avg. Time to Reply to Proposal
                  <div className="font-normal normal-case tracking-normal mt-0.5">(days)</div>
                </div>
                <PlaceholderMetric reason="assessments has created_at/updated_at but no dedicated 'customer replied at' timestamp yet." />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KpiDashboard;
