// Restyled 2026-08-26 (Danielle's call) to match her Canva homepage mockup
// exactly, per her reference screenshot — amber section (#fdb600), photo
// tiles with the step title overlaid directly on the top-left of the photo,
// and the description sitting below the photo on the amber page background
// (not in a separate dark band — this reference screenshot is the source of
// truth over an earlier, since-superseded "make this section cream" note).
// Real step copy is unchanged.
//
// Real photos wired in 2026-08-27 — Danielle dropped "Step 1/2/3" into
// public/how-it-works-photos/; cropped to square + converted to webp
// (src/assets/how-it-works/) and matched 1:1 to these three steps by content
// (phone/texting -> tell us what's wrong, courier at the door -> schedule
// your pickup, cobbler at the bench -> we handle the rest). A dark
// bottom-gradient overlay was added under the tiles so the title text stays
// legible over a busy photo instead of the flat dark placeholder color.
import photoTellUs from "@/assets/how-it-works/tell-us-whats-wrong.webp";
import photoSchedule from "@/assets/how-it-works/schedule-your-pickup.webp";
import photoWeHandle from "@/assets/how-it-works/we-handle-the-rest.webp";

const steps = [
  {
    n: "1",
    title: "Tell us what's wrong",
    desc: "Tell us what's wrong with your shoes or send us a photo or video. Either way, we'll recommend the right repairs.",
    photo: photoTellUs,
  },
  {
    n: "2",
    title: "Schedule your pickup",
    desc: "Check out and select the pickup window that works best for you. We'll come to you then.",
    photo: photoSchedule,
  },
  {
    n: "3",
    title: "We handle the rest",
    desc: "We repair your shoes in-house and let you know as soon as they're ready to schedule your return.",
    photo: photoWeHandle,
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="relative overflow-hidden py-16 md:py-20" style={{ backgroundColor: "#fdb600" }}>
      <div className="container">
        {/* Enlarged + uppercased 2026-08-26 (Danielle's call) to match the
            consistent big-heading treatment across every homepage section
            now (all text-5xl md:text-7xl uppercase). Italic "works" kept for
            the same accent effect, just in caps now via text-transform. */}
        <h2
          className="text-center text-5xl md:text-7xl uppercase mb-10 md:mb-12"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fff5cc" }}
        >
          How it <span style={{ fontStyle: "italic", fontWeight: 500 }}>works</span>
        </h2>

        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n}>
              <div className="relative aspect-square rounded-xl overflow-hidden" style={{ backgroundColor: "#3d1700" }}>
                <img
                  src={s.photo}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Dark gradient wash so the title stays legible over a real
                    (sometimes light/busy) photo instead of the flat
                    placeholder color it used to sit on. */}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, rgba(61,23,0,0.55) 0%, rgba(61,23,0,0.05) 35%, rgba(61,23,0,0.05) 65%, rgba(61,23,0,0.6) 100%)" }}
                  aria-hidden="true"
                />
                <span
                  className="absolute bottom-3 right-4 text-6xl"
                  style={{ fontFamily: "'Fraunces', serif", color: "rgba(255,245,204,0.35)" }}
                  aria-hidden="true"
                >
                  {s.n}
                </span>
                <h3
                  className="absolute top-4 left-4 right-4 text-xl leading-snug"
                  style={{ fontFamily: "'Instrument Sans', sans-serif", fontWeight: 500, color: "#fff5cc" }}
                >
                  {s.title}
                </h3>
              </div>
              <p
                className="mt-3 text-sm leading-snug"
                style={{ fontFamily: "'Instrument Sans', sans-serif", color: "#fff5cc" }}
              >
                {s.desc}
              </p>
            </div>
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
          d="M0,25 C240,60 480,60 720,38 C960,15 1200,15 1440,50 L1440,60 L0,60 Z"
          fill="#fff5cc"
        />
      </svg>
    </section>
  );
};

export default HowItWorks;
