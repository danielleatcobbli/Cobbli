import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { formatPrice } from "@/context/BagContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

const DEPOSIT_CENTS = 2000;
const COURIER_FEE_CENTS = 0; // free with proposal acceptance

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

type ProposalLine = { id: string; name: string; price_cents: number };

const mockProposalFor = (pair: Pair): ProposalLine[] => {
  const t = (pair.shoeType ?? "").toLowerCase();
  if (t.includes("boot")) {
    return [
      { id: "sole", name: "Full sole replacement", price_cents: 9500 },
      { id: "heel", name: "Heel rebuild", price_cents: 3500 },
      { id: "condition", name: "Leather clean & condition", price_cents: 2500 },
    ];
  }
  if (t.includes("sneaker") || t.includes("trainer")) {
    return [
      { id: "midsole", name: "Midsole repaint & restoration", price_cents: 6500 },
      { id: "clean", name: "Deep clean & deodorize", price_cents: 2500 },
    ];
  }
  if (t.includes("heel") || t.includes("pump") || t.includes("dress")) {
    return [
      { id: "heel-tip", name: "Heel tip replacement", price_cents: 1800 },
      { id: "sole", name: "Half sole replacement", price_cents: 4500 },
      { id: "polish", name: "Polish & finish", price_cents: 1500 },
    ];
  }
  return [
    { id: "sole", name: "Sole repair", price_cents: 5500 },
    { id: "polish", name: "Clean & polish", price_cents: 2000 },
  ];
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
  const [status, setStatus] = useState<string>("");
  const [thumbsByPair, setThumbsByPair] = useState<string[][]>([]);
  const [submitting, setSubmitting] = useState(false);

  usePageMeta({
    title: "Review your proposal — Cobbli",
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
        .select("id, pairs, status")
        .eq("id", id)
        .single();
      if (cancelled) return;
      if (e || !data) {
        setError(e?.message || "Proposal not found");
        setLoading(false);
        return;
      }
      const ps = (data.pairs as unknown as Pair[]) ?? [];
      setPairs(ps);
      setStatus(data.status);

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

  const proposals = useMemo(() => pairs.map((p) => mockProposalFor(p)), [pairs]);
  const repairsSubtotal = useMemo(
    () => proposals.reduce((s, lines) => s + lines.reduce((a, l) => a + l.price_cents, 0), 0),
    [proposals],
  );
  const depositHeld = pairs.length * DEPOSIT_CENTS;
  const totalDueToday = Math.max(0, repairsSubtotal + COURIER_FEE_CENTS - depositHeld);

  const alreadyBooked = status === "booked";

  const onApprove = async () => {
    if (!id || !user || submitting || alreadyBooked) return;
    setSubmitting(true);
    try {
      // (1) Mock capture of each pair's authorization hold + (2) mock charge of remainder.
      const updatedPairs = pairs.map((p, i) => ({
        ...p,
        proposal: { lines: proposals[i] },
        deposit: {
          amount_cents: p.deposit?.amount_cents ?? DEPOSIT_CENTS,
          currency: p.deposit?.currency ?? "usd",
          status: "captured" as const,
          payment_intent_id:
            p.deposit?.payment_intent_id ?? `pi_mock_${Date.now()}_${i}`,
          captured_at: new Date().toISOString(),
        },
        remainder_payment: {
          amount_cents: Math.max(
            0,
            proposals[i].reduce((a, l) => a + l.price_cents, 0) -
              (p.deposit?.amount_cents ?? DEPOSIT_CENTS),
          ),
          currency: "usd",
          status: "succeeded" as const,
          payment_intent_id: `pi_mock_remainder_${Date.now()}_${i}`,
          confirmed_at: new Date().toISOString(),
        },
      }));

      await wait(600); // simulate Stripe round-trips

      // (3) Create the order record in Supabase.
      const address = addresses[0];
      const pm = paymentMethods[0];
      const orderPairsSnapshot = proposals.map((lines, i) => ({
        pairIndex: i,
        pair: pairs[i],
        lines,
      }));

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

      const itemRows = orderPairsSnapshot.flatMap((snap) =>
        snap.lines.map((l) => ({
          order_id: orderRow.id,
          pair_snapshot: snap.pair as unknown as never,
          service_snapshot: { id: l.id, name: l.name } as unknown as never,
          price_cents: l.price_cents,
        })),
      );
      if (itemRows.length) {
        const { error: itemsErr } = await supabase.from("order_items").insert(itemRows);
        if (itemsErr) throw itemsErr;
      }

      // Update assessment with captured deposit + status='booked'.
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
        pairs: orderPairsSnapshot.map((snap, i) => ({
          id: `pair-${i}`,
          label: `Pair ${i + 1}`,
          addedAt: new Date().toISOString(),
          services: snap.lines.map((l) => ({
            id: l.id,
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
      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-3xl">
          <h1 className="font-display text-3xl md:text-4xl text-primary">
            Review your repair proposal
          </h1>
          <p className="mt-2 text-primary/80">
            Approve to capture your deposit and charge the remaining balance to your saved card.
          </p>

          {loading ? (
            <BrandSpinner className="py-16" size="lg" />
          ) : error ? (
            <div className="mt-8 rounded-xl border border-border p-6">
              <p className="text-destructive">{error}</p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/account">Back to account</Link>
              </Button>
            </div>
          ) : pairs.length === 0 ? (
            <div className="mt-8 rounded-xl border border-border p-10 text-center">
              <p className="font-display text-xl text-primary mb-1">Nothing to review</p>
              <p className="text-muted-foreground">
                We couldn't find any pairs on this assessment.
              </p>
            </div>
          ) : (
            <>
              {alreadyBooked && (
                <div
                  className="mt-6 rounded-xl p-4 text-sm text-primary"
                  style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
                >
                  This proposal has already been approved.
                </div>
              )}

              <div className="mt-8 space-y-6">
                {pairs.map((p, i) => (
                  <div key={i} className="rounded-xl border border-border p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="font-display text-xl text-primary">
                          Pair {i + 1}
                          {p.shoeType ? ` · ${p.shoeType}` : ""}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[p.colors?.join(", "), p.brand].filter(Boolean).join(" · ") || "—"}
                        </p>
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
                    <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
                      {proposals[i].map((l) => (
                        <li key={l.id} className="py-2 flex justify-between gap-4">
                          <span className="text-primary">{l.name}</span>
                          <span>{formatPrice(l.price_cents)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-xl border border-border p-5">
                <h2 className="font-display text-xl text-primary">Order summary</h2>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Repairs subtotal</dt>
                    <dd>{formatPrice(repairsSubtotal)}</dd>
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

                <div
                  className="mt-5 rounded-lg p-4 flex items-start gap-3"
                  style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
                >
                  <ShieldCheck className="mt-0.5 shrink-0" />
                  <p className="text-sm text-primary">
                    Your $20 per-pair deposit hold is captured now and applied against your repair
                    total. The remaining balance is charged to your saved card.
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild variant="outline" disabled={submitting}>
                  <Link to="/account">Back to account</Link>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={onApprove}
                  disabled={submitting || alreadyBooked}
                  className={
                    submitting || alreadyBooked ? "opacity-50 cursor-not-allowed" : ""
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
