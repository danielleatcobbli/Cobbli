import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

const CTA = () => {
  return (
    <section className="py-16 md:py-20 bg-gradient-warm text-primary-foreground">
      <div className="container flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-4xl text-balance">
            Ready to give your shoes a second life?
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Book your professional repair today — free pick up across Manhattan.
          </p>
        </div>
        <Link to="/services" onClick={() => trackEvent("start_repair", { source: "cta_section" })}>
          <Button size="lg" variant="hero" className="shrink-0">
            Start a repair
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default CTA;
