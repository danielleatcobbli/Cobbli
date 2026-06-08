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

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />

      <section className="flex-1 py-16 md:py-20">
        <div className="container max-w-2xl text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-secondary flex items-center justify-center">
            <CheckCircle2 className="text-primary" size={32} />
          </div>
          <h1 className="mt-6 font-display text-3xl md:text-4xl text-primary">
            Your assessment is in
          </h1>
          <p className="mt-3 text-primary/80">
            Thanks — our cobblers have everything they need to start your proposal.
          </p>

          <div className="mt-8 rounded-xl border border-border p-6 text-left">
            <h2 className="font-display text-xl text-primary">What happens next</h2>
            <ol className="mt-4 space-y-3 text-sm text-primary/90 list-decimal pl-5">
              <li>
                Our cobblers review your photos and prepare a repair proposal — usually within 1
                business day.
              </li>
              <li>
                You'll get an email with the proposal: recommended services, prices, and a link to
                approve or decline.
              </li>
              <li>
                If you accept, we'll send a prepaid label so you can ship your shoes. The $20
                deposit hold is released once they arrive.
              </li>
            </ol>
          </div>

          {id && (
            <p className="mt-6 text-xs text-muted-foreground">
              Reference: <span className="font-mono">{id.slice(0, 8)}</span>
            </p>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {id && (
              <Button asChild size="lg">
                <Link to={`/start-repair/assessment/proposal/${id}`}>Review proposal</Link>
              </Button>
            )}
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
