import RepairCheckout, { addressComplete, contactComplete, type CheckoutDetails } from "@/components/cobbli/repair/RepairCheckout";
import { useServiceableZips } from "@/hooks/useServiceableZips";
import RecommendationReview from "@/components/cobbli/repair/RecommendationReview";
import RepairResponse from "@/components/cobbli/repair/RepairResponse";
import { repairResponseTransport } from "@/lib/repairResponse";
import { normalizeRecommendations, toggleRecommendation, initialRecommendationSelection, type Recommendation } from "@/lib/recommendations";
import { PAYMENTS_ENABLED } from "@/lib/pilot";
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
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
  refLabel: string;
  meta: { label: string; pill: string; next: string };
  children: React.ReactNode;
}) => (
  <main className="min-h-screen flex flex-col bg-white">
    <Header />
    <section className="flex-1 py-10 md:py-14">
      <div className={cn("container", title ? "max-w-6xl" : "max-w-3xl")}>
        <Link to="/account/orders" className="mb-5 inline-block text-sm text-primary underline underline-offset-4">← My Repairs</Link>
        {title ? <>
          <div className="flex flex-wrap items-center gap-3 text-sm"><span>{refLabel}</span><span className="rounded-full bg-[#fff4d5] px-3 py-1 text-primary">{meta.label}</span></div>
          <h1 className="mt-5 font-display text-3xl font-bold uppercase leading-tight text-primary sm:text-4xl lg:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
        </> : <>
          <h1 className="font-display text-2xl font-bold uppercase text-primary md:text-3xl">{refLabel}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3"><span className={cn("rounded-full px-3 py-1 text-sm font-semibold", meta.pill)}>{meta.label}</span>{meta.next && <span className="text-sm text-foreground/80">{meta.next}</span>}</div>
        </>}

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

type ConfirmedRepair = {
  id: string; order_number: string; status: string; pickup_date: string | null; pickup_time_label: string | null;
  return_date: string | null; return_time_label: string | null;
  order_items: { service_snapshot: { name?: string }; pair_snapshot: { id?: string } }[];
};

type ReqPair = {
  id?: string;
  photoPaths?: string[];
  description?: string | null;
  shoeType?: string | null;
};

type ReqProposedService = Recommendation & {
  service_id: string;
  slug: string;
  name: string;
  price_cents: number;
  tier: "essential" | "recommended" | "optional";
  pair_id?: string;
};

export const RepairDetailsRequest = ({ id, token }: { id: string; token?: string }) => {
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

  const coverageQuery = useServiceableZips();
  const [requestContact, setRequestContact] = useState({email:"", zip:""});
  const [showPickup, setShowPickup] = useState(false);
  const responseTransport = useMemo(() => repairResponseTransport(id, token), [id, token]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<ReqPair[]>([]);
  const [revision, setRevision] = useState("");
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
      setLoading(true);
      setShowPickup(false);
      setComplimentaryPickup(null);
      setError(null);
      const result = token
        ? await apiFetchJson<{ id: string; pairs: ReqPair[]; status: string; proposed_services: ReqProposedService[]; complimentary: boolean; updated_at: string; photo_urls: Record<string,string>; confirmed_order?: ConfirmedRepair }>(`/public/proposal/${token}`).then(data => ({ data, error: null }))
        : await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
      const { data, error: e } = result;
      if (cancelled) return;
      if (e || !data) {
        setError(e?.message || "Repair request not found");
        setLoading(false);
        return;
      }
      const ps = (data.pairs as unknown as ReqPair[]) ?? [];
      const services = normalizeRecommendations((data.proposed_services as unknown as ReqProposedService[]) ?? []);
      setRequestContact({email: String((data as {guest_email?: string}).guest_email || ""), zip: String((data as {guest_zip?: string}).guest_zip || "")});
      setPairs(ps);
      setStatus(data.status);
      setProposedServices(services);
      setRevision(data.updated_at);
      setComplimentary(Boolean((data as { complimentary?: boolean }).complimentary));
      // Restore this visit’s choices, including an explicitly empty selection.
      // New reviews preselect one option per problem; this is not approval.
      const saved = readSelectedRecommended(`${id}:${data.updated_at}`);
      setSelectedRecommended(
        initialRecommendationSelection(services, saved),
      );
      if ("confirmed_order" in data && data.confirmed_order) setConfirmedOrder(data.confirmed_order);
      const all: string[][] = [];
      for (const p of ps) {
        const out: string[] = [];
        for (const path of (p.photoPaths ?? []).slice(0, 12)) {
          if (token && "photo_urls" in data) {
            if (data.photo_urls[path]) out.push(data.photo_urls[path]);
          } else {
            const { data: signed } = await supabase.storage.from("assessment-uploads").createSignedUrl(path, 3600);
            if (signed?.signedUrl) out.push(signed.signedUrl);
          }
        }
        all.push(out);
      }
      if (!cancelled) setThumbsByPair(all);
      setLoading(false);
    })().catch(() => { if (!cancelled) { setError("We couldn't load your repair. Please refresh and try again."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id, token]);

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

  const selectedLines = proposedServices.filter(l => selectedRecommended.has(l.recommendation_id!));
  const essentialAll = selectedLines.filter(l => l.tier === "essential");
  const recommendedAll = selectedLines.filter(l => l.tier !== "essential");
  const essentialSubtotal = essentialAll.reduce((total, l) => total + l.price_cents, 0);
  const recommendedSubtotal = recommendedAll.reduce((total, l) => total + l.price_cents, 0);
  const estimatedTotal = essentialSubtotal + recommendedSubtotal + COURIER_FEE_CENTS;

  const isWaitlisted = status === "waitlisted";
  const alreadyBooked = status === "booked";

  const toggleRecommended = (sid: string) => setSelectedRecommended(prev => {
    const next = toggleRecommendation(proposedServices, prev, sid);
    writeSelectedRecommended(`${id}:${revision}`, next);
    return next;
  });

  const onAcceptAndCheckout = () => {
    if (alreadyBooked || status !== "quote_ready") return;
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
        .filter((s) => selectedRecommended.has(s.recommendation_id!))
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
  const savedAddress = addresses.find((a) => a.isDefault) ?? addresses[0];
  const [contactDraft, setContactDraft] = useState<Record<string,string>>({});
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedRepair | null>(null);
  const contact = { name: token ? "" : accountUser.name || "", email: requestContact.email || accountUser.email || user?.email || "", phone: token ? "" : accountUser.phone || "", ...contactDraft };
  const defaultAddress = { street: "", street2: "", city: "New York", state: "NY", zip: requestContact.zip,
    ...Object.fromEntries(Object.entries(contactDraft).filter(([key]) => ["street","street2","city","state","zip"].includes(key))) };
  const checkoutValues = { ...contact, ...defaultAddress } as CheckoutDetails;
  const coverage = coverageQuery.isServiceable(defaultAddress.zip);
  const changeCheckoutField = (key: keyof CheckoutDetails, value: string) => {
    setContactDraft(prev => ({...prev, [key]: value}));
    if (["street","street2","city","state","zip"].includes(key)) setComplimentaryPickup(null);
  };


  const onConfirmComplimentary = async () => {
    if (alreadyBooked || status !== "quote_ready" || confirmingComplimentary || (pairs.length > 1 && untagged.length > 0)) return;
    if (essentialAll.length + recommendedAll.length === 0) return;
    if (!contactComplete(checkoutValues) || !addressComplete(checkoutValues) || coverage !== true) {
      toast.error("Please complete your contact details and pickup address.");
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
          .filter((s) => selectedRecommended.has(s.recommendation_id!))
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
              proposal_token: token,
              recommendation_revision: revision,
              selected_recommendation_ids: [...selectedRecommended],
              contact_name: contact.name,
              contact_email: contact.email,
              contact_phone: contact.phone,
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
      if (token) {
        setStatus("booked");
        const updated = await apiFetchJson<{ confirmed_order: typeof confirmedOrder }>(`/public/proposal/${token}`);
        setConfirmedOrder(updated.confirmed_order);
      } else navigate(`/repair/order/${orderId}`);
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

  if (alreadyBooked && token && confirmedOrder) {
    return <RepairDetailsOrder id={confirmedOrder.id} token={token} />;
  }

  // Same reference format as the My Repairs card (Account.tsx) — "Repair
  // #..." on both, not "Request #..." (2026-10-01 rename).
  const ref = `Repair #${id.slice(0, 8).toUpperCase()}`;

  const hasUnassignedServices = (pairs.length > 1 && untagged.length > 0) || proposedServices.some(line => line.pair_id && !pairs.some(bag => bag.id === line.pair_id));
  const reviewBags = pairs.map((bag, index) => ({
    id: bag.id, label: `Bag ${index + 1}`, photo: thumbsByPair[index]?.[0],
    lines: [...(bag.id ? byPairId.get(bag.id) || [] : []), ...(pairs.length === 1 ? untagged : [])],
  }));

  if (status === "needs_more_info") return <PageShell refLabel={ref} meta={meta}
    title="A closer look, please" subtitle="A little more detail will help us recommend the right fixes.">
    <RepairResponse key={id} transport={responseTransport} bags={reviewBags} />
  </PageShell>;

  if (showPickup && complimentary && status === "quote_ready") return <PageShell refLabel={ref} meta={meta}
    title="Confirm your repair" subtitle="Add your pickup details, choose a time, and you’re all set.">
    <RepairCheckout values={checkoutValues} onChange={changeCheckoutField} coverage={coverage}
      coverageError={coverageQuery.isError} onRetryCoverage={() => { void coverageQuery.refetch(); }}
      bags={reviewBags} selected={selectedRecommended} pickup={complimentaryPickup}
      scheduler={<PickupScheduler selected={complimentaryPickup} onSelect={setComplimentaryPickup} />}
      busy={confirmingComplimentary} onConfirm={onConfirmComplimentary} onEdit={() => setShowPickup(false)}
      savedAddress={!token && savedAddress ? `${savedAddress.street}, ${savedAddress.zip}` : undefined}
      onUseSavedAddress={() => { if (savedAddress) { setContactDraft(prev => ({...prev, street:savedAddress.street, street2:savedAddress.street2 || "", city:savedAddress.city, state:savedAddress.state, zip:savedAddress.zip})); setComplimentaryPickup(null); } }} />
  </PageShell>;

  if (status === "quote_ready" || isWaitlisted) return <PageShell refLabel={ref} meta={meta}
    title="Review your recommendations"
    subtitle="We’ve selected our suggested repairs. Uncheck anything you’d like to skip.">
    <RecommendationReview bags={reviewBags} selected={selectedRecommended} onToggle={toggleRecommended}
      complimentary={complimentary} disabled={confirmingComplimentary || isWaitlisted}
      canContinue={status === "quote_ready" && selectedLines.length > 0 && pairs.length > 0 && !hasUnassignedServices && (complimentary || PAYMENTS_ENABLED)}
      onContinue={() => {
        if (status !== "quote_ready" || !selectedLines.length || hasUnassignedServices) return;
        writeSelectedRecommended(`${id}:${revision}`, selectedRecommended);
        if (complimentary) { setShowPickup(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
        else if (PAYMENTS_ENABLED) onAcceptAndCheckout();
      }}
      onEdit={() => setShowPickup(false)} onPhoto={setLightboxPair}
      notice={isWaitlisted ? "Your request is on hold for capacity. We’ll contact you about next steps."
        : hasUnassignedServices ? "Some recommendations need a bag assigned. Please contact us before confirming."
        : !complimentary && !PAYMENTS_ENABLED ? "Online confirmation isn’t available for this request yet. Please email us for help." : undefined}
      />
    {pairs.map((bag, index) => <PhotoLightbox key={bag.id || index} open={lightboxPair === index}
      onOpenChange={open => setLightboxPair(open ? index : null)} photos={thumbsByPair[index] || []} label={`Bag ${index + 1}`} />)}
  </PageShell>;

  return <PageShell refLabel={ref} meta={meta}>
    <section className="mt-8 space-y-4">
      <h2 className="font-display text-2xl text-primary">Your bags</h2>
      {pairs.map((bag, index) => <div key={bag.id || index} className="flex items-center gap-4 rounded-xl border p-5">
        <BagThumbnail src={thumbsByPair[index]?.[0] || null} label={`Bag ${index + 1}`}
          onClick={thumbsByPair[index]?.length ? () => setLightboxPair(index) : undefined} />
        <span>Bag {index + 1}</span>
        <PhotoLightbox open={lightboxPair === index} onOpenChange={open => setLightboxPair(open ? index : null)} photos={thumbsByPair[index] || []} label={`Bag ${index + 1}`} />
      </div>)}
      <p className="text-sm text-muted-foreground">{isClosedRequest(status) ? "This request is closed." : alreadyBooked ? "Your repair is confirmed. You can find its details in My Repairs." : "We’re reviewing your request. Your recommendations will appear here when they’re ready."}</p>
    </section>
  </PageShell>;
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

export const RepairDetailsOrder = ({ id, token }: { id: string; token?: string }) => {
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
    if (token) {
      try {
        const data = await apiFetchJson<{ confirmed_order: OrderRow | null }>(`/public/proposal/${encodeURIComponent(token)}`);
        if (!data.confirmed_order || data.confirmed_order.id !== id) throw new Error("Repair not found");
        setOrder(data.confirmed_order); setError(null);
      } catch { setError("We couldn't load your repair. Please contact us."); }
      setLoading(false); return;
    }
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
  }, [id, user, token]);

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
    if (!newWindow || !rescheduleSlot || !order || (!user && !token)) return;
    setRescheduling(true);
    try {
      const existingUri =
        rescheduleSlot === "pickup" ? order.pickup_calendly_event_uri : order.return_calendly_event_uri;
      if (existingUri) throw new Error("This appointment is already scheduled. Please contact us to make changes.");
      const updateFields = await apiFetchJson<Partial<NonNullable<typeof order>>>(`/checkout/schedule/${order.id}`, {
        method: "POST",
        body: JSON.stringify({ proposal_token: token, kind: rescheduleSlot, start: newWindow.start_time, end: newWindow.end_time }),
      });

      setOrder((prev) => (prev ? { ...prev, ...updateFields } : prev));
      setRescheduleSlot(null);
      setNewWindow(null);
      toast.success(`${rescheduleSlot === "pickup" ? "Pickup" : "Return"} scheduled!`);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : null) ?? "Could not schedule. Please try again.");
    } finally {
      setRescheduling(false);
    }
  }, [newWindow, rescheduleSlot, order, user, accountUser, token]);

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
