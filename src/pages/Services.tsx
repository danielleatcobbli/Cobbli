import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import Header from "@/components/cobbli/Header";
import Footer from "@/components/cobbli/Footer";

type Category =
  | "All services"
  | "Sole or heel repair"
  | "Zipper repair"
  | "Strap repair"
  | "Cleaning"
  | "Preventative care";

const categories: Category[] = [
  "All services",
  "Sole or heel repair",
  "Zipper repair",
  "Strap repair",
  "Cleaning",
  "Preventative care",
];

type Service = {
  slug: string;
  name: string;
  description: string;
  /** When set, displays as "From $XX". Otherwise displays as "$XX". */
  priceFrom?: number;
  price?: number;
  categories: Exclude<Category, "All services">[];
  /** Lower number = higher rank. Configurable per service. */
  rank: number;
};

// Placeholder services — to be replaced with real list/prices/ranking later.
const services: Service[] = Array.from({ length: 8 }).map((_, i) => ({
  slug: `service-${i + 1}`,
  name: "Service name",
  description: "Service description",
  ...(i % 2 === 0 ? { price: 0 } : { priceFrom: 0 }),
  categories: [
    categories[(i % (categories.length - 1)) + 1] as Exclude<Category, "All services">,
  ],
  rank: i + 1,
}));

const ServiceCard = ({ s }: { s: Service }) => {
  const priceLabel = s.priceFrom !== undefined ? "From $XX" : "$XX";
  return (
    <Link
      to={`/services/${s.slug}`}
      className="group rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all flex flex-col"
    >
      <div
        className="aspect-[4/3] flex items-center justify-center text-center px-4"
        style={{ backgroundColor: "#3d1700", color: "#fdb600" }}
      >
        <span className="font-display text-xl">{s.name}</span>
      </div>
      <div className="p-5 flex flex-col gap-1">
        <h3 className="font-display text-lg text-primary">{s.name}</h3>
        <p className="text-sm text-muted-foreground">{s.description}</p>
        <p className="mt-2 font-medium text-primary">{priceLabel}</p>
      </div>
    </Link>
  );
};

const Services = () => {
  const [active, setActive] = useState<Category>("All services");

  useEffect(() => {
    document.title = "Services — Cobbli";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Browse Cobbli's professional shoe repair services — sole and heel repair, zipper repair, strap repair, cleaning and preventative care.",
    );
  }, []);

  const visible = useMemo(() => {
    const list =
      active === "All services"
        ? services
        : services.filter((s) => s.categories.includes(active));
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

          {/* Category navigation */}
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

          {/* Service grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
            {visible.map((s) => (
              <ServiceCard key={s.slug} s={s} />
            ))}
          </div>

          {/* Consultation banner */}
          <div
            className="mt-12 rounded-xl p-6 md:p-8 flex items-start gap-4"
            style={{ backgroundColor: "#fff5cc", border: "1px solid #fdb600" }}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
            >
              <Mail size={20} />
            </div>
            <div>
              <h2 className="font-display text-xl text-primary">
                Not sure what your shoes need?
              </h2>
              <p className="mt-1 text-sm md:text-base text-primary/80">
                Email us photos at{" "}
                <a href="mailto:support@cobbli.com" className="underline">
                  support@cobbli.com
                </a>{" "}
                and we'll recommend the right repairs within 1 business day.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default Services;
