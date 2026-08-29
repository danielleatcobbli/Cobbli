import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logoAmber from "@/assets/logo-cobbli.webp";
import logoCream from "@/assets/logo-cobbli-cream.webp";
import logoWhite from "@/assets/logo-cobbli-white.webp";
import accountIcon from "@/assets/icons/account.svg";
import bagIcon from "@/assets/icons/bag.svg";
import { useBag } from "@/context/BagContext";
import { useAuth } from "@/context/AuthContext";
import { trackEvent } from "@/lib/analytics";

// "Services" dropped from top nav 2026-08-26 (Danielle's call, matches her
// homepage mockup exactly) — Starter repair is meant to be the single
// starting point now, with services surfaced as a homepage teaser section
// and individual service detail pages still reachable by clicking into one,
// not browsed from a standalone nav destination. The /services page itself
// is untouched and still linked from the homepage's "View all" — only the
// top-nav shortcut is gone. Deeper Starter-repair/services flow changes
// (pricing on the checklist, linking a checklist item to its service page)
// are a separate, deliberately deferred pass.
const navLinks = [
  { label: "Start a Repair", to: "/start-repair" },
  { label: "How It Works", to: "/#how-it-works" },
  { label: "FAQs", to: "/faqs" },
];

/** Back to the original account.svg/bag.svg artwork 2026-08-27 (Danielle's
 *  call, after a detour through lucide's UserRound/ShoppingBag) — she liked
 *  the original icons' actual look, just wanted them as thick as the lucide
 *  ones had ended up. account.svg/bag.svg are baked white internally (an SVG
 *  luminance mask forces their fill to white), so they're rendered as a CSS
 *  `mask`: the icon's alpha shape masks a plain background-color div in
 *  whatever the header's foreground color is, same as the original approach.
 *
 *  ROOT CAUSE FOUND 2026-08-27: every prior weight attempt (stacked
 *  drop-shadows, blur+contrast, and the first pass at this feMorphology
 *  dilate) put the `filter` on the SAME element as the `mask`. CSS always
 *  applies `filter` BEFORE `mask` in its effects pipeline — so the filter
 *  was operating on the plain colored 26x26 box (already fully opaque
 *  everywhere, nothing for blur/shadow/dilate to visibly grow), and the
 *  *unmodified* icon-shaped mask was applied afterward, clipping the result
 *  right back down to the original outline. Net effect: zero visible change,
 *  every time, no matter how strong the filter — which is exactly what
 *  Danielle kept reporting. Fix: put the filter on a WRAPPER around the
 *  masked span instead. The wrapper's filter runs on the child's already-
 *  masked (real icon-shaped) output, so the dilate actually grows the icon's
 *  edges this time. */
const HeaderIcon = ({ src, color }: { src: string; color: string }) => (
  <span className="block h-[26px] w-[26px]" style={{ filter: "url(#header-icon-dilate)" }}>
    <span
      className="block h-full w-full"
      style={{
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  </span>
);

/** Invisible SVG housing the dilate filter HeaderIcon references above —
 *  has to actually be in the DOM for `filter: url(#header-icon-dilate)` to
 *  resolve. Rendered once by Header itself, right before the real markup.
 *  colorInterpolationFilters="sRGB" is the fix described above — keeps the
 *  dilated icon exactly #fdb600 (or whatever `color` is) instead of shifting
 *  toward neon yellow. */
const IconDilateFilter = () => (
  <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
    {/* Radius 1.7 was tuned against the filter-order bug that made every
        prior radius invisible (see HeaderIcon comment) — once the wrapper
        fix made the filter actually apply, 1.7 read as way too heavy. Backed
        off to 0.85, then further to 0.4, 2026-08-27 (Danielle's call) — she
        also asked to strip the same filter off the footer's social icons
        entirely, since this weight bump was only ever meant for the header's
        account/bag icons. */}
    <filter id="header-icon-dilate" colorInterpolationFilters="sRGB">
      <feMorphology operator="dilate" radius="0.4" />
    </filter>
  </svg>
);

type Props = {
  /** Floats the header over whatever's behind it (no bg, no shadow, amber
   *  text) instead of the normal solid brown bar — the goodgirlsnacks.com-
   *  style "no menu bar, it just sits on the hero photo" look Danielle asked
   *  to preview 2026-08-25. Only meaningful when something with real height
   *  (a hero image) sits directly behind the header in a shared `relative`
   *  wrapper — see Index.tsx. Every other page keeps the normal solid header
   *  by not passing this prop. */
  transparent?: boolean;
  /** "amber" is the default (and now site-wide) inner-page look — a solid
   *  **amber** (#fdb600) bar with cream (#fff5cc) text/icons/logo. It started
   *  2026-08-27 as a one-page trial on Faqs.tsx (compared against cream-bar
   *  and white-on-amber variants); Danielle preferred it and asked to roll it
   *  out everywhere the same day. "cream" (the old default — cream bar,
   *  amber text/icons/logo) and "amber-white" (amber bar, white text/icons)
   *  are kept around as options but no longer used by any page. "brown" is
   *  also dormant/unused. Position stays sticky/normal-flow — there's no
   *  hero photo behind it to float over (that's `transparent`, homepage
   *  only). */
  theme?: "brown" | "cream" | "amber" | "amber-white";
};

const Header = ({ transparent = false, theme = "amber" }: Props) => {
  const creamBar = theme === "cream";
  const amberBar = theme === "amber" || theme === "amber-white";
  const amberWhite = theme === "amber-white";
  const customBar = creamBar || amberBar;
  // Icon/logo/bg color per variant: transparent floats amber text/logo over
  // a photo (homepage only); the cream bar (most inner pages) uses amber
  // text/icons/logo against its cream background; the amber bar (trial,
  // Faqs.tsx only) is the inverse — cream OR white text/icons/logo against
  // amber, depending on which of the two trial themes is passed; "brown" is
  // dormant and unused.
  const barBg = creamBar ? "#fff5cc" : amberBar ? "#fdb600" : undefined;
  const iconColor = transparent
    ? "#fdb600"
    : creamBar
      ? "#fdb600"
      : amberBar
        ? (amberWhite ? "#ffffff" : "#fff5cc")
        : "#ffffff";
  const logo = transparent
    ? logoAmber
    : creamBar
      ? logoAmber
      : amberBar
        ? (amberWhite ? logoWhite : logoCream)
        : logoWhite;
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { itemCount } = useBag();
  const { user } = useAuth();

  const handleHowItWorksClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/") {
      e.preventDefault();
      const el = document.getElementById("how-it-works");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <>
      <IconDilateFilter />
      <header
      className={
        transparent
          ? "absolute inset-x-0 top-0 z-50 bg-transparent"
          : customBar
            ? "sticky top-0 z-50 shadow-soft"
            : "sticky top-0 z-50 bg-primary text-primary-foreground shadow-soft"
      }
      style={
        transparent
          ? { color: "#fdb600", fontFamily: "'Instrument Sans', sans-serif" }
          : customBar
            ? {
                backgroundColor: barBg,
                color: iconColor,
                fontFamily: "'Instrument Sans', sans-serif",
              }
            : undefined
      }
    >
      <div className="container flex h-24 md:h-28 items-center gap-6">
        {/* Sized down twice 2026-08-26 (Danielle's call, urgent fixes) — the
            old h-36/h-44 sizing was tuned for the previous SVG wordmark,
            whose 300x300 square canvas had the glyphs occupying only ~18.5%
            of that height (lots of built-in empty padding). The new
            logo.webp (the real photo-cutout logo) is cropped tight to its
            visible pixels with no padding, so the same height class first
            rendered ~5x too tall (fixed to h-7/h-8), then still read as too
            big, so sized down again to h-5/h-6. */}
        <Link to="/" className="flex items-center" aria-label="Cobbli home">
          <img src={logo} alt="Cobbli" className="h-5 md:h-6 w-auto" />
        </Link>

        {/* Uppercase nav 2026-08-26 (Danielle's call — wants a cleaner,
            more Hot-Girl-Pickles feel). Applied to both header variants
            since it's a low-risk pure CSS change, not homepage-scoped. Bolded
            + nudged down a couple px (mt-1) so it optically centers against
            the taller logo instead of sitting slightly high, 2026-08-26. */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-extrabold uppercase tracking-wide ml-6 mt-1">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              onClick={(e) => {
                if (l.label === "How It Works") handleHowItWorksClick(e);
                if (l.label === "Start a Repair") trackEvent("start_repair", { source: "nav" });
              }}
              className="opacity-90 hover:opacity-100 transition-opacity"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          {user ? (
            <Link to="/account" aria-label="My account" className="p-2 rounded-md hover:bg-primary-glow transition-colors">
              <HeaderIcon src={accountIcon} color={iconColor} />
            </Link>
          ) : (
            <Link
              to="/signin"
              state={{ from: `${location.pathname}${location.search}${location.hash}` }}
              aria-label="Sign in"
              className="p-2 rounded-md hover:bg-primary-glow transition-colors"
            >
              <HeaderIcon src={accountIcon} color={iconColor} />
            </Link>
          )}
          <Link to="/bag" aria-label={`Shopping bag, ${itemCount} item${itemCount === 1 ? "" : "s"}`} className="relative p-2 rounded-md hover:bg-primary-glow transition-colors">
            <HeaderIcon src={bagIcon} color={iconColor} />
            {/* White pill + brown number/border instead of a solid brown
                circle (2026-08-27, Danielle's call — didn't like the solid
                brown fill). White reads distinctly against both the cream
                and amber bar (and the border keeps it from disappearing
                into cream specifically), and brown-on-white is about as
                high-contrast as this palette gets. */}
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ backgroundColor: "#ffffff", color: "#3d1700", border: "1.5px solid #3d1700" }}
            >
              {itemCount}
            </span>
          </Link>
          <button
            className="md:hidden p-2 rounded-md hover:bg-primary-glow"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div
          className={
            transparent
              ? "md:hidden bg-primary text-primary-foreground"
              : customBar
                ? "md:hidden"
                : "md:hidden border-t border-primary-glow"
          }
          style={
            customBar
              ? {
                  backgroundColor: barBg,
                  borderTop: `1px solid ${iconColor}`,
                  color: iconColor,
                }
              : undefined
          }
        >
          <nav className="container py-4 flex flex-col gap-3 text-sm font-extrabold uppercase tracking-wide">
            {navLinks.map((l) => (
              <Link
                key={l.label}
                to={l.to}
                onClick={(e) => {
                  if (l.label === "How It Works") handleHowItWorksClick(e);
                  if (l.label === "Start a Repair") trackEvent("start_repair", { source: "nav_mobile" });
                  setOpen(false);
                }}
                className="py-1 opacity-90"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
      </header>
    </>
  );
};

export default Header;
