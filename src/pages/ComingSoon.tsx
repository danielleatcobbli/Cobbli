import { usePageMeta } from "@/hooks/usePageMeta";
import logo from "@/assets/logo-cobbli.svg";
import instagram from "@/assets/icons/instagram.svg";
import tiktok from "@/assets/icons/tiktok.svg";
import x from "@/assets/icons/x.svg";

// Same hero photo + copy as the real homepage (src/components/cobbli/Hero.tsx),
// so the waitlist page reads as "the real site with an email gate" rather than
// a bare placeholder. Served from /public, same as Hero.tsx.
const hero = "/assets/hero-cobbler.webp";

// Public beta submission form (Danielle's Google Form) — replaces the old
// inline email-capture form 2026-08-13 (Danielle's call). The form itself
// already collects email, so there's no reason to also collect it here first
// — that was just extra friction before the real intake point. Update this
// link if the form URL ever changes.
const BETA_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeABCZMUz8nf1DlQ_NvVuCCPyuvpWkoUQGfVFLayPjQHRIj-Q/viewform?usp=header";

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
  usePageMeta({
    title: "Coming Soon — Cobbli",
    description:
      "Cobbli is coming soon to Manhattan. Expert shoe and leather repair, picked up and delivered to your door. Join the waitlist to be the first to know.",
    canonicalPath: "/",
  });

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-between px-6 py-10 text-white overflow-hidden"
      style={{ fontFamily: "'Albert Sans', sans-serif" }}
    >
      <img
        src={hero}
        alt="Master cobbler restoring a leather brogue shoe in a workshop"
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
        decoding="async"
      />
      {/* Same gradient the homepage hero uses, plus a flat wash so the logo,
          form, and social icons stay legible everywhere on the page, not just
          where the homepage's gradient is darkest. */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0" style={{ backgroundColor: "rgba(61, 23, 0, 0.45)" }} />

      <div className="relative z-10 w-full flex justify-center">
        <img src={logo} alt="Cobbli" className="h-32 md:h-40 w-auto" />
      </div>

      {/* Headline/subhead switched to Montserrat 2026-08-13 (Danielle's call
          — she felt Playfair Display read as outdated, tried a Montserrat
          mockup, preferred it). Note the old Playfair Display value was
          actually never being loaded by index.html's Google Fonts link
          (Frank Ruhl Libre / Albert Sans / Public Sans / Cormorant Garamond
          only), so this page's headline was silently falling back to the
          browser's generic serif the whole time — Montserrat is now properly
          added to that font list, so this is also a real bug fix, not just a
          style swap. */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center max-w-xl mx-auto py-10">
        <h1
          className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight text-white md:whitespace-nowrap"
          style={{ fontFamily: "'Montserrat', sans-serif" }}
        >
          Free shoe repairs to your doorstep
        </h1>
        {/* Back below the headline 2026-08-13 (Danielle's call — reverted
            the earlier move-above-headline change). */}
        <p
          className="mt-5 text-sm md:text-base font-normal max-w-md"
          style={{ fontFamily: "'Montserrat', sans-serif", color: "#ffffff" }}
        >
          We're selecting a limited number of shoes for a free repair delivered to your door.
          We'll select shoes based on fit with our services and capacity on a rolling basis.
        </p>

        {/* Replaces the old inline email-capture form (waitlist table insert)
            2026-08-13 (Danielle's call) — sends straight to the beta
            submission form instead, which collects email itself. */}
        <a
          href={BETA_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center justify-center h-12 rounded-md px-8 font-bold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#fdb600", color: "#3d1700", fontFamily: "'Montserrat', sans-serif" }}
        >
          Get on the list
        </a>
      </section>

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
