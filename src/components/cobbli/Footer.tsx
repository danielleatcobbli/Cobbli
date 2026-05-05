import instagram from "@/assets/icons/instagram.svg";
import tiktok from "@/assets/icons/tiktok.svg";

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
];

type FooterProps = {
  /** When true (e.g. inside the sign-up slide-out), legal links open in a new tab */
  legalLinksInNewTab?: boolean;
};

const Footer = ({ legalLinksInNewTab = false }: FooterProps) => {
  const legalLinkProps = legalLinksInNewTab
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <footer
      id="footer"
      className="text-white"
      style={{ backgroundColor: "#3d1700", fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="container py-10 flex flex-row items-center justify-between gap-6">
        <div className="flex flex-col gap-2 text-white" style={{ fontSize: "13px", fontWeight: 400 }}>
          <div className="flex items-center gap-3">
            <a href="/privacy-policy" className="underline" {...legalLinkProps}>
              Privacy Policy
            </a>
            <span aria-hidden="true">·</span>
            <a href="/terms-of-service" className="underline" {...legalLinkProps}>
              Terms of Service
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
              <img
                src={s.src}
                alt=""
                className="h-7 w-7"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
