import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import StepIndicator from "@/components/cobbli/StepIndicator";
import { ASSESSMENT_STEPS } from "@/components/cobbli/assessmentSteps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { toast } from "@/hooks/use-toast";

const COLORS = [
  "Black", "Blue", "Brown", "Cream", "Denim", "Gold", "Green", "Grey",
  "Multi", "Navy", "Orange", "Pattern", "Pink", "Purple", "Red", "Silver",
  "Tan", "White", "Yellow",
];

const AssessmentDetails = () => {
  const navigate = useNavigate();
  const { draft, setDetails } = useAssessment();

  usePageMeta({
    title: "Confirm your shoe details — Cobbli",
    description: "Review the shoe details we identified from your photos before we recommend repairs.",
  });

  const [shoeType, setShoeType] = useState<ShoeType | "">(draft.shoeType ?? "");
  const [colors, setColors] = useState<string[]>(draft.colors);
  const [brand, setBrand] = useState<string>(draft.brand);

  useEffect(() => {
    setShoeType(draft.shoeType ?? "");
    setColors(draft.colors);
    setBrand(draft.brand);
  }, [draft.shoeType, draft.colors, draft.brand]);

  if (draft.photoPaths.length === 0 && draft.videoPaths.length === 0) {
    return <Navigate to="/start-repair/assessment" replace />;
  }

  const toggleColor = (c: string) =>
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const valid = shoeType !== "" && colors.length > 0;

  const onNext = () => {
    if (!valid) return;
    setDetails({ shoeType: shoeType as ShoeType, colors, brand: brand.trim() });
    toast({
      title: "Details saved",
      description: "Deposit and proposal flow coming in the next phase.",
    });
  };

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />
      <StepIndicator steps={ASSESSMENT_STEPS} current="details" ariaLabel="Assessment progress" />

      <section className="flex-1 py-12 md:py-16">
        <div className="container max-w-2xl">
          <h1 className="font-display text-3xl md:text-4xl text-primary">Confirm your shoe details</h1>
          <p className="mt-2 text-primary/80">
            We've done our best to fill these in from your photos. Please check and update anything that's
            not right.
          </p>

          <div className="mt-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="shoe-type">
                Shoe type <span className="text-destructive">*</span>
              </Label>
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
            </div>

            <div className="space-y-2">
              <Label>
                Color(s) <span className="text-destructive">*</span>
              </Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                maxLength={250}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              These details help us make the right recommendation. The more accurate they are, the better.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/start-repair/assessment")}
            >
              Back
            </Button>
            <Button
              type="button"
              size="lg"
              onClick={onNext}
              disabled={!valid}
              className={!valid ? "opacity-50 cursor-not-allowed" : ""}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default AssessmentDetails;
