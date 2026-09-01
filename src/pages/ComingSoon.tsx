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

// Public beta submission form (Danielle's Google Form) — the primary CTA's
// destination. Update this link if the form URL ever changes.
const BETA_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeABCZMUz8nf1DlQ_NvVuCCPyuvpWkoUQGfVFLayPjQHRIj-Q/viewform?usp=header";

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
    description:
      "Cobbli is coming soon to Manhattan. Expert shoe and leather repair, picked up and delivered to your door. Join the waitlist to be the first to know.",
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
        <h1
          className="text-3xl sm:text-4xl md:text-5xl leading-tight"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
        >
          Free shoe repairs to your doorstep
        </h1>
        {/* Back below the headline 2026-08-13 (Danielle's call — reverted
            the earlier move-above-headline change). */}
        <p
          className="mt-5 text-sm md:text-base font-normal max-w-md"
          style={{ fontFamily: "'Instrument Sans', sans-serif", color: "#ffffff" }}
        >
          We're selecting a limited number of shoes for a free repair delivered to your door.
          We'll select shoes based on fit with our services and capacity on a rolling basis.
        </p>

        {/* Two CTAs, two different intake points (2026-09-01, Danielle's
            call): the primary button is the free-repair incentive itself
            (amber/filled, matches Hero.tsx's pill CTA) and still sends
            people to the Google Form. The second is a standalone inline
            email capture framed as "join the waitlist" — she plans to
            reference the growing count directly in social content. See the
            onWaitlistSubmit comment above for its current preview-only
            status. */}
        {/* Always stacked (not flex-row at sm+) — the "or" divider below only
            reads correctly as a horizontal rule between two stacked items,
            not squeezed into a side-by-side row. Matches the approved
            mockup at every width. */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href={BETA_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-12 rounded-full px-8 font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#fdb600", color: "#3d1700", fontFamily: "'Instrument Sans', sans-serif" }}
          >
            Get on the list for a free repair
          </a>

          {/* "or" divider (2026-09-01, Danielle's call) — makes it visually
              clear these are two distinct paths (Google Form vs. inline
              waitlist signup) rather than one flowing block of CTAs. Same
              pattern as SignIn/SignUp's own "or" divider. */}
          <div className="w-full sm:w-[300px] flex items-center gap-3">
            <div className="flex-1 h-px" style={{ backgroundColor: "rgba(253, 182, 0, 0.35)" }} />
            <span
              className="text-[11px] uppercase tracking-wide"
              style={{ color: "rgba(255, 255, 255, 0.55)", fontFamily: "'Instrument Sans', sans-serif" }}
            >
              or
            </span>
            <div className="flex-1 h-px" style={{ backgroundColor: "rgba(253, 182, 0, 0.35)" }} />
          </div>

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

      {/* Recolored white -> amber (2026-09-01, Danielle's call) — matches
          the amber treatment Header.tsx already uses for icons sitting on
          top of a hero photo, so this page's whole palette stays amber
          instead of introducing white as a one-off. CSS mask (not a filter)
          since these are baked monochrome SVGs — same technique used
          site-wide for icon recoloring, see Header.tsx/Footer.tsx. */}
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
            <span
              aria-hidden="true"
              className="h-7 w-7 inline-block"
              style={{
                backgroundColor: "#fdb600",
                WebkitMaskImage: `url(${s.src})`,
                maskImage: `url(${s.src})`,
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
              }}
            />
          </a>
        ))}
      </div>
    </main>
  );
};

export default ComingSoon;
