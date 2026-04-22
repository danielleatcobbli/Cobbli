import { Button } from "@/components/ui/button";

const CTA = () => {
  return (
    <section className="py-16 md:py-20 bg-gradient-warm text-primary-foreground">
      <div className="container flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-4xl font-display font-600 text-balance">
            Ready to give your shoes a second life?
          </h2>
          <p className="mt-3 text-primary-foreground/80">
            Book your professional repair today — free collection across the UK.
          </p>
        </div>
        <Button size="lg" variant="hero" className="shrink-0">
          Book a repair
        </Button>
      </div>
    </section>
  );
};

export default CTA;
