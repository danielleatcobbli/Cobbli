import { useEffect, useMemo, useState } from "react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { apiFetchJson } from "@/integrations/api/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "@/hooks/use-toast";
import { Copy, Link2 } from "lucide-react";

type AssessmentRow = {
  id: string;
  user_id: string;
  pairs: Array<{
    shoeType?: string | null;
    colors?: string[];
    brand?: string | null;
    photoPaths?: string[];
    videoPaths?: string[];
  }>;
  status: string;
  created_at: string;
  proposed_services: ProposedService[];
  profile?: { first_name: string | null; last_name: string | null; phone: string | null } | null;
};

type Service = {
  id: string;
  slug: string;
  name: string;
  base_price_cents: number;
};

type ProposedService = {
  service_id: string;
  slug: string;
  name: string;
  price_cents: number;
  tier: "essential" | "recommended";
};

type SelectionRow = {
  service: Service;
  checked: boolean;
  tier: "essential" | "recommended";
  price_cents: number;
};

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

const STATUS_TABS: { id: "pending" | "proposal_sent" | "booked" | "service_unavailable"; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "proposal_sent", label: "Proposal sent" },
  { id: "booked", label: "Booked" },
  { id: "service_unavailable", label: "Service unavailable" },
];

const Admin = () => {
  usePageMeta({ title: "Admin — Cobbli", description: "Cobbli internal admin." });
  const [rows, setRows] = useState<AssessmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["id"]>("pending");

  // Editor state
  const [editing, setEditing] = useState<AssessmentRow | null>(null);
  const [selection, setSelection] = useState<SelectionRow[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchRows = async (status: (typeof STATUS_TABS)[number]["id"]) => {
    setRows(null);
    setError(null);
    const { data: assessments, error: aErr } = await supabase
      .from("assessments")
      .select("id, user_id, pairs, status, created_at, proposed_services")
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (aErr) {
      setError(aErr.message);
      setRows([]);
      return;
    }
    const ids = Array.from(new Set((assessments ?? []).map((a) => a.user_id)));
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("user_id, first_name, last_name, phone").in("user_id", ids)
      : { data: [] as any[] };
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    setRows(
      (assessments ?? []).map((a: any) => ({
        ...a,
        profile: profileMap.get(a.user_id) ?? null,
      })),
    );
  };

  useEffect(() => {
    fetchRows(tab);
  }, [tab]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("services")
        .select("id, slug, name, base_price_cents")
        .eq("is_active", true)
        .order("popularity_rank", { ascending: true });
      setServices(data ?? []);
    })();
  }, []);

  const openEditor = (row: AssessmentRow) => {
    const existing = new Map(row.proposed_services?.map((s) => [s.service_id, s]) ?? []);
    setSelection(
      services.map((svc) => {
        const e = existing.get(svc.id);
        return {
          service: svc,
          checked: !!e,
          tier: e?.tier ?? "essential",
          price_cents: e?.price_cents ?? svc.base_price_cents,
        };
      }),
    );
    setEditing(row);
  };

  const closeEditor = () => {
    setEditing(null);
    setSelection([]);
  };

  const toggleService = (sid: string) =>
    setSelection((rows) =>
      rows.map((r) =>
        r.service.id === sid ? { ...r, checked: !r.checked } : r,
      ),
    );

  const setTier = (sid: string, tier: "essential" | "recommended") =>
    setSelection((rows) =>
      rows.map((r) => (r.service.id === sid ? { ...r, tier } : r)),
    );

  const setPrice = (sid: string, dollars: string) => {
    const cents = Math.max(0, Math.round(Number(dollars || "0") * 100));
    setSelection((rows) =>
      rows.map((r) => (r.service.id === sid ? { ...r, price_cents: cents } : r)),
    );
  };

  const selectedCount = selection.filter((r) => r.checked).length;

  const saveProposal = async () => {
    if (!editing || saving) return;
    if (selectedCount === 0) {
      toast({ title: "Select at least one service", variant: "destructive" });
      return;
    }
    setSaving(true);
    const proposed_services: ProposedService[] = selection
      .filter((r) => r.checked)
      .map((r) => ({
        service_id: r.service.id,
        slug: r.service.slug,
        name: r.service.name,
        price_cents: r.price_cents,
        tier: r.tier,
      }));
    const { error: e } = await supabase
      .from("assessments")
      .update({
        proposed_services: proposed_services as unknown as never,
        status: "proposal_sent",
      })
      .eq("id", editing.id);
    setSaving(false);
    if (e) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Proposal sent",
      description: "Shareable link copied to clipboard.",
    });
    const url = `${window.location.origin}/proposal/${editing.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
    closeEditor();
    fetchRows(tab);
  };

  const copyLink = async (id: string) => {
    const url = `${window.location.origin}/proposal/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: url });
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  };

  const markUnavailable = async (row: AssessmentRow) => {
    if (!confirm("Mark this assessment as Service unavailable? The customer will be notified by email and the order will be closed.")) return;
    const { error: e } = await supabase
      .from("assessments")
      .update({ status: "service_unavailable" })
      .eq("id", row.id);
    if (e) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
      return;
    }
    try {
      await apiFetchJson("/email/service-unavailable", {
        method: "POST",
        body: JSON.stringify({ assessment_id: row.id }),
      });
      toast({ title: "Marked as service unavailable", description: "Customer has been notified." });
    } catch (fnErr) {
      toast({
        title: "Status updated, notification failed",
        description: fnErr instanceof Error ? fnErr.message : "Notification failed",
        variant: "destructive",
      });
    }
    fetchRows(tab);
  };

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <section className="flex-1 py-10">
        <div className="container">
          <h1 className="font-display text-3xl md:text-4xl text-primary mb-2">Admin</h1>
          <p className="text-muted-foreground mb-6">Photo assessments</p>

          <div className="mb-6 inline-flex rounded-lg border border-border overflow-hidden">
            {STATUS_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm ${
                  tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-primary hover:bg-secondary/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {rows === null ? (
            <BrandSpinner className="py-16" size="lg" />
          ) : error ? (
            <p className="text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-border p-10 text-center">
              <p className="font-display text-xl text-primary mb-1">
                No {STATUS_TABS.find((t) => t.id === tab)?.label.toLowerCase()} assessments
              </p>
              <p className="text-muted-foreground">
                {tab === "pending"
                  ? "New customer photo submissions will show up here."
                  : tab === "proposal_sent"
                  ? "Proposals you've sent will show up here."
                  : tab === "booked"
                  ? "Booked orders from approved proposals will show up here."
                  : "Assessments marked as service unavailable will show up here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-primary">
                  <tr>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Phone</th>
                    <th className="text-left p-3">Pairs</th>
                    <th className="text-left p-3">Pair identifier</th>
                    <th className="text-left p-3">Submitted</th>
                    <th className="text-left p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const name = [r.profile?.first_name, r.profile?.last_name].filter(Boolean).join(" ") || "—";
                    const first = r.pairs?.[0];
                    const id = [first?.colors?.join(" / "), first?.brand, first?.shoeType].filter(Boolean).join(" · ") || "—";
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-3">{name}</td>
                        <td className="p-3">{r.profile?.phone || "—"}</td>
                        <td className="p-3">{r.pairs?.length ?? 0}</td>
                        <td className="p-3">{id}</td>
                        <td className="p-3">{new Date(r.created_at).toLocaleString()}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {tab === "pending" && (
                              <>
                                <Button size="sm" onClick={() => openEditor(r)}>
                                  Build proposal
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markUnavailable(r)}
                                >
                                  Service unavailable
                                </Button>
                              </>
                            )}
                            {tab === "proposal_sent" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => openEditor(r)}>
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyLink(r.id)}
                                  className="gap-1"
                                >
                                  <Copy size={14} /> Copy link
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markUnavailable(r)}
                                >
                                  Service unavailable
                                </Button>
                              </>
                            )}
                            {tab === "booked" && (
                              <a
                                href={`/proposal/${r.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline text-sm"
                              >
                                <Link2 size={14} /> View
                              </a>
                            )}
                            {tab === "service_unavailable" && (
                              <span className="text-xs text-muted-foreground">Closed · customer notified</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <Footer />

      {/* Build / edit proposal */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Build proposal</DialogTitle>
            <DialogDescription>
              Tick the services to include, choose Essential vs Recommended, and adjust the price.
              Saving will set the status to "Proposal sent" and copy a shareable link.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-2">
            {selection.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active services available.</p>
            ) : (
              selection.map((row) => (
                <div
                  key={row.service.id}
                  className={`rounded-lg border p-3 ${
                    row.checked ? "border-primary bg-secondary/30" : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={row.checked}
                      onCheckedChange={() => toggleService(row.service.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-primary truncate">{row.service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Default {formatCents(row.service.base_price_cents)}
                      </p>
                    </div>
                  </div>
                  {row.checked && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Tier</p>
                        <div className="inline-flex rounded-md border border-border overflow-hidden">
                          {(["essential", "recommended"] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setTier(row.service.id, t)}
                              className={`px-3 py-1.5 text-xs capitalize ${
                                row.tier === t
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-white text-primary"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Price ($)</p>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={(row.price_cents / 100).toString()}
                          onChange={(e) => setPrice(row.service.id, e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <DialogFooter className="mt-4">
            <p className="text-xs text-muted-foreground mr-auto self-center">
              {selectedCount} service{selectedCount === 1 ? "" : "s"} selected
            </p>
            <Button variant="outline" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveProposal} disabled={saving || selectedCount === 0}>
              {saving ? "Saving…" : "Save & copy link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Admin;
