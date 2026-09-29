import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
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
import { apiFetch, apiFetchJson } from "@/integrations/api/client";
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
    /** Per-item "what's going on with this bag?" note (2026-09-24) —
     *  AssessmentUpload.tsx now writes one of these per item instead of a
     *  single description for the whole assessment (see the assessment-level
     *  `description` field below, which older single-item rows still use). */
    description?: string | null;
  }>;
  status: string;
  created_at: string;
  proposed_services: ProposedService[];
  profile?: { first_name: string | null; last_name: string | null; phone: string | null } | null;
  /** Checklist conditions the customer had already checked on the Start a
   *  Repair page before jumping to "Not sure? Send us a photo instead"
   *  (2026-09-02, Danielle's ask) — previously nothing surfaced this, only
   *  the free-text description below, which is easy for a customer to skip
   *  entirely. Empty when they came from a page with no checklist context. */
  requested_conditions?: string[];
  /** Free-text "Anything else we should know?" field from AssessmentUpload
   *  — always existed on the row, but was never shown anywhere in this
   *  staff UI until now (2026-09-02). */
  description?: string | null;
  guest_email?: string | null;
  /** Delivery zip captured on AssessmentUpload.tsx (2026-09-24). */
  guest_zip?: string | null;
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

// Fixed 2026-09-24 (Danielle's call): this tab used to be "proposal_sent",
// but saveProposal() below was writing a status AssessmentProposal.tsx (the
// customer-facing page) never checks for — only "quote_ready" makes a
// proposal actually show as ready to the customer. Staff-saved proposals
// were silently invisible to the customer this whole time. Renamed the tab
// to match what's now actually written. "waitlisted" is new — lets staff
// preview the waitlist experience without the full status-machine rework
// (task #124).
const STATUS_TABS: { id: "pending" | "quote_ready" | "waitlisted" | "booked" | "service_unavailable"; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "quote_ready", label: "Quote ready" },
  { id: "waitlisted", label: "Waitlisted" },
  { id: "booked", label: "Booked" },
  { id: "service_unavailable", label: "Service unavailable" },
];

const Admin = () => {
  usePageMeta({ title: "Admin — Cobbli", description: "Cobbli internal admin." });
  const { isAdmin } = useRole();
  const [rows, setRows] = useState<AssessmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["id"]>("pending");
  // Signed thumbnail URLs per assessment id, keyed by row id — this is the
  // "clear place to view assessments with photos" Danielle asked for
  // (2026-09-24). Fetched lazily whenever the visible rows change.
  //
  // Grouped per item (2026-09-24, multi-item submissions) — each entry is
  // one array per pair/item, rather than one flat array across the whole
  // assessment, so staff can tell which photos belong to which item instead
  // of seeing them all jumbled together. photosByRow[rowId][itemIndex] is
  // that item's photo URLs, in upload order — photosByRow[rowId][itemIndex][0]
  // is that item's identifying "first photo" (2026-09-24, Danielle's call:
  // items are identified by their first photo, not a customer-typed name).
  const [photosByRow, setPhotosByRow] = useState<Record<string, string[][]>>({});

  // Editor state
  const [editing, setEditing] = useState<AssessmentRow | null>(null);
  const [selection, setSelection] = useState<SelectionRow[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchRows = async (status: (typeof STATUS_TABS)[number]["id"]) => {
    setRows(null);
    setError(null);
    try {
      const assessments = await apiFetchJson<Array<Omit<AssessmentRow, "profile">>>(
        `/ops/assessments?status=${encodeURIComponent(status)}`,
      );
      const ids = Array.from(new Set(assessments.map((a) => a.user_id)));
      const profiles = ids.length
        ? await apiFetchJson<Array<{ user_id: string; first_name: string | null; last_name: string | null; phone: string | null }>>(
            `/ops/profiles?ids=${encodeURIComponent(ids.join(","))}`,
          )
        : [];
      const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
      setRows(
        assessments.map((a) => ({
          ...a,
          profile: profileMap.get(a.user_id) ?? null,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assessments.");
      setRows([]);
    }
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

  // Signed URLs for every pair's photos across the visible rows, grouped per
  // pair — same signed-URL pattern AssessmentProposal.tsx uses. Skips rows
  // already fetched so switching tabs back and forth doesn't keep re-signing.
  useEffect(() => {
    if (!rows) return;
    const pending = rows.filter((r) => !(r.id in photosByRow));
    if (pending.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        pending.map(async (r) => {
          const perPair = await Promise.all(
            (r.pairs ?? []).map(async (p) => {
              const urls: string[] = [];
              for (const path of (p.photoPaths ?? []).slice(0, 6)) {
                const { data } = await supabase.storage
                  .from("assessment-uploads")
                  .createSignedUrl(path, 3600);
                if (data?.signedUrl) urls.push(data.signedUrl);
              }
              return urls;
            }),
          );
          return [r.id, perPair] as const;
        }),
      );
      if (cancelled) return;
      setPhotosByRow((prev) => {
        const next = { ...prev };
        for (const [id, perPair] of entries) next[id] = perPair;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, photosByRow]);

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
    try {
      await apiFetch(`/ops/assessments/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          proposed_services,
          status: "quote_ready",
        }),
      });
    } catch (e) {
      setSaving(false);
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : "Save failed",
        variant: "destructive",
      });
      return;
    }
    setSaving(false);
    toast({
      title: "Quote ready",
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
    try {
      await apiFetch(`/ops/assessments/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "service_unavailable" }),
      });
    } catch (e) {
      toast({
        title: "Could not update",
        description: e instanceof Error ? e.message : "Update failed",
        variant: "destructive",
      });
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

  // Preview-enabling action (2026-09-24, Danielle's call) — lets staff move
  // a quote-ready proposal to "waitlisted" so the waitlist experience
  // (AssessmentProposal.tsx) can actually be tested end to end before the
  // real capacity/waitlist logic exists on the backend (task #124). No
  // transactional email fires here — Brevo lifecycle emails are unlinked
  // pending the copy rework (see cobbli_mvp_order_flow.pptx).
  const markWaitlisted = async (row: AssessmentRow) => {
    try {
      await apiFetch(`/ops/assessments/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "waitlisted" }),
      });
      toast({ title: "Marked as waitlisted" });
    } catch (e) {
      toast({
        title: "Could not update",
        description: e instanceof Error ? e.message : "Update failed",
        variant: "destructive",
      });
      return;
    }
    fetchRows(tab);
  };

  // Restyled 2026-08-26 (Danielle's call) — cream page bg + Header
  // theme="cream" + amber page title only; the assessment queue/table below
  // keeps its existing functional styling (staff tool, page-shell-only
  // scoping same as the rest of admin).
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />
      <section className="flex-1 py-10">
        <div className="container">
          <h1
            className="text-3xl md:text-4xl uppercase mb-2"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
          >
            Admin
          </h1>
          <p className="text-muted-foreground mb-6">Photo assessments</p>

          {isAdmin && (
            <div className="mb-6">
              <Link
                to="/admin/settings"
                className="text-sm font-medium text-primary hover:underline"
              >
                Settings (owner) →
              </Link>
            </div>
          )}

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
              <p className="text-xl text-primary mb-1">
                No {STATUS_TABS.find((t) => t.id === tab)?.label.toLowerCase()} assessments
              </p>
              <p className="text-muted-foreground">
                {tab === "pending"
                  ? "New customer photo submissions will show up here."
                  : tab === "quote_ready"
                  ? "Proposals you've sent will show up here."
                  : tab === "waitlisted"
                  ? "Assessments you've waitlisted will show up here."
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
                    <th className="text-left p-3">Items</th>
                    <th className="text-left p-3">Customer</th>
                    <th className="text-left p-3">Zip</th>
                    <th className="text-left p-3">Phone</th>
                    <th className="text-left p-3">Customer requested</th>
                    <th className="text-left p-3">Submitted</th>
                    <th className="text-left p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const name = [r.profile?.first_name, r.profile?.last_name].filter(Boolean).join(" ") || "—";
                    // One thumbnail per item — its first photo — rather than
                    // a flat mixed gallery, so staff can tell at a glance how
                    // many items are in this submission and roughly what
                    // each one is (2026-09-24, multi-item submissions;
                    // Danielle's call: items are identified by their first
                    // photo, not a customer-typed name).
                    const perPairPhotos = photosByRow[r.id] ?? [];
                    const itemCount = r.pairs?.length ?? 0;
                    return (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-3">
                          {itemCount > 0 ? (
                            <div className="flex items-center gap-1">
                              {perPairPhotos.slice(0, 4).map((urls, i) =>
                                urls[0] ? (
                                  <img
                                    key={i}
                                    src={urls[0]}
                                    alt={itemCount > 1 ? `Item ${i + 1}` : "Item photo"}
                                    title={itemCount > 1 ? `Item ${i + 1}` : undefined}
                                    className="h-10 w-10 rounded-md object-cover border border-border"
                                  />
                                ) : (
                                  <div
                                    key={i}
                                    className="h-10 w-10 rounded-md bg-secondary/50 border border-border"
                                  />
                                ),
                              )}
                              {itemCount > 4 && (
                                <span className="text-xs text-muted-foreground self-center">
                                  +{itemCount - 4}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">{name}</td>
                        <td className="p-3">{r.guest_zip || "—"}</td>
                        <td className="p-3">{r.profile?.phone || "—"}</td>
                        {/* Requested-conditions visibility (2026-09-02,
                            Danielle's ask) — what the customer had already
                            checked on the checklist before bailing to this
                            photo flow. Truncated with a title tooltip for
                            the full list; "—" when they arrived with no
                            checklist context (e.g. a direct link) or via
                            the pre-checklist SoleMaterialDialog path. */}
                        <td className="p-3 max-w-[220px]">
                          {r.requested_conditions && r.requested_conditions.length > 0 ? (
                            <span className="block truncate text-xs" title={r.requested_conditions.join(", ")}>
                              {r.requested_conditions.join(", ")}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
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
                            {tab === "quote_ready" && (
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
                                  onClick={() => markWaitlisted(r)}
                                >
                                  Waitlist
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
                            {tab === "waitlisted" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => copyLink(r.id)}
                                className="gap-1"
                              >
                                <Copy size={14} /> Copy link
                              </Button>
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
              Saving will set the status to "Quote ready" and copy a shareable link.
            </DialogDescription>
          </DialogHeader>

          {/* Photos + notes grouped per item (2026-09-24, multi-item
              submissions) — replaces the old flat photo gallery + single
              assessment-level description, so staff can see which photos
              and which "what's going on with this bag?" note go together
              when a customer submitted more than one item. Each item's own
              first photo doubles as its identifier, same as everywhere else
              this data shows up (AssessmentProposal.tsx, Bag.tsx). */}
          {editing && editing.pairs.length > 0 && (
            <div className="space-y-3">
              {editing.pairs.map((p, i) => {
                const urls = photosByRow[editing.id]?.[i] ?? [];
                return (
                  <div key={i} className="rounded-lg border border-border p-3">
                    {editing.pairs.length > 1 && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Item {i + 1}
                      </p>
                    )}
                    {urls.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                        {urls.map((src, j) => (
                          <img
                            key={j}
                            src={src}
                            alt={`Item ${i + 1} photo ${j + 1}`}
                            className="h-20 w-20 rounded-md object-cover border border-border"
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No photos</p>
                    )}
                    {p.description && (
                      <p className="mt-2 text-sm whitespace-pre-wrap" style={{ color: "#3d1700" }}>
                        {p.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Customer's own requested conditions (2026-09-02, Danielle's
              ask) + legacy assessment-level notes (older, single-item
              rows only — new submissions write description per item above
              instead) — surfaced right where staff are deciding what to
              include, so an omitted service reads as an intentional call
              rather than something missed. requested_conditions comes from
              the checklist state carried over when the customer clicked
              "Not sure?". */}
          {(editing?.requested_conditions?.length || editing?.description) && (
            <div className="mt-3 rounded-lg p-3 space-y-2" style={{ backgroundColor: "#fff5cc" }}>
              {editing?.requested_conditions && editing.requested_conditions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold" style={{ color: "#3d1700" }}>
                    Customer already flagged:
                  </p>
                  <p className="text-sm" style={{ color: "#3d1700" }}>
                    {editing.requested_conditions.join(", ")}
                  </p>
                </div>
              )}
              {editing?.description && (
                <div>
                  <p className="text-xs font-semibold" style={{ color: "#3d1700" }}>
                    Customer notes:
                  </p>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: "#3d1700" }}>
                    {editing.description}
                  </p>
                </div>
              )}
            </div>
          )}

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
