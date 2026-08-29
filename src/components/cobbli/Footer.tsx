import instagram from "@/assets/icons/instagram.svg";
import tiktok from "@/assets/icons/tiktok.svg";
import x from "@/assets/icons/x.svg";

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

type FooterProps = {
  /** When true (e.g. inside the sign-up slide-out), legal links open in a new tab */
  legalLinksInNewTab?: boolean;
};

const Footer = ({ legalLinksInNewTab = false }: FooterProps) => {
  const legalLinkProps = legalLinksInNewTab
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  // Cream bg + amber text/icons 2026-08-27 (Danielle's call) — back to
  // matching the cream-bar/amber Header on every inner page, site-wide
  // (footer never sits over the hero photo, so there's no homepage
  // exception here the way there is for the header). Text-shadow tried the
  // same day and pulled same-day — Danielle found it made things harder to
  // read, not easier — so legibility here comes from font-weight alone now
  // (bumped 400 -> 700) instead.
  //
  // Social icon dilate filter removed 2026-08-27 (Danielle's call) — she
  // only wanted the header's account/bag icons bolded, not these. Back to a
  // plain masked span, no filter at all.
  return (
    <footer
      id="footer"
      style={{
        backgroundColor: "#fff5cc",
        color: "#fdb600",
        fontFamily: "'Albert Sans', sans-serif",
      }}
    >
      <div className="container py-10 flex flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-2" style={{ fontSize: "13px", fontWeight: 700, color: "#fdb600" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <a href="/privacy-policy" className="underline" {...legalLinkProps}>
              Privacy Policy
            </a>
            <span aria-hidden="true">·</span>
            <a href="/cookie-policy" className="underline" {...legalLinkProps}>
              Cookie Policy
            </a>
            <span aria-hidden="true">·</span>
            <a href="/terms-conditions" className="underline" {...legalLinkProps}>
              Terms & Conditions
            </a>
            <span aria-hidden="true">·</span>
            <a href="/blog" className="underline" {...legalLinkProps}>
              Blog
            </a>
          </div>
          <p>© 2026 Cobbli. All Rights Reserved.</p>
        </div>

        <div className="flex items-center gap-3">
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
                className="block h-8 w-8"
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
      </div>
    </footer>
  );
};

export default Footer;
