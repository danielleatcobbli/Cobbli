import { Link } from "react-router-dom";
import type { Service } from "@/types/service";
import BeforeAfterImage from "@/components/cobbli/BeforeAfterImage";
import { SLUG_TO_CONDITION_IMAGE } from "@/data/starterRepairConditions";

type Props = {
  s: Service;
  fromCategory?: string;
  isPopular?: boolean;
  /** When provided, an "Add to repair" button is rendered at the bottom of the
   *  card. The callback receives the service slug; the caller is responsible for
   *  handling any required modal gates before navigating. */
  onAddToRepair?: (slug: string) => void;
  /** "Fixes: …" line from addressesLine() in starterRepairConditions.ts —
   *  shown in place of s.description when this service maps to at least one
   *  checklist condition, so the same service reads the same way here as it
   *  does on the Starter repair recommendation screen. Falls back to
   *  s.description when undefined (Cleaning/Preventative care services, which
   *  aren't part of the checklist). */
  addresses?: string;
  /** "amber" swaps the card body to a bright yellow background with cream
   *  text — Danielle's cream-section/yellow-card, yellow-section/cream-text
   *  rule from her homepage mockup, 2026-08-26. Defaults to "light" (today's
   *  cream card, unchanged) everywhere except the homepage Services teaser,
   *  which is the only caller passing "amber" — every other page (the full
   *  /services catalog, Starter repair recommendations, etc.) keeps the
   *  original look. */
  theme?: "light" | "amber";
};

const ServiceCard = ({ s, fromCategory, isPopular, onAddToRepair, addresses, theme = "light" }: Props) => {
  const to =
    fromCategory && fromCategory !== "All services"
      ? `/services/${s.slug}?from=${encodeURIComponent(fromCategory)}`
      : `/services/${s.slug}`;
  const amber = theme === "amber";

  return (
    <div
      className={
        amber
          ? "group w-full rounded-xl overflow-hidden border shadow-soft hover:shadow-elevated transition-all flex flex-col h-full"
          : "group w-full rounded-xl overflow-hidden border border-border bg-card shadow-soft hover:shadow-elevated hover:border-primary/40 transition-all flex flex-col h-full"
      }
      style={amber ? { backgroundColor: "#fdb600", borderColor: "#fdb600" } : undefined}
    >
      {/* Amber theme: padding wraps the whole card (image included) so the
          amber shows as a frame on all four sides of the photo, matching
          Danielle's Canva reference exactly, 2026-08-26 — instead of the
          image running edge-to-edge with only the text below getting
          padding. Image gets its own rounded corners since it's inset now,
          not flush with the card's outer radius. */}
      <Link to={to} className={amber ? "flex flex-col flex-1 p-3" : "flex flex-col flex-1"}>
        <div
          className={amber ? "aspect-[4/5] relative overflow-hidden rounded-lg" : "aspect-[4/5] relative overflow-hidden"}
          style={{ backgroundColor: "#3d1700" }}
        >
          <BeforeAfterImage
            before={s.imageUrl ?? SLUG_TO_CONDITION_IMAGE.get(s.slug)?.imageUrl}
            after={s.afterImageUrl ?? SLUG_TO_CONDITION_IMAGE.get(s.slug)?.afterImageUrl}
            alt={s.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* "Popular" badge removed 2026-08-13 (Danielle's call) — same
              reasoning as the checklist's "Common" tag removal: it sat on
              top of the card photo and the catalog's still too small for the
              distinction to matter yet. isPopular is still passed in by
              every caller (unused for now) so this is a one-line revert if
              it comes back. */}
        </div>
        <div className={amber ? "pt-3 flex flex-col gap-1 flex-1" : "p-4 flex flex-col gap-1 flex-1"}>
          <h3
            className="text-[14px] font-bold leading-snug"
            style={{ color: amber ? "#fff5cc" : "#3d1700" }}
          >
            {s.name}
          </h3>
          {(addresses ?? s.description) && (
            <p
              className="text-[12px] leading-snug mt-0.5"
              style={{ color: amber ? "#fff5cc" : "#7a5c40", opacity: amber ? 0.9 : 1 }}
            >
              {addresses ?? s.description}
            </p>
          )}
          {s.cardPriceLabel && (
            <p
              className="text-[13px] font-bold mt-auto pt-2"
              style={{ color: amber ? "#fff5cc" : "#3d1700" }}
            >
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
            className="w-full rounded-md py-2 text-sm font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#3d1700", color: "#ffffff" }}
          >
            Add to repair
          </button>
        </div>
      )}
    </div>
  );
};

export default ServiceCard;
