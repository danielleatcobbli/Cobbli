import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import hero from "@/assets/hero-cobbler.png";

const Hero = () => {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="relative min-h-[560px] md:min-h-[640px] flex items-center">
        <img
          src={hero}
          alt="Master cobbler restoring a leather brogue shoe in a workshop"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="container relative z-10 py-20 md:py-28">
          <div className="max-w-2xl text-primary-foreground animate-fade-up">
            <h1 className="font-display text-4xl md:text-6xl font-600 leading-[1.05] text-balance">
              Expert Shoe Repair{" "}
              <span className="text-primary-foreground">Delivered</span> to Your Doorstep
            </h1>
            <p className="mt-5 text-lg md:text-xl text-primary-foreground/85 max-w-xl">
              Old-world craftsmanship, modern convenience. We pick up, repair, and return your shoes — without you leaving home.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="hero">
                Book a repair
              </Button>
              <Button size="lg" variant="heroOutline">
                See our services
              </Button>
            </div>
            <button
              type="button"
              className="mt-5 inline-flex items-center gap-2 text-sm md:text-base text-primary-foreground/80 hover:text-primary-foreground transition-colors group"
            >
              <Sparkles className="opacity-80" />
              <span>
                Not sure what your shoes need?{" "}
                <span className="underline underline-offset-4 decoration-primary-foreground/40 group-hover:decoration-primary-foreground">
                  Upload a photo for AI recommendations
                </span>
              </span>
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
