import { Link } from "react-router-dom";
import type { Service } from "@/types/service";

type Props = {
  s: Service;
  fromCategory?: string;
  isPopular?: boolean;
  /** When provided, an "Add to repair" button is rendered at the bottom of the
   *  card. The callback receives the service slug; the caller is responsible for
   *  handling any required modal gates before navigating. */
  onAddToRepair?: (slug: string) => void;
};

const ServiceCard = ({ s, fromCategory, isPopular, onAddToRepair }: Props) => {
  const to =
    fromCategory && fromCategory !== "All services"
      ? `/services/${s.slug}?from=${encodeURIComponent(fromCategory)}`
      : `/services/${s.slug}`;

  return (
    <div className="group w-full rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all flex flex-col h-full">
      <Link to={to} className="flex flex-col flex-1">
        <div className="aspect-[4/5] relative" style={{ backgroundColor: "#3d1700" }}>
          {isPopular && (
            <span
              className="absolute top-2 left-2 text-[10px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#fdb600", color: "#3d1700" }}
            >
              Popular
            </span>
          )}
        </div>
        <div className="p-4 flex flex-col gap-1 flex-1">
          <h3 className="text-[14px] font-bold leading-snug" style={{ color: "#3d1700" }}>
            {s.name}
          </h3>
          {s.description && (
            <p className="text-[12px] leading-snug mt-0.5" style={{ color: "#7a5c40" }}>
              {s.description}
            </p>
          )}
          {s.cardPriceLabel && (
            <p className="text-[13px] font-bold mt-auto pt-2" style={{ color: "#3d1700" }}>
              {s.cardPriceLabel.replace(/\s+per\s+\S.*/i, "").trim()}
            </p>
          )}
        </div>
      </Link>

      {onAddToRepair && (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => onAddToRepair(s.slug)}
            className="w-full rounded-md py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#3d1700" }}
          >
            Add to repair
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceCard;
