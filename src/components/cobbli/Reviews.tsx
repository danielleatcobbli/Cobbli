// New section added 2026-08-26 (Danielle's call, matches her homepage
// mockup) — replaces the old "Why Cobbli" trust-signals section (still at
// TrustSignals.tsx, just no longer rendered on the homepage; see Index.tsx).
// No names shown — feedback so far has all been anonymous (Danielle's call,
// 2026-08-26). Real quotes below, static/hardcoded for now (her call): no
// reviews table or admin UI, just edit the array when new ones come in.
// Cleaned up into full sentences with consistent punctuation 2026-08-26
// (Danielle's call) — same meaning/wording as what she sent, just smoothed
// into complete sentences. Quotation marks are added at render time below,
// not baked into the strings, so it's easy to swap in new reviews later
// without remembering to add them.
const reviews: string[] = [
  "I thought my dress shoes were ready to be thrown out, but after the repair and insole replacement, they have at least four to five more years of life.",
  "The shoes look great. It's so nice to have someone pick them up rather than searching for a repair place.",
  "The shoes look amazing, so clean and fresh, and the service was incredibly fast.",
  "The turnaround was quick, and I really appreciated the pickup coming right to me.",
];

const Reviews = () => {
  return (
    <section className="relative overflow-hidden py-20 md:py-28" style={{ backgroundColor: "#fff5cc" }}>
      <div className="container">
        <h2
          className="text-center text-5xl md:text-7xl uppercase mb-14 md:mb-16"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
        >
          Reviews
        </h2>

        <div className="grid gap-x-16 gap-y-12 md:grid-cols-2 max-w-5xl mx-auto">
          {reviews.map((quote, i) => (
            <p
              key={i}
              className="text-lg md:text-xl leading-relaxed"
              style={{ fontFamily: "'Instrument Sans', sans-serif", color: "#fdb600" }}
            >
              “{quote}”
            </p>
          ))}
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

export default Reviews;
