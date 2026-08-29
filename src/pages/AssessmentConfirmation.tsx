import { useSearchParams, Link } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import { CheckCircle2 } from "lucide-react";

const AssessmentConfirmation = () => {
  const [params] = useSearchParams();
  const id = params.get("id");

  usePageMeta({
    title: "Assessment submitted — Cobbli",
    description: "Your photo assessment is with our cobblers. We'll email your repair proposal shortly.",
  });

  // Restyled 2026-08-26 (Danielle's call) — cream page + amber Fraunces/
  // Instrument Sans text, matching the rest of the cream pages. Static
  // confirmation page, so given the fuller treatment (not just page-shell).
  return (
    <main className="min-h-screen flex flex-col bg-white">
      <Header />

      <section className="flex-1 py-16 md:py-20">
        <div className="container max-w-2xl text-center">
          <div className="mx-auto h-14 w-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fdb600" }}>
            <CheckCircle2 style={{ color: "#fff5cc" }} size={32} />
          </div>
          <h1
            className="mt-6 text-3xl md:text-4xl uppercase"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
          >
            We're on it
          </h1>
          <p className="mt-3" style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif", opacity: 0.85 }}>
            Thanks — our cobblers have everything they need to start your proposal.
          </p>

          <div className="mt-8 rounded-xl p-6 text-left" style={{ border: "1px solid #fdb600" }}>
            <h2 className="text-xl uppercase" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}>What happens next</h2>
            <ol className="mt-4 space-y-3 text-sm list-decimal pl-5" style={{ color: "#fdb600", opacity: 0.9, fontFamily: "'Instrument Sans', sans-serif" }}>
              <li>
                Our cobblers review your photos and/or videos and prepare a repair proposal.
              </li>
              <li>
                You'll get an email with the proposal: recommended services, prices, and a link to
                approve, edit, or decline.
              </li>
              <li>Place your order.</li>
            </ol>
          </div>

          {id && (
            <p className="mt-6 text-xs text-muted-foreground">
              Reference: <span className="font-mono">{id.slice(0, 8)}</span>
            </p>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline" size="lg">
              <Link to="/account">View my account</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/">Back to home</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Questions? Email{" "}
            <a href="mailto:support@cobbli.com" className="underline">
              support@cobbli.com
            </a>
            .
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default AssessmentConfirmation;
