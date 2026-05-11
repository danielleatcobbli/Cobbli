import { useMemo, useState } from "react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link } from "react-router-dom";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import ConsultationBanner from "@/components/cobbli/ConsultationBanner";
import {
  CATEGORIES_ORDERED,
  SERVICES,
  type Service,
} from "@/data/services";
import ServiceCard from "@/components/cobbli/ServiceCard";

const ALL = "All services" as const;
const categories = [ALL, ...CATEGORIES_ORDERED];

const Services = () => {
  const [active, setActive] = useState<(typeof categories)[number]>(ALL);

  usePageMeta({
    title: "Services — Cobbli",
    description:
      "Browse Cobbli's NYC shoe repair services: sole and heel repair, zipper and strap fixes, cleaning and preventative care. Transparent pricing, fast turnaround.",
  });

  const visible = useMemo(() => {
    const list =
      active === ALL
        ? SERVICES
        : SERVICES.filter((s) => s.categories.includes(active as Service["categories"][number]));
    return [...list].sort((a, b) => a.rank - b.rank);
  }, [active]);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />

      <section className="flex-1 py-16 md:py-20">
        <div className="container">
          <h1 className="text-3xl md:text-5xl font-display font-600 text-primary mb-8">
            Our services.
          </h1>

          <div
            role="tablist"
            aria-label="Service categories"
            className="flex flex-wrap gap-x-6 gap-y-2 border-b border-border mb-10"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
            {visible.map((s) => (
              <ServiceCard key={s.slug} s={s} />
            ))}
          </div>

          <div className="mt-12">
            <ConsultationBanner />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Services;
