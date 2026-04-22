import { Button } from "@/components/ui/button";
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
            <span className="inline-block mb-4 text-xs font-semibold tracking-[0.2em] uppercase text-status-orange">
              Trusted by thousands of UK customers
            </span>
            <h1 className="font-display text-4xl md:text-6xl font-600 leading-[1.05] text-balance">
              Expert Shoe Repair{" "}
              <span className="italic text-status-cream">Delivered</span> to Your Doorstep
            </h1>
            <p className="mt-5 text-lg md:text-xl text-primary-foreground/85 max-w-xl">
              We collect, restore and return your favourite shoes — all without you ever
              leaving the house. Old-world craftsmanship, modern convenience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="hero">
                Book a repair
              </Button>
              <Button size="lg" variant="heroOutline">
                See our services
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
