import logo from "@/assets/logo-cobbli.svg";
import facebook from "@/assets/icons/facebook.svg";
import instagram from "@/assets/icons/instagram.svg";
import tiktok from "@/assets/icons/tiktok.svg";
import youtube from "@/assets/icons/youtube.svg";

const cols = [
  {
    title: "Services",
    links: ["Heels & soles", "Stitching", "Polish & renew", "Leather care", "Boot restoration"],
  },
  {
    title: "Company",
    links: ["About Cobbli", "Our craftsmen", "Sustainability", "Press", "Careers"],
  },
  {
    title: "Help",
    links: ["FAQs", "Contact us", "Track an order", "Returns", "Pricing"],
  },
];

const socials = [
  { src: instagram, label: "Instagram", href: "#" },
  { src: facebook, label: "Facebook", href: "#" },
  { src: tiktok, label: "TikTok", href: "#" },
  { src: youtube, label: "YouTube", href: "#" },
];

const Footer = () => {
  return (
    <footer id="footer" className="bg-primary text-primary-foreground">
      <div className="container py-16">
        <div className="grid gap-12 md:grid-cols-[1.2fr_2fr]">
          <div>
            <img src={logo} alt="Cobbli" className="h-10 w-auto" />
            <p className="mt-5 max-w-sm text-sm text-primary-foreground/75 leading-relaxed">
              Old-world cobblery, delivered to your doorstep. Restoring the shoes you love
              since day one.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="h-9 w-9 rounded-full bg-primary-glow flex items-center justify-center hover:bg-status-orange transition-colors"
                >
                  <img src={s.src} alt="" className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
            {cols.map((c) => (
              <div key={c.title}>
                <h4 className="text-sm font-display font-700 tracking-wide uppercase text-status-cream">
                  {c.title}
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {c.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 pt-6 border-t border-primary-glow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-primary-foreground/70">
          <p>© {new Date().getFullYear()} Cobbli Ltd. All rights reserved.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-primary-foreground">Terms & Conditions</a>
            <a href="#" className="hover:text-primary-foreground">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
