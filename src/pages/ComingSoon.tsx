import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePageMeta } from "@/hooks/usePageMeta";
import logo from "@/assets/logo-cobbli.webp";
import instagram from "@/assets/icons/instagram.svg";
import tiktok from "@/assets/icons/tiktok.svg";
import x from "@/assets/icons/x.svg";

const hero = "/assets/hero-bags-v2.webp";

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
      "Expert bag repair, made simple. We pick up, repair, and return the bags you love. Coming soon to NYC. Join the waitlist.",
    canonicalPath: "/",
  });

  return (
    <main
      className="relative min-h-screen min-h-[100svh] flex flex-col items-center justify-between px-[22px] pt-[30px] pb-6 sm:px-7 sm:pt-9 text-[#fff5e9] bg-[#3d1700] overflow-hidden"
      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
    >
      <img
        src={hero}
        alt="Burgundy leather handbag carried along a rainy SoHo street"
        className="absolute inset-0 h-full w-full object-cover object-center sm:object-[center_75%]"
        style={{ filter: "saturate(1.15) contrast(1.05)" }}
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,rgba(35,18,10,.27),rgba(35,18,10,.52) 38%,rgba(35,18,10,.48) 65%,rgba(35,18,10,.65))" }} />
      <div className="relative z-10 w-full flex justify-center">
        <img src={logo} alt="Cobbli" className="h-[29px] w-auto" />
      </div>
      <section className="relative z-10 flex-1 w-full flex flex-col items-center justify-center text-center max-w-[700px] mx-auto pt-[65px] pb-[60px]">
        <h1
          className="text-[clamp(32px,8vw,40px)] min-[481px]:text-[clamp(44px,6.8vw,68px)] leading-[1.04] tracking-[-1px] sm:tracking-[-1.8px] mb-6"
          style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#fdb600" }}
        >
          Bag repair,<br /><em style={{ fontWeight: 500 }}>without the hassle.</em>
        </h1>
        <p className="text-base sm:text-lg leading-[1.6] max-w-[290px] sm:max-w-[480px] text-balance">
          Snap a pic, get a recommendation, and we take care of the rest - pickup, repair, and return to your doorstep.
        </p>
        <div className="w-full max-w-[340px] flex flex-col items-center gap-3 mt-[34px] sm:mt-10">
          {waitlistStatus === "success" ? (
            <div
              className="inline-flex items-center justify-center h-[52px] rounded-full px-6 font-semibold border-2 w-full"
              style={{ borderColor: "#fdb600", color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif" }}
            >
              <Check className="h-4 w-4 mr-2" />
              You're on the list
            </div>
          ) : (
            <div className="w-full">
              <form
                onSubmit={onWaitlistSubmit}
                className="flex items-center h-[52px] rounded-full pl-[19px] pr-[5px] gap-2 border-2 bg-[rgba(30,15,5,.3)] backdrop-blur-sm"
                style={{ borderColor: "#fdb600" }}
              >
                <input
                  type="email"
                  value={waitlistEmail}
                  onChange={(e) => {
                    setWaitlistEmail(e.target.value);
                    if (waitlistError) setWaitlistError("");
                  }}
                  placeholder="Join the waitlist"
                  autoComplete="email"
                  aria-label="Email address"
                  className="flex-1 min-w-0 bg-transparent text-base outline-offset-4 placeholder-[#fff5e9]/85 text-[#fff5e9]"
                  style={{ fontFamily: "'Instrument Sans', sans-serif" }}
                />
                <button
                  type="submit"
                  aria-label="Join the waitlist"
                  disabled={waitlistStatus === "submitting"}
                  className="inline-flex items-center justify-center h-10 w-10 rounded-full shrink-0 transition-opacity hover:opacity-90 disabled:opacity-60"
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
      <div className="relative z-10 flex items-center gap-[22px]">
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
              className="h-[22px] w-[22px]"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </a>
        ))}
      </div>
    </main>
  );
};

export default ComingSoon;
