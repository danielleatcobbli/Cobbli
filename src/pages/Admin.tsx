import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import ProposalBuilder, { type ProposedService } from "@/components/admin/ProposalBuilder";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { apiFetchJson } from "@/integrations/api/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { toast } from "@/hooks/use-toast";
import { Copy, Link2 } from "lucide-react";

type AssessmentRow = {
  proposal_token?: string;
  id: string;
  user_id: string;
  pairs: Array<{
    /** Stable per-bag id, written by AssessmentUpload.tsx starting
     *  2026-10-01 — absent on older rows submitted before that date. Used to
     *  tag proposed_services[] entries to a specific bag (see ProposalBuilder's
     *  pairIds) rather than associating by array position. */
    id?: string;
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
  /** Deliberate complimentary-confirmation flag (2026-10-01, Item 4) —
   *  staff-set only, here. True lets the customer confirm this repair with
   *  no Stripe charge via POST /checkout/confirm-complimentary. Never
   *  inferred from price — a request with $0 of selected services is NOT
   *  automatically complimentary unless this is explicitly checked. */
  complimentary?: boolean;
};

// Fixed 2026-09-24 (Danielle's call): this tab used to be "proposal_sent",
// but saving a proposal (now in ProposalBuilder) was writing a status AssessmentProposal.tsx (the
// customer-facing page) never checks for — only "quote_ready" makes a
// proposal actually show as ready to the customer. Staff-saved proposals
// were silently invisible to the customer this whole time. Renamed the tab
// to match what's now actually written. "waitlisted" is new — lets staff
// preview the waitlist experience without the full status-machine rework
// (task #124).
const STATUS_TABS: { id: "pending" | "quote_ready" | "waitlisted" | "booked" | "service_unavailable" | "needs_more_info" | "declined"; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "needs_more_info", label: "More information needed" },
  { id: "declined", label: "Closed" },
  { id: "quote_ready", label: "Quote ready" },
  { id: "waitlisted", label: "Waitlisted" },
  { id: "booked", label: "Booked" },
  { id: "service_unavailable", label: "Service unavailable" },
];

const Admin = () => {
  usePageMeta({ title: "Admin — Cobbli", description: "Cobbli internal admin." });
  const [rows, setRows] = useState<AssessmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const fetchRows = async (status: (typeof STATUS_TABS)[number]["id"]) => {
    setRows(null);
    setError(null);
    try {
      // Accept the API envelope and legacy bare-array responses.
      const unwrap = <T,>(body: T[] | { data?: T[] | null }): T[] =>
        Array.isArray(body) ? body : body?.data ?? [];
      const assessments = unwrap(
        await apiFetchJson<Array<Omit<AssessmentRow, "profile">> | { data?: Array<Omit<AssessmentRow, "profile">> | null }>(
          `/ops/assessments/?status_filter=${encodeURIComponent(status)}`,
        ),
      );
      const ids = Array.from(new Set(assessments.map(a => a.user_id).filter((id): id is string => !!id)));
      type ProfileRow = { user_id: string; first_name: string | null; last_name: string | null; phone: string | null };
      const profiles = ids.length
        ? unwrap(await apiFetchJson<ProfileRow[] | { data?: ProfileRow[] | null }>(
            `/ops/profiles?ids=${encodeURIComponent(ids.join(","))}`,
          ))
        : [];
      const profileMap = new Map(profiles.map(p => [p.user_id, p]));
      setRows(
        assessments.map((a) => ({
          ...a,
          profile: profileMap.get(a.user_id) ?? null,
        })),
      );
    } catch (err) {
      console.error("[admin/assessments] fetchRows failed", { status, err });
      setError(err instanceof Error ? err.message : "Could not load assessments.");
      setRows([]);
    }
  };

  useEffect(() => {
    fetchRows(tab);
  }, [tab]);

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

  const openEditor = (row: AssessmentRow) => setEditing(row);
  const closeEditor = () => setEditing(null);

  const copyLink = async (id: string) => {
    const row = rows?.find(r => r.id === id);
    const url = row?.proposal_token ? `${window.location.origin}/proposal/t/${row.proposal_token}` : `${window.location.origin}/repair/request/${id}`;
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
      await apiFetchJson(`/ops/assessments/${row.id}`, {
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
      await apiFetchJson(`/ops/assessments/${row.id}`, {
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
    <AdminLayout>
          <h1
            className="text-3xl md:text-4xl uppercase mb-2"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
          >
            Proposals
          </h1>
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
                                    alt={`Bag ${i + 1}`}
                                    title={`Bag ${i + 1}`}
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Bag {i + 1}
                    </p>
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

          {editing && (
            <div className="mt-4">
              <ProposalBuilder
                key={editing.id}
                assessment={editing}
                onCancel={closeEditor}
                onSaved={() => {
                  closeEditor();
                  fetchRows(tab);
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Admin;
