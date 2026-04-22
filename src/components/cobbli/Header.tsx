import { useState } from "react";
import { Menu, X } from "lucide-react";
import logo from "@/assets/logo-cobbli.svg";
import accountIcon from "@/assets/icons/account.svg";
import bagIcon from "@/assets/icons/bag.svg";

const navLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Services", href: "#services" },
  { label: "Why Cobbli", href: "#why" },
  { label: "Help", href: "#footer" },
];

const Header = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-soft">
      <div className="container flex h-20 md:h-24 items-center justify-between gap-6">
        <a href="#top" className="flex items-center" aria-label="Cobbli home">
          <img src={logo} alt="Cobbli" className="h-14 md:h-16 w-auto" />
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {navLinks.map((l) => (
            <a key={l.href} href={l.href} className="opacity-90 hover:opacity-100 transition-opacity">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href="#account" aria-label="Account" className="p-2 rounded-md hover:bg-primary-glow transition-colors">
            <img src={accountIcon} alt="" className="h-[22px] w-[22px]" />
          </a>
          <a href="#bag" aria-label="Shopping bag" className="relative p-2 rounded-md hover:bg-primary-glow transition-colors">
            <img src={bagIcon} alt="" className="h-[22px] w-[22px]" />
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-status-orange text-[10px] font-bold text-primary flex items-center justify-center">
              0
            </span>
          </a>
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
        <div className="md:hidden border-t border-primary-glow">
          <nav className="container py-4 flex flex-col gap-3 text-sm font-medium">
            {navLinks.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-1 opacity-90">
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
