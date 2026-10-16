import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
async function loadOverview() {
  const [requests, repairs] = await Promise.all([
    supabase.from("assessments").select("id,status"),
    supabase.from("orders").select("id,assessment_id,status"),
  ]);
  if (requests.error) throw new Error(`Requests unavailable: ${requests.error.message}`);
  if (repairs.error) throw new Error(`Repairs unavailable: ${repairs.error.message}`);
  const linked = new Set((repairs.data || []).map(r => r.assessment_id).filter(Boolean));
  return { requests: (requests.data || []).filter(r => !linked.has(r.id) && r.status !== "booked"), repairs: repairs.data || [] };
}
export default function PilotOverview() {
  const { data, error, isPending, refetch, isFetching, dataUpdatedAt } = useQuery({ queryKey: ["pilot-overview"], queryFn: loadOverview });
  if (isPending) return <p>Loading overview…</p>;
  if (error || !data) return <div role="alert"><h1>Overview unavailable</h1><p>We couldn't load these records. No counts are shown.</p><Button onClick={() => refetch()} disabled={isFetching}>Try again</Button></div>;
  const counts = (rows: { status: string }[]) => Object.entries(rows.reduce<Record<string,number>>((out, row) => {out[row.status] = (out[row.status] || 0) + 1; return out;}, {}));
  return <div className="space-y-6">
    <h1 className="text-2xl font-semibold">Operations overview</h1>
    <p>Current saved records, including legacy shoe work and tests. These counts are not bag-pilot performance, revenue, or conversion metrics.</p>
    <p className="text-sm text-muted-foreground">Last loaded: {new Date(dataUpdatedAt).toLocaleString()}</p>
    <div className="grid gap-6 md:grid-cols-2">{[
      { title: "Requests not converted", rows: data.requests, href: "/admin/orders" },
      { title: "Repair records", rows: data.repairs, href: "/admin/orders" },
    ].map(group => <section key={group.title} className="rounded-lg border p-5">
      <h2 className="text-lg font-semibold">{group.title}: {group.rows.length}</h2>
      <ul className="my-3 space-y-2">{counts(group.rows).map(([status, count]) => <li key={status}>{status.replace(/[_-]/g," ")}: {count}</li>)}</ul>
      <Link className="underline" to={group.href}>View records</Link>
    </section>)}</div>
    <p className="text-sm">Confirmed requests are counted only under repairs. Completed means the record is currently marked completed; a verified return date is a separate measure.</p>
  </div>;
}
