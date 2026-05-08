import { useMemo, useRef, useState, useEffect } from "react";
import {
  Footprints,
  Hammer,
  Sparkles,
  Heart,
  Wrench,
  Scissors,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

type Category =
  | "All services"
  | "Heels & Soles"
  | "Stitching"
  | "Polish & Care"
  | "Restoration";

type Service = {
  icon: typeof Footprints;
  title: string;
  desc: string;
  category: Exclude<Category, "All services">;
};

const services: Service[] = [
  { icon: Footprints, title: "Heel replacement", desc: "Replace worn heels for everyday wear.", category: "Heels & Soles" },
  { icon: Footprints, title: "Full resole", desc: "New soles for tired everyday shoes.", category: "Heels & Soles" },
  { icon: Hammer, title: "Seam stitching", desc: "Re-stitch seams and reinforce uppers.", category: "Stitching" },
  { icon: Hammer, title: "Upper rebuild", desc: "Rebuild damaged leather uppers.", category: "Stitching" },
  { icon: Sparkles, title: "Polish & Renew", desc: "Hand-polished finish that brings shoes back to life.", category: "Polish & Care" },
  { icon: Heart, title: "Leather conditioning", desc: "Deep conditioning and protective treatments.", category: "Polish & Care" },
  { icon: Heart, title: "Leather dyeing", desc: "Restore color with custom dye work.", category: "Polish & Care" },
  { icon: Wrench, title: "Boot restoration", desc: "Heritage-grade restoration for boots you love.", category: "Restoration" },
  { icon: Scissors, title: "Custom work", desc: "Bespoke alterations from our master cobblers.", category: "Restoration" },
];

const categories: Category[] = [
  "All services",
  "Heels & Soles",
  "Stitching",
  "Polish & Care",
  "Restoration",
];

const Services = () => {
  const [active, setActive] = useState<Category>("All services");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const visible = useMemo(
    () => (active === "All services" ? services : services.filter((s) => s.category === active)),
    [active],
  );

  const showArrows = visible.length >= 5;

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateArrows);
    };
  }, [active]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-service-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <section id="services" className="py-20 md:py-28 bg-white">
      <div className="container">
        <div className="max-w-2xl mb-8">
          <p className="text-sm font-semibold tracking-widest uppercase text-status-orange">
            Services
          </p>
          <h2 className="mt-3 text-3xl md:text-5xl font-display font-600 text-balance">
            Book your <span className="highlight-mark">professional repair</span> today
          </h2>
        </div>

        {/* Category navigation */}
        <div
          role="tablist"
          aria-label="Service categories"
          className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border mb-8"
        >
          {categories.map((c) => {
            const isActive = c === active;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(c)}
                className={`relative -mb-px py-3 text-sm md:text-base font-medium transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                }`}
              >
                {c}
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-status-orange rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Carousel */}
        <div className="relative">
          {showArrows && canPrev && (
            <button
              type="button"
              aria-label="Previous services"
              onClick={() => scrollByCard(-1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 h-10 w-10 rounded-full bg-card border border-border shadow-soft flex items-center justify-center text-primary hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {showArrows && canNext && (
            <button
              type="button"
              aria-label="Next services"
              onClick={() => scrollByCard(1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 h-10 w-10 rounded-full bg-card border border-border shadow-soft flex items-center justify-center text-primary hover:bg-secondary transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          )}

          <div
            ref={scrollerRef}
            className="flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visible.map((s) => (
              <a
                key={s.title}
                href="#book"
                data-service-card
                className="group snap-start shrink-0 w-[calc(50%-0.5rem)] md:w-[calc(25%-1.125rem)] rounded-xl border border-border bg-card p-6 md:p-7 shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all"
              >
                <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <s.icon size={22} strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-lg font-display font-600">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Services;
