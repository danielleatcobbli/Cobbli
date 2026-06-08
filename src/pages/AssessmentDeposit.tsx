import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import { ASSESSMENT_STEPS } from "@/components/cobbli/assessmentSteps";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAssessment } from "@/context/AssessmentContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

const DEPOSIT_CENTS = 2000;

const AssessmentDeposit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { draft, reset } = useAssessment();
  const [submitting, setSubmitting] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);

  usePageMeta({
    title: "Confirm your deposit — Cobbli",
    description: "Authorize a $20 deposit hold so our cobblers can prepare your repair proposal.",
  });

  const ready = useMemo(
    () => !!draft.shoeType && draft.colors.length > 0,
    [draft.shoeType, draft.colors],
  );

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

  if (!ready) {
    return <Navigate to="/start-repair/assessment/details" replace />;
  }

  const onConfirm = async () => {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const mockPaymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const pair = {
        photoPaths: draft.photoPaths,
        videoPaths: draft.videoPaths,
        aiPrefill: draft.aiPrefill,
        shoeType: draft.shoeType,
        colors: draft.colors,
        brand: draft.brand,
        deposit: {
          amount_cents: DEPOSIT_CENTS,
          currency: "usd",
          status: "pending" as const,
          payment_intent_id: mockPaymentIntentId,
        },
      };
      const { data, error } = await supabase
        .from("assessments")
        .insert({
          user_id: user.id,
          pairs: [pair] as never,
          status: "submitted",
        })
        .select("id")
        .single();
      if (error) throw error;
      reset();
      navigate(`/start-repair/assessment/confirmation?id=${data.id}`, { replace: true });
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

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <StepIndicator steps={ASSESSMENT_STEPS} current="deposit" ariaLabel="Assessment progress" />

      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl text-primary">Confirm your deposit</h1>
          <p className="mt-2 text-primary/80">
            We hold a $20 deposit per pair while we review your photos. It's applied to your repair when you place your order, or released in full if you decide not to proceed.
          </p>

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

          <div
            className="mt-6 rounded-xl p-5"
            style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0" />
              <div className="text-sm text-primary">
                <p className="font-medium">$20 refundable deposit hold</p>
                <p className="mt-1">
                  The hold is released automatically once your shoes arrive at our workshop, or if
                  you decline the proposal.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-baseline justify-between rounded-xl border border-border p-5">
            <span className="text-primary font-medium">Deposit hold</span>
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
              {submitting ? "Submitting…" : "Authorize $20 hold & submit"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Payment processing will be enabled soon. For now, no card is charged.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default AssessmentDeposit;
