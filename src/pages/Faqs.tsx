import { Link } from "react-router-dom";
import { useRef, useState, type ReactNode } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Plus, Minus } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useServiceableZips } from "@/hooks/useServiceableZips";
import { trackEvent } from "@/lib/analytics";

const Email = () => (
  <a
    href="mailto:support@cobbli.com"
    className="underline underline-offset-4"
    onClick={() => trackEvent("consultation_email_clicked", { source: "faqs" })}
  >
    support@cobbli.com
  </a>
);

// Session-level deduplication: these are interest signals, not unique people.
const recordedCoverageZips = new Set<string>();

export const CoverageRequestForm = () => {
  const [zip, setZip] = useState("");
  const [result, setResult] = useState<"invalid" | "covered" | "uncovered" | "unavailable" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const checking = useRef(false);
  const { isServiceable } = useServiceableZips();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking.current) return;
    setRecorded(false);
    if (!/^[0-9]{5}$/.test(zip)) {
      setResult("invalid");
      return;
    }
    const coverage = isServiceable(zip);
    if (coverage === null) {
      setResult("unavailable");
      return;
    }
    if (coverage) {
      setResult("covered");
      return;
    }
    setResult("uncovered");
    const key = `cobbli:coverage-request:${zip}`;
    let alreadyRecorded = recordedCoverageZips.has(zip);
    try { alreadyRecorded ||= sessionStorage.getItem(key) === "1"; } catch { /* Storage may be disabled. */ }
    if (alreadyRecorded) {
      setRecorded(true);
      return;
    }
    checking.current = true;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("coverage_requests").insert({ zip_code: zip, email: null });
      if (!error) {
        recordedCoverageZips.add(zip);
        try { sessionStorage.setItem(key, "1"); } catch { /* In-memory deduplication remains available. */ }
        setRecorded(true);
      }
    } catch { /* Coverage remains valid even if recording interest fails. */ }
    finally {
      checking.current = false;
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-md border border-border p-4" noValidate>
      <Label htmlFor="cr-zip">ZIP code</Label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id="cr-zip"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          value={zip}
          disabled={submitting}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
            setResult(null);
            setRecorded(false);
          }}
          placeholder="10001"
          aria-invalid={result === "invalid"}
          aria-describedby={result ? "coverage-result" : undefined}
          required
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Checking…" : "Check availability"}
        </Button>
      </div>
      <div id="coverage-result" role="status" aria-live="polite">
        {result === "invalid" && <p className="text-sm text-destructive">Enter a valid 5-digit ZIP code.</p>}
        {result === "unavailable" && <p className="text-sm">We couldn’t check availability right now. Please try again shortly.</p>}
        {result === "covered" && (
          <p className="text-sm font-medium text-green-700">
            We serve your area!{" "}
            <Link to="/start-repair/assessment" className="underline underline-offset-4"
              onClick={() => trackEvent("start_repair", { source: "faqs" })}>Start a repair →</Link>
          </p>
        )}
        {result === "uncovered" && (
          <p className="text-sm">We’re not in your area yet.{recorded && " Thanks for helping us understand where to expand next."}</p>
        )}
      </div>
    </form>
  );
};

const faqs: { q: string; a: ReactNode }[] = [
  {
    q: "How does Cobbli work?",
    a: (
      <p>
        Upload photos of your bag through our short{" "}
        <Link
          to="/start-repair/assessment"
          className="underline underline-offset-4 hover:text-primary"
          onClick={() => trackEvent("start_repair", { source: "faqs" })}
        >
          Start a Repair
        </Link>{" "}
        form and we'll recommend the right repairs. From there, we pick
        up your items, repair them, and return them to your door.
      </p>
    ),
  },
  {
    q: "What areas of New York do you serve?",
    a: (
      <div className="space-y-3">
        <p>
          We currently serve most of Manhattan. Enter your ZIP code to check whether we offer pickup and return in your area.
        </p>
        <CoverageRequestForm />
      </div>
    ),
  },
  {
    q: "How do I schedule my pickup and return?",
    a: (
      <p>
        Schedule your pickup during checkout. Once your order is ready, we will email you to schedule your
        return.
      </p>
    ),
  },
  {
    q: "Is there a fee for pickup and delivery?",
    a: (
      <p>
        Courier service is free on orders over $100. For orders under $100, a flat $15 courier fee applies.
      </p>
    ),
  },
  {
    q: "How long do repairs take?",
    a: (
      <p>
        Most repairs are completed within 2 weeks of us receiving your item(s). If your order is ready
        early, we'll let you know.
      </p>
    ),
  },
  {
    q: "Do you offer order guarantees?",
    a: (
      <p>
        If you're not satisfied with your repair, contact us at <Email /> within 14 days of receiving
        your order.
      </p>
    ),
  },
  {
    q: "How do I contact Cobbli?",
    a: (
      <p>
        Email us any day at <Email />. We typically respond within 2 business days.
      </p>
    ),
  },
];

const Faqs = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  usePageMeta({
    title: "FAQs — Cobbli",
    description:
"Answers to common questions about Cobbli's NYC shoe repair service: pickup and return, pricing, turnaround times, service area and order guarantees.",
  });

  // Restyled 2026-08-26 (Danielle's call) to match the homepage's cream/
  // amber pattern (Services, Reviews, etc.) and its fonts (Fraunces
  // headings, Instrument Sans body/nav). White page bg + amber-bar Header
  // (now Header's site-wide default, rolled out everywhere 2026-08-27 after
  // this page trialled it) — CoverageRequestForm (the zip/email mini-form
  // inside "What areas do you service?") is left in its original neutral
  // styling since it's a functional form, not scoped by her request.
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />
      <section className="flex-1 py-16 md:py-24">
        <div className="container max-w-3xl">
          <h1
            className="text-4xl md:text-5xl text-balance uppercase"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
          >
            Frequently asked questions
          </h1>

          <ul className="mt-10" style={{ borderTop: "1px solid #fdb600" }}>
            {faqs.map((f, i) => {
              const isOpen = openIdx === i;
              return (
                <li key={i} style={{ borderBottom: "1px solid #fdb600" }}>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full flex items-start justify-between gap-6 py-5 text-left"
                  >
                    <span
                      className="text-lg md:text-xl"
                      style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif", fontWeight: 600 }}
                    >
                      {f.q}
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 mt-1 h-6 w-6 flex items-center justify-center"
                      style={{ color: "#fdb600" }}
                    >
                      {isOpen ? <Minus size={20} /> : <Plus size={20} />}
                    </span>
                  </button>
                  {/* Plain brown text, no background box (2026-08-27,
                      Danielle's call — tried a cream highlight box first,
                      but brown-on-white on its own reads clearly enough and
                      the box was unnecessary). */}
                  {isOpen && (
                    <div
                      className="pb-6 pr-10 text-base leading-relaxed"
                      style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}
                    >
                      {f.a}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
      <Footer />
    </main>
  );
};

export default Faqs;
