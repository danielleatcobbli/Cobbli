import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import LoadState from "@/components/admin/LoadState";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import { customerName, fetchRequests, referenceFor, type RequestRow } from "./requestData";
import { OWNERS, STAGES, ownerLabel, stageFor, type Owner, type StageId } from "./requestStage";

const ALL = "all";
const MAX_THUMBS = 4;
const THUMB_TTL_SECONDS = 3600;

// Each bag is identified by its first photo, so a row shows one thumbnail per bag.
const firstPhotoPaths = (row: RequestRow): (string | null)[] =>
  row.pairs.slice(0, MAX_THUMBS).map((bag) => bag.photoPaths?.[0] ?? null);

// One batched signing call for every thumbnail on the page.
async function signThumbnails(paths: string[]): Promise<Map<string, string>> {
  const { data, error } = await supabase.storage
    .from("assessment-uploads")
    .createSignedUrls(paths, THUMB_TTL_SECONDS);
  if (error) {
    console.error("[admin/requests] thumbnail signing failed", error);
    throw error;
  }
  const urls = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

const BagThumbnails = ({ row, urls }: { row: RequestRow; urls: Map<string, string> | undefined }) => {
  if (row.pairs.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const extra = row.pairs.length - MAX_THUMBS;
  return (
    <div className="flex items-center gap-1">
      {firstPhotoPaths(row).map((path, i) => {
        const url = path ? urls?.get(path) : undefined;
        return url ? (
          <img
            key={i}
            src={url}
            alt={`Bag ${i + 1}`}
            title={`Bag ${i + 1}`}
            className="h-10 w-10 rounded-md border object-cover"
          />
        ) : (
          <div
            key={i}
            title={path ? `Bag ${i + 1}: photo unavailable` : `Bag ${i + 1}: no photo`}
            className="h-10 w-10 rounded-md border bg-muted"
          />
        );
      })}
      {extra > 0 && <span className="self-center text-xs text-muted-foreground">+{extra}</span>}
    </div>
  );
};

const ownerClass: Record<Owner, string> = {
  cobbli: "bg-amber-100 text-amber-900",
  customer: "bg-blue-100 text-blue-800",
  none: "bg-gray-100 text-gray-700",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const matchesSearch = (row: RequestRow, needle: string): boolean => {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    referenceFor(row.id),
    row.id,
    customerName(row),
    row.guest_email ?? "",
    row.order?.order_number ?? "",
  ];
  return haystack.some((h) => h.toLowerCase().includes(q));
};

const RequestList = () => {
  usePageMeta({ title: "Requests — Cobbli Admin", description: "Cobbli internal requests." });
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>(ALL);
  const [owner, setOwner] = useState<string>(ALL);

  // retry: false so a failure surfaces immediately with a Retry button
  // instead of after several silent background retries.
  const query = useQuery({
    queryKey: ["admin", "requests"],
    queryFn: fetchRequests,
    retry: false,
  });

  const staged = useMemo(
    () => (query.data ?? []).map((row) => ({ row, stage: stageFor(row) })),
    [query.data],
  );

  // Signed for every loaded row (not just the filtered ones), so searching
  // and filtering never re-sign. Thumbnails are decorative: if signing
  // fails, rows show grey placeholders and the list itself is unaffected.
  const thumbPaths = useMemo(
    () =>
      Array.from(
        new Set(
          (query.data ?? []).flatMap((row) =>
            firstPhotoPaths(row).filter((p): p is string => !!p),
          ),
        ),
      ),
    [query.data],
  );
  const thumbs = useQuery({
    queryKey: ["admin", "request-thumbnails", thumbPaths],
    queryFn: () => signThumbnails(thumbPaths),
    enabled: thumbPaths.length > 0,
    retry: false,
    // Re-sign before the signed URLs expire.
    staleTime: (THUMB_TTL_SECONDS - 600) * 1000,
  });

  // Every count below comes from `staged`, i.e. the same result as the list.
  const stageCounts = useMemo(() => {
    const counts = new Map<StageId, number>();
    for (const s of staged) counts.set(s.stage.id, (counts.get(s.stage.id) ?? 0) + 1);
    return counts;
  }, [staged]);

  const ownerCounts = useMemo(() => {
    const counts = new Map<Owner, number>();
    for (const s of staged) counts.set(s.stage.owner, (counts.get(s.stage.owner) ?? 0) + 1);
    return counts;
  }, [staged]);

  const visible = useMemo(
    () =>
      staged.filter(
        (s) =>
          (stage === ALL || s.stage.id === stage) &&
          (owner === ALL || s.stage.owner === owner) &&
          matchesSearch(s.row, search),
      ),
    [staged, stage, owner, search],
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Requests</h1>
          <p className="text-sm text-muted-foreground">
            Every submitted request, and who needs to act next.
          </p>
        </div>

        <LoadState
          what="requests"
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input
                className="w-full sm:w-72"
                placeholder="Search reference or customer name"
                aria-label="Search requests"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="w-full sm:w-56" aria-label="Filter by stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All stages ({staged.length})</SelectItem>
                  {STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label} ({stageCounts.get(s.id) ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger className="w-full sm:w-48" aria-label="Filter by owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Anyone ({staged.length})</SelectItem>
                  {OWNERS.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label} ({ownerCounts.get(o.id) ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing {visible.length} of {staged.length} requests
            </p>

            {visible.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                {staged.length === 0
                  ? "No requests have been submitted yet."
                  : "No requests match your search and filters."}
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bags</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Who acts</TableHead>
                      <TableHead>Next action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map(({ row, stage: st }) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <BagThumbnails row={row} urls={thumbs.data} />
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          <Link
                            to={`/admin/requests/${row.id}`}
                            className="font-medium underline-offset-2 hover:underline"
                          >
                            {referenceFor(row.id)}
                          </Link>
                        </TableCell>
                        <TableCell>{customerName(row)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(row.created_at)}</TableCell>
                        <TableCell>{st.label}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={ownerClass[st.owner]}>
                            {ownerLabel(st.owner)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{st.nextAction}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </LoadState>
      </div>
    </AdminLayout>
  );
};

export default RequestList;
