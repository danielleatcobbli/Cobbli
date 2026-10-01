/**
 * RepairDetails
 *
 * Unified "Repair details" page (2026-10-01) — the single place a repair
 * opens from "My Repairs" (Account.tsx), whether it's still a request
 * (assessments row) or a confirmed repair (orders row). Two route params
 * decide which: /repair/request/:id and /repair/order/:id.
 *
 * This intentionally does NOT replace /proposal/:id, /proposal/t/:token, or
 * /order-confirmation/:id — those stay as-is for existing email links and the
 * public token-based proposal flow. This page reuses their data model and
 * scheduling mechanics rather than rebuilding them.
 *
 * Scope note: per Danielle's spec, this covers page structure, the Pickup &
 * Return state matrix, per-bag photo/service grouping, and pricing display
 * rules — using the existing status machine, existing scheduling flow
 * (PickupScheduler + the Calendly book/cancel edge functions), and the
 * existing request→order transition. No new scheduling system, no database
 * rewrite.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calendar, Clock, MessageSquare, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PickupScheduler, type PickupWindow } from "@/components/cobbli/PickupScheduler";
import { useAccount } from "@/context/AccountContext";
import { useBag, formatPrice, type BagService } from "@/context/BagContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { apiFetchJson, ApiError } from "@/integrations/api/client";
import { cn } from "@/lib/utils";
import {
  REQUEST_STATUS,
  REPAIR_STATUS,
  fallbackMeta,
  isPickedUpOrLater,
  isReadyForReturnOrLater,
  isReturnedOrLater,
  isClosedOrCanceledOrder,
  isClosedRequest,
} from "@/lib/repairStatus";
import { toNyDateKey, formatNyTimeRange, fmtDateKey } from "@/lib/pickupTime";
import { readSelectedRecommended, writeSelectedRecommended } from "@/lib/repairSelections";

const COURIER_FEE_CENTS = 0;

// ─── shared bits ────────────────────────────────────────────────────────────

const PageShell = ({
  refLabel,
  meta,
  children,
}: {
  refLabel: string;
  meta: { label: string; pill: string; next: string };
  children: React.ReactNode;
}) => (
  <main className="min-h-screen flex flex-col bg-white">
    <Header />
    <section className="flex-1 py-10 md:py-14">
      <div className="container max-w-3xl">
        {/* "Repair #…" is the primary heading here and on the My Repairs
            list card — not a generic "Repair details" label — per Danielle's
            2026-10-01 call to remove the legacy item-name/page-label
            headings in favor of the one reference number used everywhere. */}
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Repair details</p>
        <h1
          className="text-2xl md:text-3xl uppercase"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
        >
          {refLabel}
        </h1>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <span className={cn("inline-block rounded-full px-3 py-1 text-sm font-semibold", meta.pill)}>
            {meta.label}
          </span>
          {meta.next && <span className="text-sm text-foreground/80">{meta.next}</span>}
        </div>

        {children}
      </div>
    </section>
    <Footer />
  </main>
);

/** Click a bag's thumbnail to see every photo of that bag. */
const PhotoLightbox = ({
  open,
  onOpenChange,
  photos,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: string[];
  label: string;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{label} photos</DialogTitle>
      </DialogHeader>
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos available.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`${label} photo ${i + 1}`}
              className="aspect-square w-full rounded-md object-cover border border-border"
            />
          ))}
        </div>
      )}
    </DialogContent>
  </Dialog>
);

/** A service line that shows "Complimentary test repair" instead of a bare
 *  $0.00 for a service staff deliberately priced at zero — distinct from
 *  "Price pending assessment," which is for a bag with no priced service at
 *  all yet. */
const ServiceLine = ({ name, priceCents }: { name: string; priceCents: number }) => (
  <li className="py-2 flex justify-between gap-4 text-sm">
    <span className="text-primary">{name}</span>
    <span className="font-medium">
      {priceCents === 0 ? <span className="text-xs">Complimentary test repair</span> : formatPrice(priceCents)}
    </span>
  </li>
);

// Shows an icon placeholder rather than an empty box when there's no photo
// to display — a historical request/order with no surviving photo, or one
// still waiting on its signed URL to resolve (2026-10-01 fix; matches the
// same placeholder used in Account.tsx's My Repairs list).
const BagThumbnail = ({ src, label, onClick }: { src: string | null; label: string; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className="h-16 w-16 rounded-lg overflow-hidden border border-border shrink-0 bg-secondary/40 disabled:cursor-default flex items-center justify-center"
    aria-label={onClick ? `View all ${label} photos` : undefined}
  >
    {src ? (
      <img src={src} alt={label} className="h-full w-full object-cover" />
    ) : (
      <ShoppingBag className="text-muted-foreground/50" size={22} />
    )}
  </button>
);

// ─── request (assessment) view ─────────────────────────────────────────────

type ReqPair = {
  id?: string;
  photoPaths?: string[];
  description?: string | null;
  shoeType?: string | null;
};

type ReqProposedService = {
  service_id: string;
  slug: string;
  name: string;
  price_cents: number;
  tier: "essential" | "recommended";
  pair_id?: string;
};

const RepairDetailsRequest = ({ id }: { id: string }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addPair, clear, taggedAssessmentIds } = useBag();

  // Request-to-order continuity follow-up (2026-10-02, Danielle's call):
  // clear() used to silently discard another request's not-yet-checked-out
  // selections whenever this one was accepted. That's no longer silent —
  // every item accepted from a request is now tagged with its assessmentId
  // (BagContext.addPair's new trailing param), so this checks for any OTHER
  // request's items still sitting in the bag and asks before discarding
  // them, rather than guessing or dropping them unannounced. Declining
  // leaves the bag and this page exactly as they were — nothing is
  // accepted, nothing is lost. This does not make the two requests
  // coexist in the same cart (checkout still only submits one assessment_id
  // at a time) — that's the real, documented limitation; this only ensures
  // the customer is told before anything of theirs is thrown away.
  const confirmClearIfOtherRequestPending = (thisId: string): boolean => {
    const others = taggedAssessmentIds().filter((aid) => aid !== thisId);
    if (others.length === 0) return true;
    return window.confirm(
      "You have selections saved from another repair request that haven't been checked out yet. " +
        "Continuing will remove them from your cart — you can re-accept that request's recommendations later. Continue?",
    );
  };
  const { user: accountUser, addresses } = useAccount();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<ReqPair[]>([]);
  const [proposedServices, setProposedServices] = useState<ReqProposedService[]>([]);
  const [status, setStatus] = useState<string>("");
  const [thumbsByPair, setThumbsByPair] = useState<string[][]>([]);
  const [selectedRecommended, setSelectedRecommended] = useState<Set<string>>(new Set());
  const [lightboxPair, setLightboxPair] = useState<number | null>(null);
  // Deliberate complimentary-confirmation path (2026-10-01, Item 4) — a
  // staff-set flag only (assessments.complimentary), never inferred from
  // price. See confirmComplimentary below.
  const [complimentary, setComplimentary] = useState(false);
  const [confirmingComplimentary, setConfirmingComplimentary] = useState(false);
  // Pickup-before-confirmation (2026-10-02, Danielle's call): a complimentary
  // repair is confirmed only once a real pickup slot is held, same as the
  // paid flow — never shown as confirmed with pickup still unresolved.
  const [complimentaryPickup, setComplimentaryPickup] = useState<PickupWindow | null>(null);

  usePageMeta({ title: "Repair details — Cobbli", description: "Review your repair request and options." });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("assessments")
        .select("id, pairs, status, proposed_services, complimentary")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (e || !data) {
        setError(e?.message || "Repair request not found");
        setLoading(false);
        return;
      }
      const ps = (data.pairs as unknown as ReqPair[]) ?? [];
      const services = (data.proposed_services as unknown as ReqProposedService[]) ?? [];
      setPairs(ps);
      setStatus(data.status);
      setProposedServices(services);
      setComplimentary(Boolean((data as { complimentary?: boolean }).complimentary));
      // Restore a saved-this-visit selection if there is one (see
      // repairSelections.ts); otherwise fall back to "every recommended
      // service pre-selected", the original default.
      const saved = readSelectedRecommended(id);
      setSelectedRecommended(
        saved ?? new Set(services.filter((s) => s.tier === "recommended").map((s) => s.service_id)),
      );
      const all: string[][] = [];
      for (const p of ps) {
        const out: string[] = [];
        for (const path of (p.photoPaths ?? []).slice(0, 12)) {
          const { data: s } = await supabase.storage.from("assessment-uploads").createSignedUrl(path, 3600);
          if (s?.signedUrl) out.push(s.signedUrl);
        }
        all.push(out);
      }
      if (!cancelled) setThumbsByPair(all);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Group services by bag id. Untagged entries (no pair_id — proposals saved
  // before 2026-10-01, or a bag that predates stable ids) apply generally
  // rather than being guessed into one bag, and render in their own section
  // below the per-bag cards.
  const byPairId = useMemo(() => {
    const m = new Map<string, ReqProposedService[]>();
    for (const s of proposedServices) {
      if (!s.pair_id) continue;
      m.set(s.pair_id, [...(m.get(s.pair_id) ?? []), s]);
    }
    return m;
  }, [proposedServices]);
  const untagged = useMemo(() => proposedServices.filter((s) => !s.pair_id), [proposedServices]);

  const essentialAll = proposedServices.filter((s) => s.tier === "essential");
  const recommendedAll = proposedServices.filter((s) => s.tier === "recommended");
  const essentialSubtotal = essentialAll.reduce((a, l) => a + l.price_cents, 0);
  const recommendedSubtotal = recommendedAll
    .filter((l) => selectedRecommended.has(l.service_id))
    .reduce((a, l) => a + l.price_cents, 0);
  const estimatedTotal = essentialSubtotal + recommendedSubtotal + COURIER_FEE_CENTS;

  const isWaitlisted = status === "waitlisted";
  const proposalReady = status === "quote_ready" || status === "booked" || isWaitlisted;
  const alreadyBooked = status === "booked";
  const hasAnyServices = proposedServices.length > 0;

  const toggleRecommended = (sid: string) =>
    setSelectedRecommended((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      writeSelectedRecommended(id, next);
      return next;
    });

  // Each bag only gets its OWN tagged (essential + accepted recommended)
  // services here — not every service in the whole proposal — so two bags
  // with different services stay correctly associated all the way through
  // checkout (2026-10-01 fix; the flat "every bag gets every service" bug
  // predates per-bag tagging, back when there was only ever one shared
  // list). Untagged services (legacy proposals, or a bag with no stable id)
  // are attached to the first bag only, rather than duplicated onto every
  // bag — the common single-bag case is unaffected either way.
  const onAcceptAndCheckout = () => {
    if (alreadyBooked || !proposalReady) return;
    if (essentialAll.length + recommendedAll.length === 0) return;
    // For the MVP, one checkout corresponds to exactly one request (which
    // may contain multiple bags) — never a mix of two different requests'
    // items (2026-10-01 fix). The bag persists across navigation, so
    // without this, accepting request A then separately accepting request B
    // before paying for A would leave both A's and B's items in the same
    // cart, but the order can only carry ONE assessment_id (the backend
    // request-to-order link added this same pass) — whichever request's
    // acceptance set it last. The other request's items would still get
    // charged and fulfilled, but its own request row would never flip to
    // "booked", leaving it stuck showing as still-pending in My Repairs
    // even though it was already paid for. Clearing first guarantees the
    // cart only ever reflects this one request at checkout time — now
    // confirmed with the customer first if that would discard another
    // request's pending selections (see confirmClearIfOtherRequestPending).
    if (!confirmClearIfOtherRequestPending(id)) return;
    clear();
    const acceptedFor = (bagId: string | undefined, isFirst: boolean): BagService[] => {
      const tagged = proposedServices.filter((s) => s.pair_id === bagId);
      const extra = isFirst ? proposedServices.filter((s) => !s.pair_id) : [];
      return [...tagged, ...extra]
        .filter((s) => s.tier === "essential" || selectedRecommended.has(s.service_id))
        .map((l) => ({ id: l.service_id, name: l.name, price: l.price_cents }));
    };
    pairs.forEach((p, i) => {
      const label = pairs.length > 1 ? `Bag ${i + 1}` : "Your bag";
      const services = acceptedFor(p.id, i === 0);
      if (services.length === 0) return;
      addPair(services, undefined, label, p.shoeType as never, undefined, p.photoPaths?.[0], id);
    });
    navigate(`/checkout?assessment_id=${id}`);
  };

  // Complimentary path (2026-10-01, Item 4; pickup-before-confirmation added
  // 2026-10-02 per Danielle's call): skips Stripe/Checkout.tsx entirely —
  // the backend computes $0 pricing itself from the catalog (POST
  // /checkout/confirm-complimentary) — but still requires a real pickup
  // slot to be selected and successfully booked (same cal-book edge
  // function the paid flow uses) before the order is created. Nothing is
  // shown as confirmed, and nothing on the request is touched, until that
  // booking + order creation actually succeeds — if the slot turns out to
  // be unavailable, the catch block below surfaces that and the customer's
  // service selections (still only in local component state / the
  // request's own proposed_services) are completely untouched, so they can
  // just pick another time and try again.
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const onConfirmComplimentary = async () => {
    if (alreadyBooked || !proposalReady || confirmingComplimentary) return;
    if (essentialAll.length + recommendedAll.length === 0) return;
    if (!defaultAddress) {
      toast.error("Add a delivery address in your account before confirming.");
      return;
    }
    if (!complimentaryPickup) {
      toast.error("Choose a pickup time before confirming.");
      return;
    }
    setConfirmingComplimentary(true);
    try {
      const items = pairs.flatMap((p, i) => {
        const isFirst = i === 0;
        const tagged = proposedServices.filter((s) => s.pair_id === p.id);
        const extra = isFirst ? proposedServices.filter((s) => !s.pair_id) : [];
        return [...tagged, ...extra]
          .filter((s) => s.tier === "essential" || selectedRecommended.has(s.service_id))
          .map((s) => ({
            pair_snapshot: p,
            service_snapshot: { id: s.service_id, name: s.name },
            price_cents: s.price_cents,
          }));
      });
      const pickupAddress = [
        defaultAddress.street,
        defaultAddress.street2,
        defaultAddress.city,
        defaultAddress.state,
        defaultAddress.zip,
      ]
        .filter(Boolean)
        .join(", ");
      const { orderId } = await apiFetchJson<{ orderId: string }>(
        "/checkout/confirm-complimentary",
        {
          method: "POST",
          body: JSON.stringify({
            cartPayload: {
              assessment_id: id,
              contact_email: accountUser.email || user?.email,
              contact_phone: accountUser.phone,
              delivery_address: defaultAddress,
              pickup_window: {
                start: complimentaryPickup.start_time,
                end: complimentaryPickup.end_time,
                address: pickupAddress,
              },
              items,
            },
          }),
        },
      );
      navigate(`/repair/order/${orderId}`);
    } catch (e) {
      const message =
        e instanceof ApiError && typeof (e.body as { detail?: string })?.detail === "string"
          ? (e.body as { detail?: string }).detail!
          : "Could not confirm this complimentary repair. Try again.";
      toast.error(message);
    } finally {
      setConfirmingComplimentary(false);
    }
  };

  const meta = isClosedRequest(status)
    ? REQUEST_STATUS[status]
    : REQUEST_STATUS[status] ?? fallbackMeta(status);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col bg-white">
        <Header />
        <div className="flex-1 flex items-center justify-center py-20">
          <BrandSpinner />
        </div>
        <Footer />
      </main>
    );
  }
  if (error) {
    return (
      <main className="min-h-screen flex flex-col bg-white">
        <Header />
        <section className="flex-1 py-16">
          <div className="container max-w-2xl text-center">
            <p className="text-destructive">{error}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/account/orders">Back to My Repairs</Link>
            </Button>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  // Same reference format as the My Repairs card (Account.tsx) — "Repair
  // #..." on both, not "Request #..." (2026-10-01 rename).
  const ref = `Repair #${id.slice(0, 8).toUpperCase()}`;

  return (
    <PageShell refLabel={ref} meta={meta}>
      {/* Your bags */}
      <section className="mt-8">
        <h2 className="text-xl text-primary mb-3">Your bags</h2>
        <div className="space-y-4">
          {pairs.map((p, i) => {
            const thumbs = thumbsByPair[i] ?? [];
            const bagId = p.id;
            const taggedServices = bagId ? byPairId.get(bagId) ?? [] : [];
            const essential = taggedServices.filter((s) => s.tier === "essential");
            const recommended = taggedServices.filter((s) => s.tier === "recommended");
            const showReviewing = !hasAnyServices;
            const showNoneForThisBag = hasAnyServices && bagId && taggedServices.length === 0 && untagged.length === 0;
            return (
              <div key={bagId ?? i} className="rounded-xl border border-border p-5">
                <div className="flex items-start gap-4">
                  <BagThumbnail
                    src={thumbs[0] ?? null}
                    label={`Bag ${i + 1}`}
                    onClick={thumbs.length > 0 ? () => setLightboxPair(i) : undefined}
                  />
                  <div className="flex-1 min-w-0">
                    {/* 2026-10-01: the customer-entered description (legacy
                        item name, e.g. "Black loafers") is no longer shown
                        here — bags are identified by photo + "Bag N" only.
                        The data itself is untouched in storage. */}
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Bag {i + 1}</p>
                  </div>
                </div>

                {(essential.length > 0 || recommended.length > 0) && (
                  <div className="mt-4 space-y-3">
                    {essential.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          Recommended
                        </p>
                        <ul className="divide-y divide-border border border-border rounded-lg">
                          {essential.map((s) => (
                            <ServiceLine key={s.service_id} name={s.name} priceCents={s.price_cents} />
                          ))}
                        </ul>
                      </div>
                    )}
                    {recommended.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                          Nice to have
                        </p>
                        <ul className="divide-y divide-border border border-border rounded-lg">
                          {recommended.map((s) => {
                            const checked = selectedRecommended.has(s.service_id);
                            return (
                              <li key={s.service_id} className="p-3 flex items-center justify-between gap-4">
                                <label className="flex items-center gap-3 cursor-pointer flex-1 text-sm">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleRecommended(s.service_id)}
                                    disabled={alreadyBooked}
                                  />
                                  <span className="text-primary">{s.name}</span>
                                </label>
                                <span className="font-medium text-sm">
                                  {s.price_cents === 0 ? "Complimentary test repair" : formatPrice(s.price_cents)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {showReviewing && (
                  <p className="mt-4 text-sm text-muted-foreground">We're reviewing this bag.</p>
                )}
                {showNoneForThisBag && (
                  <p className="mt-4 text-sm text-muted-foreground">We're reviewing this bag.</p>
                )}

                <PhotoLightbox
                  open={lightboxPair === i}
                  onOpenChange={(open) => setLightboxPair(open ? i : null)}
                  photos={thumbs}
                  label={`Bag ${i + 1}`}
                />
              </div>
            );
          })}
        </div>

        {/* Services not tagged to a specific bag — legacy proposals, or a
            service that genuinely applies across bags. */}
        {untagged.length > 0 && (
          <div className="mt-4 rounded-xl border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Also recommended
            </p>
            <ul className="divide-y divide-border border border-border rounded-lg">
              {untagged.map((s) => (
                <ServiceLine key={s.service_id} name={s.name} priceCents={s.price_cents} />
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Pickup & Return */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-soft mt-8">
        <h2 className="text-lg font-semibold mb-4">Pickup &amp; Return</h2>
        {isClosedRequest(status) ? (
          <p className="text-sm text-muted-foreground">
            This request is closed, so there's nothing to pick up or return.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm font-medium mb-1">Pickup</p>
              <p className="text-sm text-foreground/80">
                {isWaitlisted
                  ? "Pickup scheduling will be available once we can accept your repair."
                  : "Choose your pickup when you confirm your repair, subject to availability."}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Return</p>
              <p className="text-sm text-foreground/80">
                Return scheduling will be available here when your repair is ready.
              </p>
            </div>
          </>
        )}
      </section>

      {/* Pricing */}
      {!isClosedRequest(status) && (
        <section className="mt-8 rounded-xl border border-border p-5">
          <h2 className="text-xl text-primary">Pricing</h2>
          {!hasAnyServices ? (
            <p className="mt-3 text-sm text-muted-foreground">Price pending assessment.</p>
          ) : (
            <>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Recommended repairs</dt>
                  {/* Only the real staff-set flag ever renders "Complimentary"
                      — a $0 essential subtotal on its own means the price
                      just hasn't been set, not that it's free (2026-10-01
                      fix: this previously inferred "complimentary" from
                      essentialSubtotal === 0, exactly the conflation
                      Danielle's spec called out). */}
                  <dd>
                    {complimentary
                      ? "Complimentary"
                      : essentialSubtotal === 0
                        ? "Price pending assessment"
                        : formatPrice(essentialSubtotal)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Nice-to-have add-ons</dt>
                  <dd>{complimentary ? "Complimentary" : formatPrice(recommendedSubtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Pickup &amp; return fee</dt>
                  <dd>{complimentary || COURIER_FEE_CENTS === 0 ? "Free" : formatPrice(COURIER_FEE_CENTS)}</dd>
                </div>
                {/* "Estimated" — nothing is charged yet and this can still
                    change before checkout, so this is never labeled "Total"
                    (2026-10-01 pricing-labeling rule). */}
                <div className="border-t border-border pt-3 flex justify-between font-semibold text-base">
                  <dt>Estimated total</dt>
                  <dd>{complimentary ? "$0.00" : formatPrice(estimatedTotal)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                {complimentary
                  ? "This repair is complimentary — nothing will be charged."
                  : "Nothing is charged yet — you'll pay at checkout, only once your repair is confirmed."}
              </p>
            </>
          )}
        </section>
      )}

      {proposalReady && !isClosedRequest(status) && (
        <div className="mt-8 flex flex-wrap gap-3">
          {isWaitlisted ? (
            // "Join the waitlist" used to be a button (onJoinWaitlist) that
            // only flipped local component state — nothing was ever saved,
            // so staff had no record of who'd actually "joined," and the
            // button implied an action that didn't exist (2026-10-02,
            // Danielle's call: remove/disable it until it truly persists —
            // see the written capacity report for the smallest real fix).
            // This is now a plain status message: the request already is
            // waitlisted (staff set that), selections are already saved in
            // proposed_services regardless of any click, and there's no
            // further action for the customer to take here.
            <p className="text-sm text-foreground/80">
              {/* "the moment a spot opens" (automated, real-time) was never
                  true — capacity isn't tracked anywhere yet, waitlisted is a
                  staff-set status with no trigger behind it, so there's no
                  process to promise that specific timing (2026-10-01 fix). */}
              Your selections are saved — we'll reach out as soon as we can take on your repair.
            </p>
          ) : complimentary ? (
            <div className="w-full space-y-4">
              {!alreadyBooked && (
                <div>
                  <h3 className="text-base font-medium mb-2">Choose a pickup time</h3>
                  <PickupScheduler selected={complimentaryPickup} onSelect={setComplimentaryPickup} />
                </div>
              )}
              <Button
                type="button"
                size="lg"
                onClick={onConfirmComplimentary}
                disabled={
                  alreadyBooked ||
                  confirmingComplimentary ||
                  !complimentaryPickup ||
                  essentialAll.length + recommendedAll.length === 0
                }
              >
                {alreadyBooked
                  ? "Already booked"
                  : confirmingComplimentary
                    ? "Confirming…"
                    : "Confirm complimentary repair"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="lg"
              onClick={onAcceptAndCheckout}
              disabled={alreadyBooked || essentialAll.length + recommendedAll.length === 0}
            >
              {alreadyBooked ? "Already booked" : "Continue to checkout"}
            </Button>
          )}
        </div>
      )}
    </PageShell>
  );
};

// ─── order (confirmed repair) view ─────────────────────────────────────────

type OrderPairSnapshot = {
  id?: string;
  label?: string | null;
  notes?: string | null;
  thumbnailPath?: string | null;
};

type OrderItemRow = {
  id: string;
  pair_snapshot: OrderPairSnapshot | null;
  service_snapshot: { id?: string; name?: string } | null;
  price_cents: number;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  contact_email: string | null;
  delivery_address: { street: string; street2?: string; city: string; state: string; zip: string } | null;
  repairs_subtotal_cents: number | null;
  courier_fee_cents: number | null;
  total_cents: number | null;
  order_items: OrderItemRow[];
  pickup_date: string | null;
  pickup_time_label: string | null;
  return_date: string | null;
  return_time_label: string | null;
  pickup_calendly_event_uri: string | null;
  return_calendly_event_uri: string | null;
  contact_phone: string | null;
};

const RepairDetailsOrder = ({ id }: { id: string }) => {
  const { user } = useAuth();
  const { user: accountUser } = useAccount();
  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState<"pickup" | "return" | null>(null);
  const [newWindow, setNewWindow] = useState<PickupWindow | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [lightboxPair, setLightboxPair] = useState<number | null>(null);

  usePageMeta({ title: "Repair details — Cobbli", description: "Review your confirmed repair, pickup and return." });

  const fetchOrder = useCallback(async () => {
    const query = supabase
      .from("orders")
      .select(
        "id,order_number,status,contact_email,delivery_address,repairs_subtotal_cents,courier_fee_cents,total_cents,order_items(id,pair_snapshot,service_snapshot,price_cents),pickup_date,pickup_time_label,return_date,return_time_label,pickup_calendly_event_uri,return_calendly_event_uri,contact_phone",
      )
      .eq("id", id);
    const { data, error: e } = await (user ? query.eq("user_id", user.id) : query).maybeSingle();
    if (e || !data) {
      setError(e?.message || "Repair not found");
      setLoading(false);
      return;
    }
    setOrder(data as unknown as OrderRow);
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Per-bag photo thumbnails — order_items' pair_snapshot.thumbnailPath is a
  // storage path in the same "assessment-uploads" bucket used throughout the
  // request flow (carried through at checkout, see BagContext.tsx).
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const bags = useMemo(() => {
    if (!order) return [] as { key: string; label: string; notes: string | null; thumbnailPath: string | null; services: { id: string; name: string; price: number }[] }[];
    const map = new Map<string, { key: string; label: string; notes: string | null; thumbnailPath: string | null; services: { id: string; name: string; price: number }[] }>();
    order.order_items.forEach((it, idx) => {
      const key = it.pair_snapshot?.id ?? `pair-${idx}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: it.pair_snapshot?.label || `Bag ${map.size + 1}`,
          notes: it.pair_snapshot?.notes ?? null,
          thumbnailPath: it.pair_snapshot?.thumbnailPath ?? null,
          services: [],
        });
      }
      map.get(key)!.services.push({
        id: it.service_snapshot?.id ?? it.id,
        name: it.service_snapshot?.name ?? "Service",
        price: it.price_cents,
      });
    });
    return [...map.values()];
  }, [order]);

  useEffect(() => {
    let cancelled = false;
    const paths = bags.map((b) => b.thumbnailPath).filter((p): p is string => !!p);
    if (paths.length === 0) return;
    (async () => {
      const entries = await Promise.all(
        paths.map(async (path) => {
          const { data } = await supabase.storage.from("assessment-uploads").createSignedUrl(path, 3600);
          return [path, data?.signedUrl] as const;
        }),
      );
      if (cancelled) return;
      setThumbUrls((prev) => {
        const next = { ...prev };
        for (const [p, u] of entries) if (u) next[p] = u;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [bags]);

  const doReschedule = useCallback(async () => {
    if (!newWindow || !rescheduleSlot || !order || !user) return;
    setRescheduling(true);
    try {
      const existingUri =
        rescheduleSlot === "pickup" ? order.pickup_calendly_event_uri : order.return_calendly_event_uri;
      let cancelWarning: string | null = null;
      if (existingUri) {
        const { data: cancelData, error: cancelError } = await supabase.functions.invoke("cal-cancel", {
          body: { event_uri: existingUri },
        });
        if (cancelError) {
          cancelWarning = "The previous booking couldn't be cancelled automatically — please cancel it in Calendly directly.";
        } else if (cancelData?.skipped) {
          cancelWarning = cancelData.reason ?? "The previous booking couldn't be cancelled automatically — please cancel it in Calendly directly.";
        }
      }
      const a = order.delivery_address;
      const addrParts = a ? [a.street, a.street2, `${a.city}, ${a.state} ${a.zip}`].filter(Boolean) : [];
      const { data: bookData, error: bookError } = await supabase.functions.invoke("calendly-book", {
        body: {
          start_time: newWindow.start_time,
          name: accountUser?.name || user.email,
          email: order.contact_email || user.email,
          phone: order.contact_phone || "",
          address: addrParts.join(", "),
          notes: `${rescheduleSlot === "pickup" ? "Pickup" : "Return"} scheduling — Order #${order.order_number}`,
        },
      });
      if (bookError) throw new Error(bookError.message);
      if (bookData?.error) throw new Error(bookData.error);

      const newDate = toNyDateKey(newWindow.start_time);
      const newLabel = formatNyTimeRange(newWindow.start_time, newWindow.end_time);
      const newEventUri: string | null = bookData?.event_uri ?? null;
      const updateFields: Record<string, string | null> =
        rescheduleSlot === "pickup"
          ? { pickup_date: newDate, pickup_time_label: newLabel, pickup_calendly_event_uri: newEventUri }
          : { return_date: newDate, return_time_label: newLabel, return_calendly_event_uri: newEventUri };
      const { error: updateError } = await supabase.from("orders").update(updateFields).eq("id", order.id).eq("user_id", user.id);
      if (updateError) throw new Error(updateError.message);

      setOrder((prev) => (prev ? { ...prev, ...updateFields } : prev));
      setRescheduleSlot(null);
      setNewWindow(null);
      if (cancelWarning) toast.warning(cancelWarning);
      if (bookData?.fallback) {
        toast.info("Your new time is saved. Complete the Calendly booking via the link in your email.");
      } else {
        toast.success(`${rescheduleSlot === "pickup" ? "Pickup" : "Return"} scheduled!`);
      }
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) ?? "Could not schedule. Please try again.");
    } finally {
      setRescheduling(false);
    }
  }, [newWindow, rescheduleSlot, order, user, accountUser]);

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col bg-white">
        <Header />
        <div className="flex-1 flex items-center justify-center py-20">
          <BrandSpinner />
        </div>
        <Footer />
      </main>
    );
  }
  if (error || !order) {
    return (
      <main className="min-h-screen flex flex-col bg-white">
        <Header />
        <section className="flex-1 py-16">
          <div className="container max-w-2xl text-center">
            <p className="text-destructive">{error ?? "Repair not found"}</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/account/orders">Back to My Repairs</Link>
            </Button>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  const meta = REPAIR_STATUS[order.status] ?? fallbackMeta(order.status);
  const closed = isClosedOrCanceledOrder(order.status);
  const pickedUp = isPickedUpOrLater(order.status);
  const readyForReturn = isReadyForReturnOrLater(order.status);
  const returned = isReturnedOrLater(order.status);
  const a = order.delivery_address;

  const repairsSubtotal = order.repairs_subtotal_cents ?? 0;
  const courierFee = order.courier_fee_cents ?? 0;
  const total = order.total_cents ?? 0;

  return (
    <PageShell refLabel={`Repair #${order.order_number}`} meta={meta}>
      {/* Your bags */}
      <section className="mt-8">
        <h2 className="text-xl text-primary mb-3">Your bags</h2>
        <div className="space-y-4">
          {bags.map((b, i) => {
            const url = b.thumbnailPath ? thumbUrls[b.thumbnailPath] : undefined;
            return (
              <div key={b.key} className="rounded-xl border border-border p-5">
                <div className="flex items-start gap-4">
                  <BagThumbnail src={url ?? null} label={`Bag ${i + 1}`} onClick={url ? () => setLightboxPair(i) : undefined} />
                  <div className="flex-1 min-w-0">
                    {/* 2026-10-01: legacy customer-entered bag notes/name no
                        longer shown in the customer-facing summary — data
                        untouched in storage. */}
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Bag {i + 1}</p>
                  </div>
                </div>
                <ul className="mt-4 divide-y divide-border border border-border rounded-lg">
                  {b.services.map((s) => (
                    <ServiceLine key={s.id} name={s.name} priceCents={s.price} />
                  ))}
                </ul>
                <PhotoLightbox
                  open={lightboxPair === i}
                  onOpenChange={(open) => setLightboxPair(open ? i : null)}
                  photos={url ? [url] : []}
                  label={`Bag ${i + 1}`}
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Pickup & Return */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-soft mt-8">
        <h2 className="text-lg font-semibold mb-4">Pickup &amp; Return</h2>

        {/* Pickup */}
        <div className="mb-5">
          <p className="text-sm font-medium mb-1">Pickup</p>
          {closed ? (
            order.pickup_date && order.pickup_time_label ? (
              <p className="text-sm text-foreground/80">
                Pickup was scheduled for {fmtDateKey(order.pickup_date)}, {order.pickup_time_label}.
              </p>
            ) : (
              <p className="text-sm text-foreground/80">This repair was canceled before pickup was scheduled.</p>
            )
          ) : pickedUp ? (
            <div>
              <p className="text-sm text-foreground/80">Picked up</p>
              {order.pickup_date && (
                <p className="text-xs text-muted-foreground mt-0.5">{fmtDateKey(order.pickup_date)}</p>
              )}
            </div>
          ) : order.pickup_date && order.pickup_time_label ? (
            <>
              {/* 2026-10-01: customer-facing rescheduling removed for the
                  MVP — once a pickup is booked, we show the details with no
                  edit action. Internal/admin tooling is unaffected. */}
              <div className="flex items-center gap-2 text-sm text-foreground/80">
                <Calendar size={14} className="shrink-0 text-primary" />
                <span>{fmtDateKey(order.pickup_date)}</span>
                <Clock size={14} className="shrink-0 text-primary" />
                <span>{order.pickup_time_label}</span>
              </div>
              {a && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Pickup address: {a.street}{a.street2 ? `, ${a.street2}` : ""}, {a.city}, {a.state} {a.zip}
                </p>
              )}
            </>
          ) : (
            <div>
              <div className="rounded-md bg-accent/30 border border-border p-3 flex items-start gap-2 text-sm">
                <MessageSquare size={15} className="mt-0.5 shrink-0 text-primary" />
                <span>Pickup not yet scheduled.</span>
              </div>
              <Button size="sm" className="mt-2" onClick={() => { setRescheduleSlot("pickup"); setNewWindow(null); }}>
                Schedule pickup
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Having trouble finding a time? Email{" "}
                <a href="mailto:support@cobbli.com" className="underline">support@cobbli.com</a> and we'll help coordinate.
              </p>
            </div>
          )}
        </div>

        {/* Return */}
        <div>
          <p className="text-sm font-medium mb-1">Return</p>
          {closed && !(order.return_date && order.return_time_label) ? (
            <p className="text-sm text-foreground/80">This repair was canceled.</p>
          ) : closed ? (
            <p className="text-sm text-foreground/80">
              Return was scheduled for {fmtDateKey(order.return_date!)}, {order.return_time_label}.
            </p>
          ) : returned ? (
            <div>
              <p className="text-sm text-foreground/80">Returned</p>
              {order.return_date && <p className="text-xs text-muted-foreground mt-0.5">{fmtDateKey(order.return_date)}</p>}
            </div>
          ) : order.return_date && order.return_time_label ? (
            <>
              {/* 2026-10-01: customer-facing rescheduling removed for the
                  MVP — once a return is booked, we show the details with no
                  edit action. Internal/admin tooling is unaffected. */}
              <div className="flex items-center gap-2 text-sm text-foreground/80">
                <Calendar size={14} className="shrink-0 text-primary" />
                <span>{fmtDateKey(order.return_date)}</span>
                <Clock size={14} className="shrink-0 text-primary" />
                <span>{order.return_time_label}</span>
              </div>
              {a && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Return address: {a.street}{a.street2 ? `, ${a.street2}` : ""}, {a.city}, {a.state} {a.zip}
                </p>
              )}
            </>
          ) : readyForReturn ? (
            <div>
              <p className="text-sm text-foreground/80 font-medium">Your repair is ready</p>
              <Button size="sm" className="mt-2" onClick={() => { setRescheduleSlot("return"); setNewWindow(null); }}>
                Schedule return
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Having trouble finding a time? Email{" "}
                <a href="mailto:support@cobbli.com" className="underline">support@cobbli.com</a> and we'll help coordinate.
              </p>
            </div>
          ) : (
            <p className="text-sm text-foreground/80">Return scheduling will be available here when your repair is ready.</p>
          )}
        </div>
      </section>

      {/* Pricing */}
      <section className="rounded-lg border border-border bg-card p-6 shadow-soft mt-8">
        <h2 className="text-lg font-semibold mb-4">Pricing</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Repairs</dt>
            <dd>{repairsSubtotal === 0 ? "Complimentary test repair" : formatPrice(repairsSubtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Pickup &amp; return fee</dt>
            <dd>{courierFee === 0 ? "Free" : formatPrice(courierFee)}</dd>
          </div>
          {/* This IS the complete charged amount, so "Total" is accurate
              here — unlike the request view's "Estimated total"
              (2026-10-01 pricing-labeling rule). */}
          <div className="border-t border-border pt-2 flex justify-between font-semibold text-base">
            <dt>Total</dt>
            <dd>{formatPrice(total)}</dd>
          </div>
        </dl>
      </section>

      {/* Initial scheduling dialog — reuses the existing PickupScheduler +
          Calendly book flow. 2026-10-01: this is now reachable only via
          "Schedule pickup"/"Schedule return" for a not-yet-booked
          appointment — customer-facing rescheduling of an existing booking
          has been removed, so this always represents a first booking. */}
      <Dialog open={!!rescheduleSlot} onOpenChange={(open) => { if (!open) { setRescheduleSlot(null); setNewWindow(null); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule your {rescheduleSlot}</DialogTitle>
            <DialogDescription>Select a window below.</DialogDescription>
          </DialogHeader>
          <PickupScheduler selected={newWindow} onSelect={setNewWindow} />
          <DialogFooter>
            <Button variant="ghost" disabled={rescheduling} onClick={() => { setRescheduleSlot(null); setNewWindow(null); }}>
              Cancel
            </Button>
            <Button variant="hero" disabled={!newWindow || rescheduling} onClick={doReschedule}>
              {rescheduling ? "Saving…" : "Confirm window"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

// ─── route entry ────────────────────────────────────────────────────────────

const RepairDetails = () => {
  const { kind, id } = useParams<{ kind: string; id: string }>();
  if (!id) return null;
  if (kind === "order") return <RepairDetailsOrder id={id} />;
  return <RepairDetailsRequest id={id} />;
};

export default RepairDetails;
