import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

// Served from /public so the preload link in index.html resolves to the same URL.
// Swapped to the SoHo lifestyle shot 2026-08-25 (Danielle's call) — testing a
// lifestyle-led hero vs. the original workshop photo. Revert by pointing this
// back at "/assets/hero-cobbler.webp" (left in place, untouched, still used
// as the site-wide og:image/twitter:image default in index.html).
const hero = "/assets/hero-lifestyle-soho.webp";

// Headline rebuilt 2026-08-26 (Danielle's call) to match her Canva homepage
// mockup — centered, bold + italic Fraunces pairing (free stand-in for
// Quincy CF, see index.html), single CTA, no subhead. Old copy ("Expert Shoe
// Repair Delivered to Your Doorstep" + the craftsmanship subhead) is still
// exactly what index.html's default og:title/description use, so nothing
// else needed to change there.
const Hero = () => {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="relative min-h-[560px] md:min-h-[720px] flex items-center justify-center">
        <img
          src={hero}
          alt="Woman walking down a cobblestone SoHo street in black slingback heels"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 70%" }}
          loading="eager"
          decoding="async"
          // @ts-expect-error fetchpriority is a valid HTML attribute, React typing lags
          fetchpriority="high"
        />
        <div className="absolute inset-0 bg-gradient-hero" />
        <div className="container relative z-10 py-24 md:py-32 text-center">
          <div className="max-w-3xl mx-auto animate-fade-up">
            <h1
              className="text-5xl md:text-8xl leading-[0.95] text-balance"
              style={{ fontFamily: "'Fraunces', serif", color: "#fdb600" }}
            >
              <span style={{ fontWeight: 700 }}>Your cobbler.</span>
              <br />
              <span style={{ fontWeight: 500, fontStyle: "italic" }}>At your door.</span>
            </h1>
            <div className="mt-9 flex flex-wrap gap-3 justify-center">
              <Link to="/start-repair" onClick={() => trackEvent("start_repair", { source: "hero" })}>
                {/* Sized up 2026-08-27 (Danielle's call: "I want it to
                    really stand out because the goal is for people to click
                    that") — the className overrides win over size="lg"'s
                    own h-12/px-8/text-base since they're merged in after
                    (tailwind-merge resolves the conflict in favor of
                    whichever utility appears later), so this is bigger than
                    every other "lg" hero button site-wide without touching
                    the shared variant itself.

                    Stayed amber when every other button site-wide flipped
                    to brown 2026-08-27 (Danielle's call: "I actually liked
                    the yellow for the starter repair button, but I do want
                    it to be distinct") — explicit inline bg/color override
                    the "hero" variant's now-brown default, back to amber bg
                    + cream text (the same amber-theme cream-on-amber pairing
                    used everywhere else, e.g. ServiceCard, GetToKnowUs).
                    min-w widened further the same day ("I want the button to
                    just be wider so that the eye is drawn to it") — on top
                    of the height/padding bump above, this guarantees real
                    extra width even though "Start a repair" itself doesn't
                    need it; the button's own flex centering keeps the text
                    centered in that wider pill rather than left-packed.

                    hover:bg-[#fdb600]/90 explicitly re-overrides the "hero"
                    variant's own hover:bg-primary/90 — inline style can't
                    express a :hover state, so without this the button would
                    sit amber at rest but flash toward brown on hover
                    (whichever hover background rule "wins" isn't decided by
                    inline style at all, since that only covers the resting
                    state). */}
                <Button
                  size="lg"
                  variant="hero"
                  className="rounded-full px-10 md:px-14 h-14 md:h-16 min-w-[300px] md:min-w-[360px] text-base md:text-lg hover:bg-[#fdb600]/90"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", backgroundColor: "#fdb600", color: "#fff5cc" }}
                >
                  Start a repair
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
