import facebook from "@/assets/icons/facebook.svg";
import instagram from "@/assets/icons/instagram.svg";
import tiktok from "@/assets/icons/tiktok.svg";
import youtube from "@/assets/icons/youtube.svg";

const socials = [
  { src: instagram, label: "Instagram", href: "#" },
  { src: facebook, label: "Facebook", href: "#" },
  { src: tiktok, label: "TikTok", href: "#" },
  { src: youtube, label: "YouTube", href: "#" },
];

const Footer = () => {
  return (
    <footer id="footer" className="bg-primary text-primary-foreground">
      <div className="container py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
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
        <div className="flex gap-6 text-sm">
          <a href="#" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">Terms & Conditions</a>
          <a href="#" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">Privacy Policy</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
