import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import logo from "@/assets/logo-cobbli.webp";
import instagram from "@/assets/icons/instagram.svg";
import tiktok from "@/assets/icons/tiktok.svg";
import x from "@/assets/icons/x.svg";

// Same hero photo as the real homepage (src/components/cobbli/Hero.tsx), so
// the waitlist page reads as "the real site with an email gate" rather than
// a bare placeholder. Hero.tsx swapped to this lifestyle shot 2026-08-25
// (Danielle's call) — this page had drifted onto the older workshop photo
// until now; keep these two in sync going forward. Served from /public,
// same as Hero.tsx.
const hero = "/assets/hero-lifestyle-soho.webp";

/** Basic client-side shape check before submit — not meant to be exhaustive,
 *  just enough to catch empty/obviously-malformed input before it hits the
 *  (eventual) Supabase insert. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const socials = [
  {
    src: instagram,
    label: "Instagram",
    href: "https://www.instagram.com/cobblidotcom?igsh=bmJ1MGYxY251ZG9l&utm_source=qr",
  },
  {
    src: tiktok,
    label: "TikTok",
    href: "https://www.tiktok.com/@cobblidotcom?_r=1&_t=ZP-95dDXUo1ht8",
  },
  {
    src: x,
    label: "X",
    href: "https://x.com/cobblidotcom",
  },
];

const ComingSoon = () => {
  // Second CTA (2026-09-01, Danielle's call) — inline email field for the
  // "waitlist" framing, separate from the Google Form the primary button
  // uses. Wired to the existing `waitlist` table (id, email, source,
  // created_at) — its RLS policy ("Anyone can join waitlist") already
  // requires source = 'coming_soon_page' and a valid-looking email, so the
  // insert below matches that exactly.
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [waitlistError, setWaitlistError] = useState("");

  const onWaitlistSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = waitlistEmail.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setWaitlistError("Enter a valid email");
      return;
    }
    setWaitlistError("");
    setWaitlistStatus("submitting");
    const { error } = await supabase
      .from("waitlist")
      .insert({ email: trimmed, source: "coming_soon_page" });
    if (error) {
      setWaitlistStatus("idle");
      // 23505 = unique_violation — there's a unique index on
      // (lower(email), source), so this fires when the same email has
      // already joined the coming-soon waitlist. That's not really a
      // failure from the customer's point of view, so tell them they're
      // already on it instead of a generic error.
      setWaitlistError(
        error.code === "23505" ? "You're already on the list" : "Something went wrong. Try again.",
      );
      return;
    }
    setWaitlistStatus("success");
  };

  usePageMeta({
    title: "Coming Soon — Cobbli",
    // "shoe and leather" -> "shoe and bag" 2026-09-15 (Danielle's call) —
    // moving copy away from shoe-only language as the business pivots to
    // cover bags too. Matches the h1 below.
    description:
      "Cobbli is coming soon to Manhattan. Expert shoe and bag repair, picked up and delivered to your door. Join the waitlist to be the first to know.",
    canonicalPath: "/",
  });

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-between px-6 py-10 text-white overflow-hidden"
      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
    >
      <img
        src={hero}
        alt="Woman walking down a cobblestone SoHo street in black slingback heels"
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
      {/* Same gradient the homepage hero uses, plus a flat wash so the logo,
          form, and social icons stay legible everywhere on the page, not just
          where the homepage's gradient is darkest. */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(61, 23, 0, 0.45)" }} />

      {/* Sized down 2026-08-26, same fix/reasoning as Header.tsx — the old
          h-32/h-40 was tuned for the previous SVG's ~18.5%-of-canvas glyph
          height; the new tightly-cropped logo.webp needs a much smaller
          class to render the same actual visual size. */}
      <div className="relative z-10 w-full flex justify-center">
        <img src={logo} alt="Cobbli" className="h-6 md:h-7 w-auto" />
      </div>

      {/* Restyled 2026-08-30 (Danielle's call) — "align to what we're doing
          on the site." Fraunces + Instrument Sans (2026-08-26 site-wide
          headline/body pairing, see index.html) replace Montserrat/Albert
          Sans; headline color switched white -> amber to match Hero.tsx's
          own treatment of the same photo+gradient-hero background. */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto py-10">
        {/* "Free shoe repairs..." -> "Shoe and bag repairs..." 2026-09-15
            (Danielle's call) — moving away from shoe-only language as the
            business pivots to cover bags too. Dropped "Free" along with it,
            matching her own candidate phrasing (neither "leather repairs"
            nor "shoe and bag repairs" kept the word) — easy to add back if
            the free-first-repair incentive should stay front and center in
            the headline itself. */}
        <h1
          className="text-3xl sm:text-4xl md:text-5xl leading-tight"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
        >
          Shoe and bag repairs to your doorstep
        </h1>
        {/* Single CTA now (2026-09-15, Danielle's call) — the primary
            Google-Form button and the intro paragraph above it were
            removed; the inline email capture below is the only signup path
            left, wired to the `waitlist` table (see onWaitlistSubmit
            above). The "or" divider that used to separate the two CTAs is
            gone with the first one — nothing left to divide. */}
        <div className="mt-8 flex flex-col items-center gap-3">
          {waitlistStatus === "success" ? (
            <div
              className="inline-flex items-center justify-center h-12 rounded-full px-6 font-semibold border-2 w-full sm:w-[300px]"
              style={{ borderColor: "#fdb600", color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif" }}
            >
              <Check className="h-4 w-4 mr-2" />
              You're on the list
            </div>
          ) : (
            <div className="w-full sm:w-[300px]">
              <form
                onSubmit={onWaitlistSubmit}
                className="flex items-center h-12 rounded-full pl-5 pr-1.5 gap-2 border-2 bg-white/10 backdrop-blur-sm"
                style={{ borderColor: "#fdb600" }}
              >
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => {
                    setWaitlistEmail(e.target.value);
                    if (waitlistError) setWaitlistError("");
                  }}
                  placeholder="Get on the waitlist"
                  aria-label="Email address"
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder-white/70 text-white"
                  style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                />
                <button
                  type="submit"
                  aria-label="Join the waitlist"
                  disabled={waitlistStatus === "submitting"}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-full shrink-0 transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "#fdb600" }}
                >
                  <ArrowRight className="h-4 w-4" style={{ color: "#3d1700" }} />
                </button>
              </form>
              {waitlistError && (
                <p
                  className="mt-1.5 text-xs text-left pl-5"
                  style={{ color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif" }}
                >
                  {waitlistError}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Reverted amber -> white 2026-09-01 (Danielle's call, same day —
          tried amber to match the rest of the page's palette, but she
          decided she prefers white here specifically). Back to the simple
          brightness/invert filter instead of the CSS-mask recolor
          technique. */}
      <div className="relative z-10 flex items-center gap-4">
        {socials.map((s) => (
          <a
            key={s.label}
            href={s.href}
            aria-label={s.label}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center hover:opacity-80 transition-opacity"
          >
            <img
              src={s.src}
              alt=""
              className="h-7 w-7"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </a>
        ))}
      </div>
    </main>
  );
};

export default ComingSoon;
