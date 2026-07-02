import { Link } from "react-router-dom";
import type { Service } from "@/types/service";

/**
 * Shared service card. Renders the customer-facing "card name" (the
 * what's-wrong phrasing) and the consolidated `cardPriceLabel` verbatim —
 * no "From $X" prefix.
 */
const ServiceCard = ({ s, fromCategory }: { s: Service; fromCategory?: string }) => {
  const title = s.cardName || s.name;
  const to = fromCategory && fromCategory !== "All services"
    ? `/services/${s.slug}?from=${encodeURIComponent(fromCategory)}`
    : `/services/${s.slug}`;

  return (
    <Link
      to={to}
      className="group w-full rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all flex flex-col h-full"
    >
      <div
        className="aspect-[4/3] flex items-center justify-center text-center px-4"
        style={{ backgroundColor: "#3d1700", color: "#fdb600" }}
      >
        <span className="text-xl">{title}</span>
      </div>
      <div className="p-5 flex flex-col gap-1">
        <h3 className="text-[15px] leading-snug text-primary">{title}</h3>
        {s.cardPriceLabel && (
          <p className="mt-1 font-sans font-medium text-[13px] text-primary">{s.cardPriceLabel}</p>
        )}
      </div>
    </Link>
  );
};

export default ServiceCard;
