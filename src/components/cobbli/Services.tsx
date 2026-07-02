import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ServiceCard from "@/components/cobbli/ServiceCard";
import ComingSoonVoteButton from "@/components/cobbli/ComingSoonVoteButton";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import CategoryFilterBar, {
  ALL_CATEGORIES_LABEL,
  type CategoryFilter,
} from "@/components/cobbli/CategoryFilterBar";
import { type Service } from "@/types/service";
import { useServices } from "@/hooks/useServices";

const ALL = ALL_CATEGORIES_LABEL;

/**
 * Homepage-only coming-soon card. Matches the active ServiceCard tile size
 * and shape, but with a muted image, "Coming soon" badge, no pricing, and
 * an inline vote button instead of a link to the detail page.
 */
const HomepageComingSoonCard = ({ s, serviceId }: { s: Service; serviceId?: string }) => {
  const title = s.cardName || s.name;
  return (
    <div className="group w-full rounded-xl overflow-hidden border border-border bg-card shadow-soft flex flex-col h-full">
      <div
        className="aspect-[4/3] flex items-center justify-center text-center px-4 relative"
        style={{ backgroundColor: "#3d1700", color: "#fdb600", opacity: 0.55 }}
      >
        <span className="text-xl">{title}</span>
        <span
          className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "#fdb600", color: "#3d1700", opacity: 1 }}
        >
          Coming soon
        </span>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <h3 className="text-[15px] leading-snug text-primary">{title}</h3>
        <div className="mt-auto">
          <ComingSoonVoteButton serviceId={serviceId} />
        </div>
      </div>
    </div>
  );
};

const Services = () => {
  const [active, setActive] = useState<CategoryFilter>(ALL);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const { data: services, isLoading } = useServices();

  const visibleActive = useMemo(() => {
    const list = (services ?? []).filter((s) => !s.isComingSoon);
    const filtered =
      active === ALL
        ? list
        : list.filter((s) => s.categories.includes(active as Service["categories"][number]));
    return [...filtered].sort((a, b) => a.rank - b.rank);
  }, [services, active]);

  const visibleComingSoon = useMemo(() => {
    const list = (services ?? []).filter((s) => s.isComingSoon);
    const filtered =
      active === ALL
        ? list
        : list.filter((s) => s.categories.includes(active as Service["categories"][number]));
    return [...filtered].sort((a, b) => a.rank - b.rank);
  }, [services, active]);

  const totalCount = visibleActive.length + visibleComingSoon.length;

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
  }, [active, totalCount]);

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
          <h2 className="mt-3 text-3xl md:text-5xl text-balance font-bold">
            What can we help with?
          </h2>
        </div>

        <CategoryFilterBar active={active} onChange={setActive} className="mb-8" />

        {isLoading ? (
          <BrandSpinner className="py-16" size="lg" />
        ) : totalCount === 0 ? (
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
              {visibleActive.map((s) => (
                <div
                  key={s.slug}
                  data-service-card
                  className="snap-start shrink-0 w-[calc(80%-0.5rem)] sm:w-[calc(50%-0.625rem)] md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1.125rem)]"
                >
                  <ServiceCard s={s} />
                </div>
              ))}
              {visibleComingSoon.map((s) => (
                <div
                  key={s.slug}
                  data-service-card
                  className="snap-start shrink-0 w-[calc(80%-0.5rem)] sm:w-[calc(50%-0.625rem)] md:w-[calc(33.333%-1rem)] lg:w-[calc(25%-1.125rem)]"
                >
                  <HomepageComingSoonCard s={s} serviceId={s.id} />
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
