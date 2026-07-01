import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import { ASSESSMENT_STEPS } from "@/components/cobbli/assessmentSteps";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAssessment } from "@/context/AssessmentContext";
import { useAuth } from "@/context/AuthContext";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckoutPanel } from "@/components/StripeEmbeddedCheckout";

const AssessmentDeposit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const pricing = usePricingConfig();
  const depositCents = pricing.fee("assessment_deposit_cents");
  const { draft, reset } = useAssessment();
  const [submitting, setSubmitting] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  // Stripe returns the user here with ?session_id=...&assessment_id=...
  const returningSessionId = searchParams.get("session_id");
  const returningAssessmentId = searchParams.get("assessment_id");

  usePageMeta({
    title: "Confirm your deposit — Cobbli",
    description:
      "Authorize a $20 deposit so our cobblers can prepare your repair proposal.",
  });

  const ready = useMemo(
    () => !!draft.shoeType && draft.colors.length > 0,
    [draft.shoeType, draft.colors],
  );

  // After successful return from Stripe, navigate to confirmation.
  useEffect(() => {
    if (returningSessionId && returningAssessmentId) {
      reset();
      navigate(
        `/start-repair/assessment/confirmation?id=${returningAssessmentId}`,
        { replace: true },
      );
    }
  }, [returningSessionId, returningAssessmentId, navigate, reset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!draft.photoPaths.length) return;
      const out: string[] = [];
      for (const p of draft.photoPaths.slice(0, 4)) {
        const { data } = await supabase.storage
          .from("assessment-uploads")
          .createSignedUrl(p, 3600);
        if (data?.signedUrl) out.push(data.signedUrl);
      }
      if (!cancelled) setThumbs(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.photoPaths]);

  if (!ready && !returningSessionId) {
    return <Navigate to="/start-repair/assessment/details" replace />;
  }

  const onConfirm = async () => {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const pair = {
        photoPaths: draft.photoPaths,
        videoPaths: draft.videoPaths,
        aiPrefill: draft.aiPrefill,
        shoeType: draft.shoeType,
        colors: draft.colors,
        brand: draft.brand,
        deposit: {
          amount_cents: depositCents,
          currency: "usd",
          status: "pending" as const,
        },
      };
      const { data, error } = await supabase
        .from("assessments")
        .insert({
          user_id: user.id,
          pairs: [pair] as never,
          status: "submitted",
          deposit_amount_cents: depositCents,
        })
        .select("id")
        .single();
      if (error) throw error;
      setAssessmentId(data.id);
      setShowCheckout(true);
    } catch (e: any) {
      console.error("submit assessment failed", e);
      toast({
        title: "Could not submit",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  const returnUrl = assessmentId
    ? `${window.location.origin}/start-repair/assessment/deposit?session_id={CHECKOUT_SESSION_ID}&assessment_id=${assessmentId}`
    : "";

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <PaymentTestModeBanner />
      <StepIndicator steps={ASSESSMENT_STEPS} current="deposit" ariaLabel="Assessment progress" />

      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl text-primary">Confirm your deposit</h1>
          <p className="mt-2 text-primary/80">
            We charge a $20 deposit per pair while we review your photos. It's applied to your repair when you place your order or refunded in full if you decide not to proceed.
          </p>

          {!showCheckout && (
            <>
              <div className="mt-8 rounded-xl border border-border p-5">
                <h2 className="font-display text-xl text-primary">Your pair</h2>
                {thumbs.length > 0 && (
                  <div className="mt-4 flex gap-2">
                    {thumbs.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt={`Shoe photo ${i + 1}`}
                        className="h-16 w-16 rounded-md object-cover border border-border"
                      />
                    ))}
                  </div>
                )}
                <dl className="mt-4 grid grid-cols-3 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Shoe type</dt>
                  <dd className="col-span-2 text-primary">{draft.shoeType}</dd>
                  <dt className="text-muted-foreground">Color(s)</dt>
                  <dd className="col-span-2 text-primary">{draft.colors.join(", ")}</dd>
                  <dt className="text-muted-foreground">Brand</dt>
                  <dd className="col-span-2 text-primary">{draft.brand || "—"}</dd>
                </dl>
              </div>

              <div className="mt-6 flex items-baseline justify-between rounded-xl border border-border p-5">
                <span className="text-primary font-medium">Deposit</span>
                <span className="font-display text-2xl text-primary">$20.00</span>
              </div>

              <div className="mt-10 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/start-repair/assessment/details")}
                  disabled={submitting}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  onClick={onConfirm}
                  disabled={submitting}
                  className={submitting ? "opacity-50 cursor-not-allowed" : ""}
                >
                  {submitting ? "Preparing…" : "Continue to payment"}
                </Button>
              </div>
            </>
          )}

          {showCheckout && assessmentId && (
            <div className="mt-8 rounded-xl border border-border overflow-hidden">
              <StripeEmbeddedCheckoutPanel
                kind="deposit"
                rowId={assessmentId}
                returnUrl={returnUrl}
              />
            </div>
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default AssessmentDeposit;
