import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { formatPrice } from "@/context/BagContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, Sparkles } from "lucide-react";

const DEPOSIT_CENTS = 2000;
const COURIER_FEE_CENTS = 0;

type Pair = {
  shoeType?: string | null;
  colors?: string[];
  brand?: string | null;
  photoPaths?: string[];
  deposit?: {
    amount_cents: number;
    currency: string;
    status: string;
    payment_intent_id: string;
  };
};

type ProposedService = {
  service_id: string;
  slug: string;
  name: string;
  price_cents: number;
  tier: "essential" | "recommended";
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const AssessmentProposal = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { user: accountUser, addresses, paymentMethods, addOrder } = useAccount();

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
    description: "Review your repair proposal, approve, and pay the remaining balance.",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setError("Missing proposal id");
        setLoading(false);
        return;
      }
      const { data, error: e } = await supabase
        .from("assessments")
        .select("id, pairs, status, proposed_services")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (e || !data) {
        setError(e?.message || "Proposal not found");
        setLoading(false);
        return;
      }
      const ps = (data.pairs as unknown as Pair[]) ?? [];
      const services = (data.proposed_services as unknown as ProposedService[]) ?? [];
      setPairs(ps);
      setStatus(data.status);
      setProposedServices(services);
      // Pre-select all recommended by default
      setSelectedRecommended(
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
  }, [id]);

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
  const depositHeld = pairs.length * DEPOSIT_CENTS;
  const totalDueToday = Math.max(0, repairsSubtotal + COURIER_FEE_CENTS - depositHeld);

  const proposalReady = status === "proposal_sent" || status === "booked";
  const alreadyBooked = status === "booked";

  const toggleRecommended = (sid: string) =>
    setSelectedRecommended((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });

  const onApprove = async () => {
    if (!id || !user || submitting || alreadyBooked || !proposalReady) return;
    if (essential.length + recommended.length === 0) return;
    setSubmitting(true);
    try {
      const acceptedServices: ProposedService[] = [
        ...essential,
        ...recommended.filter((r) => selectedRecommended.has(r.service_id)),
      ];

      // (1) Mock capture of each pair's pi_mock_... PaymentIntent already on the assessment.
      const updatedPairs = pairs.map((p, i) => ({
        ...p,
        deposit: {
          amount_cents: p.deposit?.amount_cents ?? DEPOSIT_CENTS,
          currency: p.deposit?.currency ?? "usd",
          status: "captured" as const,
          payment_intent_id:
            p.deposit?.payment_intent_id ?? `pi_mock_${Date.now()}_${i}`,
          captured_at: new Date().toISOString(),
        },
      }));

      await wait(600); // simulate Stripe round-trips

      // (2) Create the order record in Supabase.
      const address = addresses[0];
      const pm = paymentMethods[0];
      const { data: orderRow, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          status: "placed",
          delivery_method: "door-to-door",
          delivery_address: (address as unknown as never) ?? null,
          contact_email: user.email ?? accountUser.email,
          contact_phone: accountUser.phone ?? "",
          payment_method_snapshot: pm
            ? ({ brand: pm.brand, last4: pm.last4 } as unknown as never)
            : null,
          repairs_subtotal_cents: repairsSubtotal,
          courier_fee_cents: COURIER_FEE_CENTS,
          tax_cents: 0,
          total_cents: repairsSubtotal + COURIER_FEE_CENTS,
        })
        .select("id")
        .single();
      if (orderErr) throw orderErr;

      const itemRows = pairs.flatMap((p) =>
        acceptedServices.map((l) => ({
          order_id: orderRow.id,
          pair_snapshot: p as unknown as never,
          service_snapshot: {
            id: l.service_id,
            slug: l.slug,
            name: l.name,
            tier: l.tier,
          } as unknown as never,
          price_cents: l.price_cents,
        })),
      );
      if (itemRows.length) {
        const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
        if (itemsErr) throw itemsErr;
      }

      // (3) Update assessment with captured deposit + status='booked'.
      const { error: aErr } = await supabase
        .from("assessments")
        .update({
          pairs: updatedPairs as unknown as never,
          status: "booked",
        })
        .eq("id", id);
      if (aErr) throw aErr;

      // Mirror into local AccountContext so OrderConfirmation can render it.
      const localOrder = addOrder({
        email: user.email ?? accountUser.email,
        phone: accountUser.phone ?? "",
        address: address ?? ({
          id: "stub",
          street: "—",
          city: "—",
          state: "NY",
          zip: "00000",
          isDefault: false,
        } as never),
        paymentLast4: pm?.last4 ?? "0000",
        pairs: pairs.map((p, i) => ({
          id: `pair-${i}`,
          label: `Pair ${i + 1}`,
          addedAt: new Date().toISOString(),
          services: acceptedServices.map((l) => ({
            id: `${l.service_id}-${i}`,
            name: l.name,
            price: l.price_cents,
          })),
        })),
        repairsSubtotal,
        courierFee: COURIER_FEE_CENTS,
        subtotal: repairsSubtotal + COURIER_FEE_CENTS,
      });

      navigate(`/order-confirmation/${localOrder.id}`, { replace: true });
    } catch (e: any) {
      console.error("approve proposal failed", e);
      toast({
        title: "Could not complete payment",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex flex-col">
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
          ) : !proposalReady ? (
            <div className="rounded-xl border border-border p-10 text-center">
              <p className="font-display text-2xl text-primary mb-2">
                Your proposal isn't ready yet
              </p>
              <p className="text-muted-foreground">
                Our cobblers are still preparing it. We'll email you the moment it's ready —
                usually within 1 business day.
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
                    Your repair proposal is ready
                  </h1>
                  <p className="mt-1 text-sm md:text-base text-primary/80">
                    Our cobblers have reviewed your photos. Approve below to capture your deposit
                    and charge the remaining balance to your saved card.
                  </p>
                </div>
              </div>

              {alreadyBooked && (
                <div className="mt-4 rounded-md border border-border bg-secondary/50 p-3 text-sm text-primary">
                  This proposal has already been approved.
                </div>
              )}

              {/* Pair identifiers */}
              <div className="mt-8 space-y-4">
                {pairs.map((p, i) => {
                  const identifier =
                    [p.colors?.join(" / "), p.brand, p.shoeType].filter(Boolean).join(" · ") ||
                    "Your pair";
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-border p-5 flex items-start justify-between gap-4"
                    >
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Pair {i + 1}
                        </p>
                        <p className="mt-1 font-display text-lg text-primary">{identifier}</p>
                      </div>
                      {thumbsByPair[i]?.length ? (
                        <div className="flex gap-2">
                          {thumbsByPair[i].map((src, j) => (
                            <img
                              key={j}
                              src={src}
                              alt={`Pair ${i + 1} photo ${j + 1}`}
                              className="h-14 w-14 rounded-md object-cover border border-border"
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Essential services */}
              <section className="mt-8">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-display text-xl text-primary">Essential</h2>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Included
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  These services are required to restore your shoes properly.
                </p>
                {essential.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground text-center">
                    No essential services proposed.
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
                  <h2 className="font-display text-xl text-primary">Recommended</h2>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Optional
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add-ons our cobblers suggest. Tick to include in your order.
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

              {/* Deposit credit pill */}
              <div
                className="mt-8 rounded-full px-4 py-3 flex items-start gap-3"
                style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
              >
                <ShieldCheck className="mt-0.5 shrink-0" />
                <p className="text-sm text-primary">
                  The $20 deposit per pair already held on your card will be applied to your
                  total.
                </p>
              </div>

              {/* Order summary */}
              <section className="mt-6 rounded-xl border border-border p-5">
                <h2 className="font-display text-xl text-primary">Order summary</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Essential repairs</dt>
                    <dd>{formatPrice(essentialSubtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Recommended add-ons</dt>
                    <dd>{formatPrice(recommendedSubtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Delivery & pickup</dt>
                    <dd>{COURIER_FEE_CENTS === 0 ? "Free" : formatPrice(COURIER_FEE_CENTS)}</dd>
                  </div>
                  <div className="flex justify-between text-primary">
                    <dt>
                      Assessment deposit (already held)
                      {pairs.length > 1 ? ` × ${pairs.length}` : ""}
                    </dt>
                    <dd>−{formatPrice(depositHeld)}</dd>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-semibold text-base">
                    <dt>Total due today</dt>
                    <dd>{formatPrice(totalDueToday)}</dd>
                  </div>
                </dl>
              </section>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="outline" disabled={submitting}>
                  <Link to="/account">Back to account</Link>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={onApprove}
                  disabled={
                    submitting ||
                    alreadyBooked ||
                    essential.length + recommended.length === 0
                  }
                  className={
                    submitting ||
                    alreadyBooked ||
                    essential.length + recommended.length === 0
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }
                >
                  {submitting
                    ? "Processing payment…"
                    : alreadyBooked
                    ? "Already approved"
                    : `Approve proposal & pay ${formatPrice(totalDueToday)}`}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Payment processing is mocked for now — no card is charged. Questions? Email{" "}
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
