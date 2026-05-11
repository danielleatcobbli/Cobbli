import { Link } from "react-router-dom";
import { isPriceRange, minPrice, type Service } from "@/data/services";

/**
 * Shared service card. Used by the homepage carousel and the Services page grid
 * so any change to a service's image, name, description or price appears in
 * both places automatically.
 */
const ServiceCard = ({ s }: { s: Service }) => {
  const range = isPriceRange(s);
  const min = minPrice(s);
  const priceLabel = range
    ? `From $${min === 0 ? "XX" : min}`
    : `$${min === 0 ? "XX" : min}`;

  return (
    <Link
      to={`/services/${s.slug}`}
      className="group rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all flex flex-col h-full"
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

export default ServiceCard;
