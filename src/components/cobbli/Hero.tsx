import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

// Served from /public so the preload link in index.html resolves to the same URL.
const hero = "/assets/hero-cobbler.webp";

const Hero = () => {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="relative min-h-[560px] md:min-h-[640px] flex items-center">
        <img
          src={hero}
          alt="Master cobbler restoring a leather brogue shoe in a workshop"
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          decoding="async"
          // @ts-expect-error fetchpriority is a valid HTML attribute, React typing lags
          fetchpriority="high"
        />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="container relative z-10 py-20 md:py-28">
          <div className="max-w-2xl text-primary-foreground animate-fade-up">
            <h1 className="font-display text-4xl md:text-6xl leading-[1.05] text-balance text-primary-foreground">
              Expert Shoe Repair{" "}
              <span className="text-primary-foreground">Delivered</span> to Your Doorstep
            </h1>
            <p className="mt-5 text-lg md:text-xl text-primary-foreground/85 max-w-xl">
              Old-world craftsmanship, modern convenience. We pick up, repair, and return your shoes — without you leaving home.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/start-repair" onClick={() => trackEvent("start_repair", { source: "hero" })}>
                <Button size="lg" variant="hero">
                  Start a repair
                </Button>
              </Link>
              <Link to="/services">
                <Button size="lg" variant="heroOutline">
                  Browse services
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
