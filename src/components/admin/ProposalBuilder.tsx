import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import LoadState from "@/components/admin/LoadState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { apiFetchJson } from "@/integrations/api/client";
import { toast } from "@/hooks/use-toast";

// The staff "Build proposal" editor, shared by the Requests page dialog
// (Admin.tsx) and the request detail page. Saving sets the request to
// "quote_ready" and copies the customer link.

export type ProposalService = {
  id: string;
  slug: string;
  name: string;
  base_price_cents: number;
  /** Coming-soon services can't be sold: checkout (backend/app/pricing.py)
   *  rejects them, so they're shown greyed out and can't be picked. */
  is_coming_soon?: boolean | null;
};

export type ProposedService = {
  recommendation_id?: string;
  choice_group?: string;
  rationale?: string;
  limitations?: string;
  service_id: string;
  slug: string;
  name: string;
  price_cents: number;
  tier: "essential" | "recommended";
  /** Which bag (assessments.pairs[].id) this service applies to. Absent on
   *  proposals saved before 2026-10-01, or when the bag it was tagged to has
   *  no stable id — those render in a shared, ungrouped section on the
   *  customer side rather than being guessed into a specific bag. */
  pair_id?: string;
};

export type ProposalAssessment = {
  id: string;
  /** Saved back as-is (plus any newly assigned bag ids), so every field on
   *  each bag must be preserved. */
  pairs: Array<{ id?: string; [key: string]: unknown }>;
  proposed_services?: ProposedService[] | null;
  complimentary?: boolean | null;
  proposal_token?: string | null;
};

type SelectionRow = {
  choice_group: string;
  rationale: string;
  limitations: string;
  service: ProposalService;
  checked: boolean;
  tier: "essential" | "recommended";
  price_cents: number;
  /** Which bags the service applies to, by pair id. Defaults to every bag;
   *  only editable for multi-bag requests. */
  pairIds: string[];
};

const formatCents = (c: number) => `$${(c / 100).toFixed(2)}`;

const customerLinkFor = (a: { id: string; proposal_token?: string | null }) =>
  a.proposal_token
    ? `${window.location.origin}/proposal/t/${a.proposal_token}`
    : `${window.location.origin}/repair/request/${a.id}`;

async function fetchServices(): Promise<ProposalService[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, slug, name, base_price_cents, is_coming_soon")
    .eq("is_active", true)
    .order("popularity_rank", { ascending: true });
  if (error) {
    console.error("[admin/proposal] services load failed", error);
    throw error;
  }
  return data ?? [];
}

function initialSelection(
  services: ProposalService[],
  proposed: ProposedService[],
  pairIds: string[],
): SelectionRow[] {
  // A service can have multiple proposed_services entries — one per tagged
  // bag (see save below) — so group by service_id to recover a single row
  // with every bag it applies to. Untagged entries (no pair_id) count as
  // "applies to every bag", matching how they're treated everywhere else.
  const bySid = new Map<string, ProposedService[]>();
  for (const s of proposed) bySid.set(s.service_id, [...(bySid.get(s.service_id) ?? []), s]);

  // Lines whose service isn't in the active catalog (custom repairs, or a
  // service since deactivated) are kept as their own rows.
  const extra: ProposalService[] = proposed
    .filter(
      (line, index, all) =>
        !services.some((s) => s.id === line.service_id) &&
        all.findIndex((other) => other.service_id === line.service_id) === index,
    )
    .map((line) => ({
      id: line.service_id,
      name: line.name,
      slug: line.slug,
      base_price_cents: line.price_cents,
      is_coming_soon: false,
    }));

  return [...services, ...extra].map((svc) => {
    const entries = bySid.get(svc.id) ?? [];
    const first = entries[0];
    const taggedIds = entries.map((e) => e.pair_id).filter((id): id is string => !!id);
    return {
      service: svc,
      choice_group: first?.choice_group ?? "",
      rationale: first?.rationale ?? "",
      limitations: first?.limitations ?? "",
      checked: entries.length > 0 && svc.is_coming_soon !== true,
      tier: first?.tier ?? "essential",
      price_cents: first?.price_cents ?? svc.base_price_cents,
      pairIds: taggedIds.length > 0 ? taggedIds : pairIds,
    };
  });
}

type ProposalBuilderProps = {
  assessment: ProposalAssessment;
  /** Called after a successful save (status is now "quote_ready"). */
  onSaved: () => void;
  /** Shows a Cancel button when provided. */
  onCancel?: () => void;
};

const ProposalBuilder = ({ assessment, onSaved, onCancel }: ProposalBuilderProps) => {
  // Bags submitted before 2026-10-01 have no stable id; give them one so
  // services can be tagged to them. Saved back with the proposal.
  const [pairs] = useState(() =>
    assessment.pairs.map((p) => ({ ...p, id: p.id || crypto.randomUUID() })),
  );
  const [selection, setSelection] = useState<SelectionRow[] | null>(null);
  const [complimentary, setComplimentary] = useState(Boolean(assessment.complimentary));
  const [saving, setSaving] = useState(false);

  const services = useQuery({
    queryKey: ["admin", "proposal-services"],
    queryFn: fetchServices,
    retry: false,
    staleTime: Infinity,
  });

  // Built once, when the catalog first arrives, so a background refetch can
  // never wipe the staff member's in-progress edits.
  useEffect(() => {
    if (services.data && selection === null) {
      setSelection(
        initialSelection(services.data, assessment.proposed_services ?? [], pairs.map((p) => p.id)),
      );
    }
  }, [services.data, selection, assessment.proposed_services, pairs]);

  const update = (sid: string, fn: (r: SelectionRow) => SelectionRow) =>
    setSelection((rows) => rows && rows.map((r) => (r.service.id === sid ? fn(r) : r)));

  const toggleService = (sid: string) =>
    update(sid, (r) => (r.service.is_coming_soon === true ? r : { ...r, checked: !r.checked }));

  const setTier = (sid: string, tier: "essential" | "recommended") => update(sid, (r) => ({ ...r, tier }));

  const setPrice = (sid: string, dollars: string) => {
    const cents = Math.max(0, Math.round(Number(dollars || "0") * 100));
    update(sid, (r) => ({ ...r, price_cents: cents }));
  };

  // A checked service always needs at least one bag, so the last one can't
  // be unticked here.
  const togglePair = (sid: string, pairId: string) =>
    update(sid, (r) => {
      const has = r.pairIds.includes(pairId);
      if (has && r.pairIds.length === 1) return r;
      return { ...r, pairIds: has ? r.pairIds.filter((id) => id !== pairId) : [...r.pairIds, pairId] };
    });

  const addCustomRepair = () => {
    const name = window.prompt("Name of the bag repair to recommend");
    if (!name?.trim()) return;
    const id = `custom-${crypto.randomUUID()}`;
    setSelection((prev) => [
      ...(prev ?? []),
      {
        service: { id, slug: id, name: name.trim(), base_price_cents: 0 },
        checked: true,
        tier: "recommended",
        price_cents: 0,
        pairIds: pairs.map((p) => p.id),
        choice_group: "",
        rationale: "",
        limitations: "",
      },
    ]);
  };

  const rows = selection ?? [];
  const selectedCount = rows.filter((r) => r.checked).length;

  const save = async () => {
    if (saving) return;
    if (selectedCount === 0) {
      toast({ title: "Select at least one service", variant: "destructive" });
      return;
    }
    setSaving(true);
    // One entry per (checked service × tagged bag), so the customer-facing
    // Repair Details page can group services under the right bag.
    const proposed_services: ProposedService[] = rows
      .filter((r) => r.checked)
      .flatMap((r) => {
        const targetIds = r.pairIds.length > 0 ? r.pairIds : [undefined];
        return targetIds.map((pairId) => ({
          recommendation_id: `${pairId || "legacy"}:${r.service.id}`,
          choice_group: r.choice_group.trim() || undefined,
          rationale: r.rationale.trim() || undefined,
          limitations: r.limitations.trim() || undefined,
          service_id: r.service.id,
          slug: r.service.slug,
          name: r.service.name,
          price_cents: r.price_cents,
          tier: r.tier,
          ...(pairId ? { pair_id: pairId } : {}),
        }));
      });
    try {
      await apiFetchJson(`/ops/assessments/${assessment.id}`, {
        method: "PATCH",
        body: JSON.stringify({ proposed_services, pairs, status: "quote_ready", complimentary }),
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
      description: "Recommendations saved. You can copy the customer link below.",
    });
    try {
      await navigator.clipboard.writeText(customerLinkFor(assessment));
    } catch {
      /* ignore */
    }
    onSaved();
  };

  return (
    <LoadState
      what="services"
      isLoading={services.isLoading || (!!services.data && selection === null)}
      error={services.error}
      onRetry={() => services.refetch()}
    >
      <div className="space-y-3">
        <Button type="button" variant="outline" onClick={addCustomRepair}>
          Add a custom bag repair
        </Button>
        <p className="text-xs text-muted-foreground">
          Every repair is optional for the customer. Give alternatives the same issue name; the
          customer can select only one for that bag.
        </p>
        <div className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active services available.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.service.id}
                className={`rounded-lg border p-3 ${
                  row.service.is_coming_soon === true
                    ? "border-border opacity-50"
                    : row.checked
                      ? "border-primary bg-secondary/30"
                      : "border-border"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={row.checked}
                    onCheckedChange={() => toggleService(row.service.id)}
                    disabled={row.service.is_coming_soon === true}
                    className="mt-1"
                    aria-label={row.service.name}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-primary truncate">{row.service.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.service.is_coming_soon === true
                        ? "Coming soon — not available to book yet"
                        : `Default ${formatCents(row.service.base_price_cents)}`}
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
                              row.tier === t ? "bg-primary text-primary-foreground" : "bg-white text-primary"
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
                    {(
                      [
                        ["choice_group", "Issue / alternatives group (optional)"],
                        ["rationale", "What this option does"],
                        ["limitations", "Limitations / tradeoffs"],
                      ] as const
                    ).map(([field, label]) => (
                      <label key={field} className="text-xs sm:col-span-2">
                        {label}
                        <Input
                          value={row[field]}
                          onChange={(e) => update(row.service.id, (r) => ({ ...r, [field]: e.target.value }))}
                        />
                      </label>
                    ))}
                    {pairs.length > 1 && (
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">Applies to</p>
                        <div className="flex flex-wrap gap-1.5">
                          {pairs.map((p, i) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => togglePair(row.service.id, p.id)}
                              className={`px-2.5 py-1 rounded-full text-xs border ${
                                row.pairIds.includes(p.id)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-white text-primary border-border"
                              }`}
                            >
                              Bag {i + 1}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Explicit staff opt-in only, never inferred from price. When set,
            the customer confirms for free instead of going to checkout. */}
        <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
          <Checkbox checked={complimentary} onCheckedChange={(v) => setComplimentary(Boolean(v))} />
          <span>
            <span className="font-medium">Complimentary repair (no charge)</span>
            <span className="block text-xs text-muted-foreground">
              The customer confirms for free instead of paying — use for test/comp repairs only.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <p className="text-xs text-muted-foreground mr-auto">
            {selectedCount} service{selectedCount === 1 ? "" : "s"} selected
          </p>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button onClick={save} disabled={saving || selectedCount === 0}>
            {saving ? "Saving…" : "Save & copy link"}
          </Button>
        </div>
      </div>
    </LoadState>
  );
};

export default ProposalBuilder;
