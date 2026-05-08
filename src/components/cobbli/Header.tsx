import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import logo from "@/assets/logo-cobbli.svg";
import accountIcon from "@/assets/icons/account.svg";
import bagIcon from "@/assets/icons/bag.svg";
import { useBag } from "@/context/BagContext";

const navLinks = [
  { label: "Start a Repair", to: "/#services" },
  { label: "Services", to: "/#services" },
  { label: "How It Works", to: "/#how-it-works" },
  { label: "FAQs", to: "/faqs" },
];

const Header = () => {
  const [open, setOpen] = useState(false);
  const { itemCount } = useBag();

  return (
    <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-soft">
      <div className="container flex h-24 md:h-28 items-center gap-6">
        <Link to="/" className="flex items-center" aria-label="Cobbli home">
          <img src={logo} alt="Cobbli" className="h-20 md:h-24 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium ml-6">
          {navLinks.map((l) => (
            <Link key={l.label} to={l.to} className="opacity-90 hover:opacity-100 transition-opacity">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          <Link to="/signin" state={{ from: "/" }} aria-label="Account" className="p-2 rounded-md hover:bg-primary-glow transition-colors">
            <img src={accountIcon} alt="" className="h-[22px] w-[22px]" />
          </Link>
          <Link to="/bag" aria-label={`Shopping bag, ${itemCount} item${itemCount === 1 ? "" : "s"}`} className="relative p-2 rounded-md hover:bg-primary-glow transition-colors">
            <img src={bagIcon} alt="" className="h-[22px] w-[22px]" />
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-status-orange text-[10px] font-bold text-primary flex items-center justify-center">
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
        <div className="md:hidden border-t border-primary-glow">
          <nav className="container py-4 flex flex-col gap-3 text-sm font-medium">
            {navLinks.map((l) => (
              <Link key={l.label} to={l.to} onClick={() => setOpen(false)} className="py-1 opacity-90">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
