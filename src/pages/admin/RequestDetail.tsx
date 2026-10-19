import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import LoadState from "@/components/admin/LoadState";
import ProposalBuilder from "@/components/admin/ProposalBuilder";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import {
  customerName,
  fetchRequest,
  referenceFor,
  type RequestBag,
  type RequestRow,
} from "./requestData";
import { ownerLabel, stageFor } from "./requestStage";

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Same stages where the Requests page offers "Build proposal" / "Edit".
// The backend also refuses to edit a booked request.
const canEditProposal = (r: RequestRow) =>
  !r.order && (r.status === "pending" || r.status === "quote_ready");

type BagPhotos = { urls: string[]; failed: number };

// Signs every photo of every bag. A photo that cannot be signed is counted
// and reported, never silently dropped.
async function loadPhotos(bags: RequestBag[]): Promise<BagPhotos[]> {
  return Promise.all(
    bags.map(async (bag) => {
      const urls: string[] = [];
      let failed = 0;
      for (const path of bag.photoPaths ?? []) {
        const { data, error } = await supabase.storage
          .from("assessment-uploads")
          .createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) {
          console.error("[admin/request] photo sign failed", { path, error });
          failed += 1;
        } else {
          urls.push(data.signedUrl);
        }
      }
      return { urls, failed };
    }),
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
);

const Bags = ({ request }: { request: RequestRow }) => {
  const photos = useQuery({
    queryKey: ["admin", "request-photos", request.id],
    queryFn: () => loadPhotos(request.pairs),
    retry: false,
  });

  if (request.pairs.length === 0) {
    return <p className="text-sm text-muted-foreground">This request has no bags on it.</p>;
  }

  return (
    <LoadState
      what="photos"
      isLoading={photos.isLoading}
      error={photos.error}
      onRetry={() => photos.refetch()}
    >
      <div className="grid gap-3 md:grid-cols-2">
        {request.pairs.map((bag, i) => {
          const shown = photos.data?.[i] ?? { urls: [], failed: 0 };
          const total = (bag.photoPaths ?? []).length;
          const details = [bag.shoeType, bag.brand, ...(bag.colors ?? [])].filter(Boolean);
          return (
            <section key={bag.id ?? i} className="space-y-2 rounded-md border p-3">
              <div>
                <h3 className="text-sm font-medium">Bag {i + 1}</h3>
                {details.length > 0 && (
                  <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">
                {bag.description?.trim() || (
                  <span className="text-muted-foreground">No description provided.</span>
                )}
              </p>
              {total === 0 ? (
                <p className="text-sm text-muted-foreground">No photos uploaded.</p>
              ) : (
                <>
                  {shown.failed > 0 && (
                    <p className="text-sm text-destructive" role="alert">
                      {shown.failed} of {total} photos could not be loaded.{" "}
                      <button type="button" className="underline" onClick={() => photos.refetch()}>
                        Retry
                      </button>
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {shown.urls.map((url, n) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer" title="Open full size">
                        <img
                          src={url}
                          alt={`Bag ${i + 1} photo ${n + 1}`}
                          className="h-16 w-16 rounded-md border object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </>
              )}
            </section>
          );
        })}
      </div>
    </LoadState>
  );
};

const RequestDetail = () => {
  const { id = "" } = useParams<{ id: string }>();
  usePageMeta({ title: "Request — Cobbli Admin", description: "Cobbli internal request." });

  const query = useQuery({
    queryKey: ["admin", "request", id],
    queryFn: () => fetchRequest(id),
    enabled: !!id,
    retry: false,
  });
  const queryClient = useQueryClient();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Link
          to="/admin/requests"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All requests
        </Link>

        <LoadState
          what="this request"
          isLoading={query.isLoading}
          error={query.error}
          onRetry={() => query.refetch()}
        >
          {query.data && (() => {
            const request = query.data;
            const stage = stageFor(request);
            return (
              <div className="space-y-8">
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold font-mono">{referenceFor(request.id)}</h1>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>{stage.label}</span>
                    <Badge variant="secondary">{ownerLabel(stage.owner)} acts next</Badge>
                    <span className="text-muted-foreground">{stage.nextAction}</span>
                  </div>
                </div>

                <section className="space-y-3">
                  <h2 className="text-lg font-medium">Customer and submission</h2>
                  <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    <Field label="Customer">{customerName(request)}</Field>
                    <Field label="Email">{request.guest_email || "—"}</Field>
                    <Field label="Phone">{request.profile?.phone || "—"}</Field>
                    <Field label="Zip">{request.guest_zip || "—"}</Field>
                    <Field label="Submitted">{formatDateTime(request.created_at)}</Field>
                    <Field label="Reference">{referenceFor(request.id)}</Field>
                    {request.order && (
                      <Field label="Order">{request.order.order_number ?? request.order.id}</Field>
                    )}
                  </dl>
                  {request.requested_conditions && request.requested_conditions.length > 0 && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Issues the customer ticked: </span>
                      {request.requested_conditions.join(", ")}
                    </p>
                  )}
                  {request.description?.trim() && (
                    <p className="text-sm whitespace-pre-wrap">
                      <span className="text-muted-foreground">Anything else: </span>
                      {request.description}
                    </p>
                  )}
                </section>

                <section className="space-y-3">
                  <h2 className="text-lg font-medium">Bags in this request ({request.pairs.length})</h2>
                  <Bags request={request} />
                </section>

                <section className="space-y-3">
                  <h2 className="text-lg font-medium">
                    {request.status === "quote_ready" ? "Edit proposal" : "Build proposal"}
                  </h2>
                  {canEditProposal(request) ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Tick the services to include, choose Essential vs Recommended, and adjust the
                        price. Saving sets the status to "Quote ready" and copies the customer link.
                      </p>
                      <ProposalBuilder
                        // Remount after a save so the builder starts from what was saved.
                        key={request.updated_at}
                        assessment={request}
                        onSaved={() => {
                          queryClient.invalidateQueries({ queryKey: ["admin", "request", request.id] });
                          queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
                        }}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      A proposal can only be built or edited while a request is new or has
                      recommendations sent. This request is: {stage.label}.
                    </p>
                  )}
                </section>
              </div>
            );
          })()}
        </LoadState>
      </div>
    </AdminLayout>
  );
};

export default RequestDetail;
