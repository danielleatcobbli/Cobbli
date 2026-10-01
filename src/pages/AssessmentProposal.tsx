import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/context/AuthContext";
import { useBag, formatPrice, type BagService } from "@/context/BagContext";
import { supabase } from "@/integrations/supabase/client";
import { apiFetchJson } from "@/integrations/api/client";
import { readSelectedRecommended, writeSelectedRecommended } from "@/lib/repairSelections";
import { Sparkles } from "lucide-react";

const COURIER_FEE_CENTS = 0;

type Pair = {
  /** Stable per-bag id, written by AssessmentUpload.tsx starting 2026-10-01
   *  — absent on older rows. Used to give each bag only its own tagged
   *  services at checkout (see onAcceptAndCheckout). */
  id?: string;
  shoeType?: string | null;
  colors?: string[];
  brand?: string | null;
  photoPaths?: string[];
  /** Per-item "what's going on with this bag?" note, added alongside
   *  multi-item submissions (2026-09-24) — AssessmentUpload.tsx now writes
   *  this per pair instead of one description for the whole assessment. */
  description?: string | null;
};

type ProposedService = {
  service_id: string;
  slug: string;
  name: string;
  price_cents: number;
  tier: "essential" | "recommended";
  /** Which bag this service applies to (assessments.pairs[].id) — added
   *  2026-10-01 so checkout carries each bag only its own services. Absent
   *  on proposals saved before that date. */
  pair_id?: string;
};

const AssessmentProposal = () => {
  // Supports two URL shapes:
  //   /start-repair/assessment/proposal/:id  (protected, UUID lookup)
  //   /proposal/:id                          (protected, UUID lookup)
  //   /proposal/t/:token                     (public,    proposal_token lookup)
  const { id: routeId, token } = useParams<{ id?: string; token?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addPair, clear, taggedAssessmentIds } = useBag();

  // Matches RepairDetails.tsx's confirmClearIfOtherRequestPending (2026-10-02)
  // — clear() below used to silently discard another request's not-yet-
  // checked-out selections. Now it asks first, rather than guessing or
  // dropping them unannounced.
  const confirmClearIfOtherRequestPending = (thisId: string): boolean => {
    const others = taggedAssessmentIds().filter((aid) => aid !== thisId);
    if (others.length === 0) return true;
    return window.confirm(
      "You have selections saved from another repair request that haven't been checked out yet. " +
        "Continuing will remove them from your cart — you can re-accept that request's recommendations later. Continue?",
    );
  };

  // The resolved assessment UUID — set after either lookup path completes.
  // All mutations (order insert, assessment update) use this rather than the
  // raw route param so the token-based path works identically to the id path.
  const [assessmentId, setAssessmentId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [proposedServices, setProposedServices] = useState<ProposedService[]>([]);
  const [status, setStatus] = useState<string>("");
  const [thumbsByPair, setThumbsByPair] = useState<string[][]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRecommended, setSelectedRecommended] = useState<Set<string>>(new Set());

  usePageMeta({
    title: "Your repair proposal — Cobbli",
    description: "Review your repair recommendations and continue to checkout.",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!routeId && !token) {
        setError("Missing proposal id or token");
        setLoading(false);
        return;
      }

      // Guest-access fix (2026-10-02, Item 3 follow-up): the token path used
      // to query Supabase directly as the anon/authenticated browser client,
      // which RLS tracing found silently returns zero rows for anyone who
      // isn't already signed in as the assessment's own owner or staff —
      // meaning this link never actually worked from a second device/
      // browser, guest or not. It now goes through a dedicated backend
      // endpoint (GET /public/proposal/:token) that looks the row up with
      // the service-role client — the token itself (a long random UUID) is
      // the only credential it trusts, same security model as a password-
      // reset link. The signed-in id path is unchanged; "Users view own
      // assessments" already scopes that correctly.
      if (token) {
        try {
          const data = await apiFetchJson<{
            id: string;
            pairs: Pair[];
            status: string;
            proposed_services: ProposedService[];
            photo_urls: Record<string, string>;
          }>(`/public/proposal/${token}`);
          if (cancelled) return;
          setAssessmentId(data.id);
          const ps = data.pairs ?? [];
          const services = data.proposed_services ?? [];
          setPairs(ps);
          setStatus(data.status);
          setProposedServices(services);
          setSelectedRecommended(
            readSelectedRecommended(data.id) ??
              new Set(services.filter((s) => s.tier === "recommended").map((s) => s.service_id)),
          );
          setThumbsByPair(
            ps.map((p) =>
              (p.photoPaths ?? []).slice(0, 4).map((path) => data.photo_urls[path]).filter(Boolean),
            ),
          );
        } catch {
          if (!cancelled) setError("Proposal not found");
        }
        if (!cancelled) setLoading(false);
        return;
      }

      const { data, error: e } = await supabase
        .from("assessments")
        .select("id, pairs, status, proposed_services")
        .eq("id", routeId!)
        .maybeSingle();
      if (cancelled) return;
      if (e || !data) {
        setError(e?.message || "Proposal not found");
        setLoading(false);
        return;
      }

      setAssessmentId(data.id as string);

      const ps = (data.pairs as unknown as Pair[]) ?? [];
      const services = (data.proposed_services as unknown as ProposedService[]) ?? [];
      setPairs(ps);
      setStatus(data.status);
      setProposedServices(services);
      // Restore a saved-this-visit selection if there is one; otherwise
      // pre-select all recommended by default (original behavior).
      setSelectedRecommended(
        readSelectedRecommended(data.id as string) ??
          new Set(services.filter((s) => s.tier === "recommended").map((s) => s.service_id)),
      );

      const all: string[][] = [];
      for (const p of ps) {
        const out: string[] = [];
        for (const path of (p.photoPaths ?? []).slice(0, 4)) {
          const { data: s } = await supabase.storage
            .from("assessment-uploads")
            .createSignedUrl(path, 3600);
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
  }, [routeId, token]);

  const essential = useMemo(
    () => proposedServices.filter((s) => s.tier === "essential"),
    [proposedServices],
  );
  const recommended = useMemo(
    () => proposedServices.filter((s) => s.tier === "recommended"),
    [proposedServices],
  );

  const essentialSubtotal = essential.reduce((a, l) => a + l.price_cents, 0);
  const recommendedSubtotal = recommended
    .filter((l) => selectedRecommended.has(l.service_id))
    .reduce((a, l) => a + l.price_cents, 0);
  const repairsSubtotal = essentialSubtotal + recommendedSubtotal;
  // No deposit structure (2026-09-24, Danielle's call) — nothing is charged
  // until checkout, so this is a plain estimate, not "due today."
  const estimatedTotal = repairsSubtotal + COURIER_FEE_CENTS;

  // "quote_ready" is the value written by mark_quote_ready; "booked" is set
  // after the customer approves via this page. "proposal_sent" was the old value
  // and is no longer written anywhere live.
  //
  // "waitlisted" (2026-09-24, Danielle's call) has no staff-facing trigger
  // yet — nothing in Admin.tsx or AdminOrderDetail.tsx can set an assessment
  // to this status today. This branch is built so the customer-facing side
  // is ready; wiring a real "Waitlist" action into staff tooling is backend
  // work (needs its own RPC, same shape as mark_quote_ready). Until then,
  // reaching this branch requires setting the status by hand.
  const isWaitlisted = status === "waitlisted";
  const proposalReady = status === "quote_ready" || status === "booked" || isWaitlisted;
  const alreadyBooked = status === "booked";

  const toggleRecommended = (sid: string) =>
    setSelectedRecommended((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      if (assessmentId) writeSelectedRecommended(assessmentId, next);
      return next;
    });

  // Accepted proposals go to the real Checkout experience — no in-page
  // payment here (2026-09-24, Danielle's call: "only pay if the order's been
  // accepted," and no deposit structure). This just loads the accepted
  // services into the cart and hands off; Checkout.tsx collects pickup +
  // payment (guests included — see Checkout.tsx guest-checkout changes).
  //
  // Known gap: nothing here marks the assessment as accepted/consumed, so
  // this page stays clickable (re-adds to the bag) if revisited — there's no
  // "accepted" status wired into the assessment status machine yet (that's
  // part of the backend rework in task #124).
  // Each bag gets only its OWN tagged services here, not every service in
  // the whole proposal (2026-10-01 fix, alongside per-bag service tagging in
  // Admin.tsx) — otherwise two bags with different services would both end
  // up with every service duplicated onto them at checkout. Untagged
  // services (proposals saved before 2026-10-01, or a bag with no stable id)
  // attach to the first bag only, so the common single-bag case is
  // unaffected.
  const onAcceptAndCheckout = () => {
    if (!assessmentId || alreadyBooked || !proposalReady) return;
    if (essential.length + recommended.length === 0) return;

    // One checkout = one request for the MVP (2026-10-01 fix) — see the
    // matching comment in RepairDetails.tsx's onAcceptAndCheckout for why
    // this has to happen before adding this request's own items. Confirmed
    // with the customer first (2026-10-02) if it would discard another
    // request's pending selections.
    if (!confirmClearIfOtherRequestPending(assessmentId)) return;
    clear();

    const acceptedFor = (bagId: string | undefined, isFirst: boolean): BagService[] => {
      const tagged = proposedServices.filter((s) => s.pair_id === bagId);
      const extra = isFirst ? proposedServices.filter((s) => !s.pair_id) : [];
      return [...tagged, ...extra]
        .filter((s) => s.tier === "essential" || selectedRecommended.has(s.service_id))
        .map((l) => ({ id: l.service_id, name: l.name, price: l.price_cents }));
    };

    // Label is just an ordinal fallback for contexts that need plain text
    // (e.g. a screen reader, or before the thumbnail has loaded) — the real
    // identifier customers and staff see is each item's first photo
    // (thumbnailPath), not a customer-authored name (2026-09-24, Danielle's
    // call: don't ask customers to name their items).
    pairs.forEach((p, i) => {
      const label = pairs.length > 1 ? `Item ${i + 1}` : "Your item";
      const thumbnailPath = p.photoPaths?.[0];
      const services = acceptedFor(p.id, i === 0);
      if (services.length === 0) return;
      addPair(services, undefined, label, p.shoeType as never, undefined, thumbnailPath, assessmentId);
    });

    // Carries the source assessment through to the order (see Checkout.tsx
    // and the stripe-webhook cart handler) so staff can trace an order back
    // to its photos/request — 2026-09-24, Danielle's call.
    navigate(`/checkout?assessment_id=${assessmentId}`);
  };

  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />
      <section className="flex-1 py-10 md:py-14">
        <div className="container max-w-3xl">
          {loading ? (
            <BrandSpinner className="py-16" size="lg" />
          ) : error ? (
            <div className="rounded-xl border border-border p-6">
              <p className="text-destructive">{error}</p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/account">Back to account</Link>
              </Button>
            </div>
          ) : status === "declined" ? (
            <div className="rounded-xl border border-border p-10 text-center">
              <p className="text-2xl text-primary mb-2">Proposal declined</p>
              <p className="text-muted-foreground">
                Unfortunately we weren't able to take on this repair. You should have received an
                email from us explaining why. If you have questions, please reach out to{" "}
                <a href="mailto:support@cobbli.com" className="underline">
                  support@cobbli.com
                </a>
                .
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/account">Back to account</Link>
              </Button>
            </div>
          ) : status === "needs_more_info" ? (
            <div className="rounded-xl border border-border p-10 text-center">
              <p className="text-2xl text-primary mb-2">We need a bit more info</p>
              <p className="text-muted-foreground">
                Our cobblers have a question before they can finalize your proposal. Check your
                inbox — we've sent you an email with the details. Once you reply, we'll have your
                proposal ready within 1&nbsp;–&nbsp;2 business days.
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/account">Back to account</Link>
              </Button>
            </div>
          ) : !proposalReady ? (
            <div className="rounded-xl border border-border p-10 text-center">
              <p className="text-2xl text-primary mb-2">
                Your proposal isn't ready yet
              </p>
              <p className="text-muted-foreground">
                Our cobblers are reviewing your photos and will email you when the proposal is ready
                (usually within 1&nbsp;–&nbsp;2 business days).
              </p>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/account">Back to account</Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Amber banner */}
              <div
                className="rounded-xl p-5 md:p-6 flex items-start gap-3"
                style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
              >
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
                >
                  <Sparkles size={20} />
                </div>
                <div>
                  <h1 className="font-display text-2xl md:text-3xl text-primary">
                    {isWaitlisted ? "Here's what we recommend" : "Your repair proposal is ready"}
                  </h1>
                  <p className="mt-1 text-sm md:text-base text-primary/80">
                    {isWaitlisted
                      ? "We're at capacity right now. Review your recommendations below — we'll reach out as soon as we can take on your repair."
                      : "Our cobblers have reviewed your photos. Review your recommendations below, then continue to checkout to schedule pickup and pay."}
                  </p>
                </div>
              </div>

              {alreadyBooked && (
                <div className="mt-4 rounded-md border border-border bg-secondary/50 p-3 text-sm text-primary">
                  This proposal has already been approved.
                </div>
              )}

              {/* Item identifiers — each item's own first photo is the
                  identifier, shown larger than the rest of its thumbnails
                  (2026-09-24, Danielle's call: don't ask customers to name
                  items; use the first photo they uploaded instead — a name
                  field doesn't scale well past a couple of items and photos
                  are unambiguous). "Item N" is just an ordinal, only shown
                  when there's more than one item to disambiguate. */}
              <div className="mt-8 space-y-4">
                {pairs.map((p, i) => {
                  const thumbs = thumbsByPair[i] ?? [];
                  const [firstThumb, ...restThumbs] = thumbs;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-border p-5 flex items-start gap-4"
                    >
                      {firstThumb ? (
                        <img
                          src={firstThumb}
                          alt={pairs.length > 1 ? `Item ${i + 1}` : "Your item"}
                          className="h-16 w-16 rounded-lg object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-secondary/50 border border-border shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {pairs.length > 1 && (
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Item {i + 1}
                          </p>
                        )}
                        {p.description && (
                          <p className="mt-1 text-sm text-primary/90">{p.description}</p>
                        )}
                        {restThumbs.length > 0 && (
                          <div className="mt-2 flex gap-2">
                            {restThumbs.map((src, j) => (
                              <img
                                key={j}
                                src={src}
                                alt={`Additional photo ${j + 2}`}
                                className="h-10 w-10 rounded-md object-cover border border-border"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Essential services */}
              <section className="mt-8">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xl text-primary">Recommended</h2>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Included
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  These repairs are recommended to restore your bag properly.
                </p>
                {essential.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
                    No services proposed.
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-border border border-border rounded-lg">
                    {essential.map((s) => (
                      <li key={s.service_id} className="p-4 flex items-center justify-between gap-4">
                        <span className="text-primary">{s.name}</span>
                        <span className="font-medium">
                          {formatPrice(s.price_cents)}
                          {pairs.length > 1 ? <span className="text-xs text-muted-foreground"> /pair</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Recommended services */}
              <section className="mt-8">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-xl text-primary">Nice to have</h2>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Optional
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Extra touches our cobblers suggest. Tick to include in your order.
                </p>
                {recommended.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
                    No optional add-ons proposed.
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-border border border-border rounded-lg">
                    {recommended.map((s) => {
                      const checked = selectedRecommended.has(s.service_id);
                      return (
                        <li
                          key={s.service_id}
                          className="p-4 flex items-center justify-between gap-4"
                        >
                          <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleRecommended(s.service_id)}
                              disabled={alreadyBooked}
                            />
                            <span className="text-primary">{s.name}</span>
                          </label>
                          <span className="font-medium">
                            {formatPrice(s.price_cents)}
                            {pairs.length > 1 ? <span className="text-xs text-muted-foreground"> /pair</span> : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              {/* Order summary */}
              <section className="mt-8 rounded-xl border border-border p-5">
                <h2 className="text-xl text-primary">Order summary</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Recommended repairs</dt>
                    <dd>{formatPrice(essentialSubtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Nice-to-have add-ons</dt>
                    <dd>{formatPrice(recommendedSubtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery & pickup</dt>
                    <dd>{COURIER_FEE_CENTS === 0 ? "Free" : formatPrice(COURIER_FEE_CENTS)}</dd>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-semibold text-base">
                    <dt>Estimated total</dt>
                    <dd>{formatPrice(estimatedTotal)}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  Nothing is charged yet — you'll pay at checkout, only once your order is
                  confirmed.
                </p>
              </section>

              <div className="mt-8 flex flex-wrap gap-3">
                {user && (
                  <Button asChild variant="outline">
                    <Link to="/account">Back to account</Link>
                  </Button>
                )}
                {isWaitlisted ? (
                  // "Join the waitlist" used to be a button that only flipped
                  // local state — nothing was ever saved, so it implied an
                  // action that didn't exist (2026-10-02, Danielle's call:
                  // remove/disable until it truly persists). This request
                  // already is waitlisted (staff set that) and the
                  // recommendations above are already saved regardless of
                  // any click, so there's nothing left for the customer to
                  // do here but wait to hear back.
                  <p className="text-sm text-foreground/80">
                    We've saved your selections — we'll reach out as soon as we can take on your repair.
                  </p>
                ) : (
                  // Guests can accept and check out too — no sign-in gate
                  // (2026-09-24, Danielle: "guest checkout... let's make it
                  // exist"). Takes them to the real Checkout experience;
                  // nothing is charged on this page.
                  <Button
                    type="button"
                    size="lg"
                    onClick={onAcceptAndCheckout}
                    disabled={alreadyBooked || essential.length + recommended.length === 0}
                    className={
                      alreadyBooked || essential.length + recommended.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }
                  >
                    {alreadyBooked ? "Already booked" : "Continue to checkout"}
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {isWaitlisted
                  ? "No action needed — we'll reach out when we can take on your repair."
                  : "No sign-in needed — you'll enter payment and schedule pickup at checkout."}{" "}
                Questions? Email{" "}
                <a href="mailto:support@cobbli.com" className="underline">
                  support@cobbli.com
                </a>
                .
              </p>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default AssessmentProposal;
