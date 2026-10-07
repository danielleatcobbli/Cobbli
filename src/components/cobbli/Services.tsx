import { Link } from "react-router-dom";
import { trackEvent } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// Section — rebuilt from a live services catalog teaser into a static brand
// philosophy statement (2026-09-24, Danielle's call, Rhode-style reference:
// centered header + short body copy + single CTA, no product/service grid).
// Reasoning: we're not publicly listing individual services right now (at
// least initially) since Start a Repair's photo-review flow is the only
// intake path — a live "browse services" carousel implied a catalog/pricing
// experience that doesn't match how people are actually getting quoted
// anymore. The component name/file/section id stay the same (Index.tsx
// still imports `Services` and nothing scrolls to #services by id elsewhere)
// even though the content itself is no longer a services listing. The old
// catalog/filter-bar/ServiceCard version is still fully intact in git
// history if this ever needs to come back.
// ---------------------------------------------------------------------------

const Services = () => {
  return (
    <section id="services" className="relative overflow-hidden" style={{ backgroundColor: "#fff5cc" }}>
      <div className="container pt-16 pb-24 md:pt-20 md:pb-28 text-center">
        <div className="max-w-4xl mx-auto">
          <h2
            className="text-[clamp(1.75rem,8vw,3rem)] sm:text-5xl md:text-6xl lg:text-7xl uppercase leading-[1.05]"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
          >
            <span className="block">Good things are</span>
            <span className="block">worth keeping</span>
          </h2>
          <p
            className="mx-auto mt-6 max-w-2xl text-base md:text-lg leading-relaxed"
            style={{ color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}
          >
            We're here to make taking care of the things you love as easy as owning them. With expert repair
            brought right to your door, Cobbli makes it simple to keep your favorite pieces looking good and in
            your life for longer.
          </p>
          {/* Text color moved from inline style into the same text-[#fdb600]
              class as the hover variant (2026-09-24, Danielle's call — the
              text was unreadable on hover). Inline styles always win over
              classes in CSS specificity, so the old setup (color set inline,
              hover:text-[#fff5cc] as a class) meant the hover class never
              actually took effect — the text stayed amber against the now-
              amber hover background and disappeared. Both colors as classes
              now so the :hover cascade works normally. */}
          <Link
            to="/start-repair/assessment"
            onClick={() => trackEvent("start_repair", { source: "services_statement" })}
            className="inline-block mt-7 rounded-full border-2 px-8 py-3 text-sm font-medium uppercase tracking-wide text-[#fdb600] transition-colors hover:bg-[#fdb600] hover:text-[#fff5cc]"
            style={{ borderColor: "#fdb600", fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Start a repair
          </Link>
        </div>
      </div>

      <svg
        className="block w-full absolute -bottom-px left-0"
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        style={{ height: 40 }}
        aria-hidden="true"
      >
        <path
          d="M0,60 C240,15 480,15 720,38 C960,60 1200,60 1440,25 L1440,60 L0,60 Z"
          fill="#fdb600"
        />
      </svg>
    </section>
  );
};

export default Services;
