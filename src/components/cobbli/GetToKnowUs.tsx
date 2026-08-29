// New section added 2026-08-26 (Danielle's call, matches her homepage
// mockup) — a static, hand-curated row of Instagram photos rather than a
// live feed (her call: simpler, no risk of an unwanted post showing up
// automatically, matches the mockup exactly). Swap the three placeholder
// tiles below for real photos whenever Danielle sends them (public/social-
// photos/, see the README there), same pattern as every other image swap
// this session. Handle/link reused from the same Instagram URL already in
// ComingSoon.tsx's social row — it was already clickable before Danielle's
// 2026-08-26 follow-up, just not visually obvious against the amber
// background; no functional change needed there.
const INSTAGRAM_URL =
  "https://www.instagram.com/cobblidotcom?igsh=bmJ1MGYxY251ZG9l&utm_source=qr";

const GetToKnowUs = () => {
  return (
    <section style={{ backgroundColor: "#fdb600" }}>
      <div className="container pt-14 md:pt-16 pb-14 md:pb-16 text-center">
        <h2
          className="text-5xl md:text-7xl uppercase"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fff5cc" }}
        >
          Get to know us
        </h2>
        {/* Bumped from text-sm 2026-08-27 (Danielle's call) — got lost
            sitting directly under the huge text-5xl/7xl heading above it. */}
        <a
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-4 text-xl md:text-2xl font-semibold underline"
          style={{ fontFamily: "'Instrument Sans', sans-serif", color: "#fff5cc" }}
        >
          @cobblidotcom
        </a>
      </div>

      {/* Gap between tiles (2026-08-26, Danielle's call) shows the amber
          section background through, rather than photos touching edge to
          edge — the grid has no background of its own, so the gap reveals
          whatever's behind it (the section's amber) automatically. */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 px-3 md:px-4 pb-10 md:pb-14">
        {[1, 2, 3].map((i) => (
          <a
            key={i}
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="aspect-square rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity"
            style={{ backgroundColor: i === 2 ? "#3d1700" : "#e8a400" }}
            aria-label="View on Instagram"
          />
        ))}
      </div>
    </section>
  );
};

export default GetToKnowUs;
