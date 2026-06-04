import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ServiceCard from "@/components/cobbli/ServiceCard";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import { CATEGORIES_ORDERED, type Service } from "@/types/service";
import { useServices } from "@/hooks/useServices";

const ALL = "All services" as const;
const categories = [ALL, ...CATEGORIES_ORDERED];

const Services = () => {
  const [active, setActive] = useState<(typeof categories)[number]>(ALL);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const { data: services, isLoading } = useServices();

  const visible = useMemo(() => {
    const list = services ?? [];
    const filtered =
      active === ALL
        ? list
        : list.filter((s) => s.categories.includes(active as Service["categories"][number]));
    return [...filtered].sort((a, b) => a.rank - b.rank);
  }, [services, active]);

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
  }, [active, visible.length]);

  const scrollByCard = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-service-card]");
    const step = card ? card.offsetWidth + 24 : el.clientWidth * 0.8;
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

        {isLoading ? (
          <BrandSpinner className="py-16" size="lg" />
        ) : visible.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center">
            No services in this category yet.
          </p>
        ) : (
          <div className="relative">
            {canPrev && (
              <button
                type="button"
                aria-label="Previous services"
                onClick={() => scrollByCard(-1)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 h-10 w-10 rounded-full bg-card border border-border shadow-soft flex items-center justify-center text-primary hover:bg-secondary transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            {canNext && (
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
              className="flex gap-5 md:gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visible.map((s) => (
                <div
                  key={s.slug}
                  data-service-card
                  className="snap-start shrink-0 w-[calc(80%-0.5rem)] sm:w-[calc(50%-0.625rem)] md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1.125rem)]"
                >
                  <ServiceCard s={s} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Services;
