import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

import StepIndicator from "@/components/cobbli/StepIndicator";
import { ASSESSMENT_STEPS } from "@/components/cobbli/assessmentSteps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SHOE_TYPES, type ShoeType } from "@/types/service";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useAssessment } from "@/context/AssessmentContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import BrandCombobox, { inferBrandMode, type BrandMode } from "@/components/cobbli/BrandCombobox";

const COLORS = [
"Black", "Blue", "Brown", "Cream", "Denim", "Gold", "Green", "Grey",
"Multi", "Navy", "Orange", "Pattern", "Pink", "Purple", "Red", "Silver",
"Tan", "White", "Yellow",
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AssessmentDetails = () => {
  const navigate = useNavigate();
  const { draft, setDetails, aiLoading, reset } = useAssessment();
  const { user } = useAuth();
  const isGuest = !user;

  usePageMeta({
    title: "Confirm your shoe details — Cobbli",
    description: "Review the shoe details we identified from your photos before we recommend repairs.",
  });

  const [shoeType, setShoeType] = useState<ShoeType | "">(draft.shoeType ?? "");
  const [colors, setColors] = useState<string[]>(draft.colors);
  const [brand, setBrand] = useState<string>(draft.brand);
  const [brandMode, setBrandMode] = useState<BrandMode>(inferBrandMode(draft.brand));
  const [email, setEmail] = useState(user?.email ?? "");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);
  const [minDelayElapsed, setMinDelayElapsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinDelayElapsed(true), 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setShoeType(draft.shoeType ?? "");
    setColors(draft.colors);
    setBrand(draft.brand);
    setBrandMode(inferBrandMode(draft.brand));
  }, [draft.shoeType, draft.colors, draft.brand]);

  if (draft.photoPaths.length === 0 && draft.videoPaths.length === 0 && !aiLoading) {
    return <Navigate to="/start-repair/assessment" replace />;
  }

  const showSkeleton = aiLoading || !minDelayElapsed;

  const toggleColor = (c: string) =>
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const brandValid =
    brandMode === "list" ? !!brand
    : brandMode === "unknown" ? true
    : brandMode === "custom" ? brand.trim().length > 0
    : false;

  const detailsValid = shoeType !== "" && colors.length > 0 && brandValid;
  const emailValid = emailRegex.test(email.trim());
  const valid = detailsValid && emailValid;

  const onNext = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      setDetails({ shoeType: shoeType as ShoeType, colors, brand: brand.trim() });
      const pair = {
        photoPaths: draft.photoPaths,
        videoPaths: draft.videoPaths,
        aiPrefill: draft.aiPrefill,
        shoeType,
        colors,
        brand: brand.trim(),
      };
      const insertRow: Record<string, unknown> = {
        pairs: [pair],
        status: "submitted",
        guest_email: email.trim(),
        description: description.trim() || null,
      };
      if (user) {
        insertRow.user_id = user.id;
      }
      const { data, error } = await supabase
        .from("assessments")
        .insert(insertRow as never)
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
      <StepIndicator steps={ASSESSMENT_STEPS} current="details" ariaLabel="Assessment progress" />

      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl text-primary">Confirm your shoe details</h1>
          {showSkeleton ? (

            <p className="mt-2 text-primary/80">Analyzing your photos…</p>
          ) : (() => {
            const ai = draft.aiPrefill;
            const aiFailed =
              !ai || (!ai.shoeType && (!ai.colors || ai.colors.length === 0) && !ai.brand);
            return aiFailed ? (
              <p className="mt-2 italic text-muted-foreground">
                We weren't able to pull shoe details from your upload. Please fill in your shoe details below.
              </p>
            ) : (
              <p className="mt-2 text-primary/80">
                We've done our best to fill these in from your photos. Please check and update anything that's
                not right.
              </p>
            );
          })()}

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="shoe-type">
                Shoe type <span className="text-destructive">*</span>
              </Label>
              {showSkeleton ? (
                <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
              ) : (
                <Select value={shoeType} onValueChange={(v) => setShoeType(v as ShoeType)}>
                  <SelectTrigger id="shoe-type">
                    <SelectValue placeholder="Select shoe type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Color(s) <span className="text-destructive">*</span>
              </Label>
              {showSkeleton ? (
                <div className="space-y-2">
                  <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                  <div className="flex flex-wrap gap-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-8 w-16 rounded-full bg-muted animate-pulse" />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[13px] text-muted-foreground -mt-1">Select all that apply</p>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => {
                      const selected = colors.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleColor(c)}
                          aria-pressed={selected}
                          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                            selected ? "bg-secondary text-primary" : "bg-card text-muted-foreground hover:text-primary"
                          }`}
                          style={{
                            borderColor: selected ? "#3d1700" : "hsl(var(--border))",
                            borderWidth: selected ? 2 : 1,
                          }}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">
                Brand <span className="text-destructive">*</span>
              </Label>
              {showSkeleton ? (
                <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
              ) : (
                <BrandCombobox
                  id="brand"
                  mode={brandMode}
                  value={brand}
                  onChange={(m, v) => {
                    setBrandMode(m);
                    setBrand(v);
                  }}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assessment-description">
                Anything else we should know? (optional)
              </Label>
              {showSkeleton ? (
                <div className="h-24 w-full rounded-md bg-muted animate-pulse" />
              ) : (
                <Textarea
                  id="assessment-description"
                  placeholder="e.g. The heel has been wobbling for a few weeks, or there's a stain on the left toe"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                  maxLength={1000}
                  rows={4}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposal-email">
                Where should we send your proposal? <span className="text-destructive">*</span>
              </Label>
              <Input
                id="proposal-email"
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {isGuest && (
                <p className="text-[13px] text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/signin" className="underline">
                    Sign in instead
                  </Link>
                  .
                </p>
              )}
            </div>

          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/start-repair/assessment")}
              disabled={submitting}
            >
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={onNext}
              disabled={!valid || submitting}
              className={!valid || submitting ? "opacity-50 cursor-not-allowed" : ""}
            >
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default AssessmentDetails;
