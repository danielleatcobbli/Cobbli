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
      {/* Spread out + enlarged (2026-09-24, Danielle's call — the section
          felt thin/undersized next to Hero and How It Works). More vertical
          padding, a wider heading that stays on one line at md+ instead of
          wrapping to two, and more breathing room between the heading/body/
          CTA. */}
      <div className="container py-28 md:py-40 text-center">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-3xl md:text-5xl uppercase md:whitespace-nowrap"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
          >
            Good things are worth keeping
          </h2>
          <p
            className="mt-8 text-base md:text-lg leading-relaxed"
            style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif", opacity: 0.9 }}
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
            className="inline-block mt-10 rounded-full border-2 px-8 py-3 text-sm font-medium uppercase tracking-wide text-[#fdb600] transition-colors hover:bg-[#fdb600] hover:text-[#fff5cc]"
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
