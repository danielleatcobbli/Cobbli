import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageMeta } from "@/hooks/usePageMeta";

import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";
import ConsultationBanner from "@/components/cobbli/ConsultationBanner";
import BrandSpinner from "@/components/cobbli/BrandSpinner";
import ComingSoonSection from "@/components/cobbli/ComingSoonSection";
import CategoryFilterBar, {
  ALL_CATEGORIES_LABEL,
  FILTER_BAR_CATEGORIES,
  type CategoryFilter,
} from "@/components/cobbli/CategoryFilterBar";
import { type Service } from "@/types/service";
import { useServices } from "@/hooks/useServices";
import ServiceCard from "@/components/cobbli/ServiceCard";

const ALL = ALL_CATEGORIES_LABEL;
const categories = FILTER_BAR_CATEGORIES;

const Services = () => {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const initialActive =
    categoryParam && categories.includes(categoryParam as (typeof categories)[number])
      ? (categoryParam as (typeof categories)[number])
      : ALL;
  const [active, setActive] = useState<(typeof categories)[number]>(initialActive);
  const { data: services, isLoading, isError } = useServices();

  useEffect(() => {
    const category = searchParams.get("category");
    if (category && categories.includes(category as (typeof categories)[number])) {
      setActive(category as (typeof categories)[number]);
    }
  }, [searchParams]);

  usePageMeta({
    title: "Services — Cobbli",
    description:
"Browse Cobbli's NYC shoe repair services: sole and heel repair, zipper and strap fixes, cleaning and preventative care. Transparent pricing, fast turnaround.",
  });

  const list = services ?? [];

  const activeServices = useMemo(() => {
    const filtered = list.filter((s) => !s.isComingSoon);
    const byCat =
      active === ALL
        ? filtered
        : filtered.filter((s) =>
            s.categories.includes(active as Service["categories"][number]),
          );
    return [...byCat].sort((a, b) => a.rank - b.rank);
  }, [list, active]);

  const comingSoonServices = useMemo(() => {
    const filtered = list.filter((s) => s.isComingSoon);
    const byCat =
      active === ALL
        ? filtered
        : filtered.filter((s) =>
            s.categories.includes(active as Service["categories"][number]),
          );
    return [...byCat].sort((a, b) => a.rank - b.rank);
  }, [list, active]);

  const serviceIdBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of list) map[s.slug] = s.id;
    return map;
  }, [list]);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <Header />

      <section className="flex-1 py-16 md:py-20">
        <div className="container">
          <h1 className="text-3xl md:text-5xl font-display text-primary mb-8">
            What can we help with?
          </h1>

          <CategoryFilterBar active={active} onChange={setActive} className="mb-10" />

          {isLoading ? (
            <BrandSpinner className="py-20" size="lg" />
          ) : isError ? (
            <p className="text-muted-foreground py-10">
              We couldn't load services right now. Please refresh, or{" "}
              <a href="mailto:support@cobbli.com" className="underline text-primary">
                support@cobbli.com
              </a>{" "}
              if it keeps happening.
            </p>
          ) : activeServices.length === 0 && comingSoonServices.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-xl text-primary mb-2">No services in this category yet</p>
              <p className="text-muted-foreground mb-6">
                Try another category, or get in touch and we'll recommend the right repair.
              </p>
              <a href="mailto:support@cobbli.com" className="underline text-primary">
                support@cobbli.com
              </a>
            </div>
          ) : (
            <>
              {activeServices.length > 0 && (
                <div className="flex flex-wrap gap-5 md:gap-6">
                  {activeServices.map((s) => (
                    <div
                      key={s.slug}
                      className="w-[calc((100%-1.25rem)/2)] md:w-[calc((100%-2*1.5rem)/3)] xl:w-[calc((100%-3*1.5rem)/4)] flex"
                    >
                      <ServiceCard s={s} fromCategory={active} />
                    </div>
                  ))}
                </div>
              )}

              <ComingSoonSection
                services={comingSoonServices}
                serviceIdBySlug={serviceIdBySlug}
              />
            </>
          )}

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
