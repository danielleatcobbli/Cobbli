import iconAll from "@/assets/category-icons/all.svg";
import iconBottom from "@/assets/category-icons/bottom.svg";
import iconColor from "@/assets/category-icons/color.svg";
import iconInside from "@/assets/category-icons/inside.svg";
import iconStraps from "@/assets/category-icons/straps.svg";
import iconTears from "@/assets/category-icons/tears.svg";
import iconZipper from "@/assets/category-icons/zipper.svg";
import iconScratch from "@/assets/category-icons/scratch.svg";
import iconLeather from "@/assets/category-icons/leather.svg";
import iconShoeshine from "@/assets/category-icons/shoeshine.svg";
import { CATEGORIES_ORDERED, type ServiceCategory } from "@/types/service";

export const ALL_CATEGORIES_LABEL = "All services" as const;
export const FILTER_BAR_CATEGORIES = [ALL_CATEGORIES_LABEL, ...CATEGORIES_ORDERED] as const;
export type CategoryFilter = (typeof FILTER_BAR_CATEGORIES)[number];

/** Shared category icon set — one icon per category, in lockstep everywhere
 *  a category shows up (Services page filter bar, homepage, and the Start a
 *  Repair checklist all read from this same map, since the two taxonomies
 *  were unified into one on 2026-07-23 — see ServiceCategory in
 *  types/service.ts). "Stitching & seams" still borrows iconTears as a
 *  PLACEHOLDER — flagged, needs a real icon commissioned once Danielle's
 *  ready to prioritize it. */
export const CATEGORY_ICONS: Record<string, string> = {
  [ALL_CATEGORIES_LABEL]: iconAll,
  "Sole & heel": iconBottom,
  "Scuffs & holes": iconScratch,
  "Color & stains": iconColor,
  "Material & finish": iconLeather,
  "Insole & interior": iconInside,
  "Stitching & seams": iconTears,
  "Straps, buckles, & hardware": iconStraps,
  "Zipper": iconZipper,
  "Cleaning & odor": iconShoeshine,
};

const ICONS = CATEGORY_ICONS;

/** Display text override, shared by this filter bar and the Start a Repair
 *  checklist (StartRepair.tsx) so a category reads the same way in both
 *  places. "Straps, buckles, & hardware" is shortened to fit the filter-bar
 *  button width (2026-07-15) — display-only, the underlying ServiceCategory
 *  value (used for matching against a service's real category tags, and as
 *  the CATEGORY_ICONS key) is untouched. The other three overrides that used
 *  to live here (Color/scuffs/shine, Inside of shoe, Tears & holes) were
 *  removed with the 2026-07-23 category unification — those categories don't
 *  exist anymore, replaced by the checklist's own (already-short) names. */
const CATEGORY_DISPLAY_LABELS: Partial<Record<ServiceCategory, string>> = {
  "Straps, buckles, & hardware": "Straps & hardware",
};

/** The text to show for a category, anywhere it's displayed — see
 *  CATEGORY_DISPLAY_LABELS above for which categories get overridden and why. */
export const categoryDisplayLabel = (c: ServiceCategory | typeof ALL_CATEGORIES_LABEL): string =>
  CATEGORY_DISPLAY_LABELS[c as ServiceCategory] ?? c;

/** Whether a service (by its real category tags) matches the active filter.
 *  Every category is now a direct, real per-service tag (2026-07-23 unifi-
 *  cation removed the old "Sole & heel" OR-match special case — services are
 *  tagged "Sole & heel" directly now, not separately "Sole" and/or "Heel"). */
export function categoryMatches(categories: ServiceCategory[], filter: CategoryFilter): boolean {
  if (filter === ALL_CATEGORIES_LABEL) return true;
  return categories.includes(filter as ServiceCategory);
}

type Props = {
  active: CategoryFilter;
  onChange: (c: CategoryFilter) => void;
  className?: string;
  /** When true the bar is a single non-wrapping row that scrolls horizontally. */
  scrollable?: boolean;
  /** Icon display size in px. Defaults to 24. */
  iconSize?: number;
};

/** Shared category filter bar used on the homepage Services preview and the
 *  /services page so icon assets and styling stay in lockstep.
 *
 *  Non-scrollable mode (the full /services page) lays the categories out on
 *  a CSS grid with equal-width auto-fit columns, so every category button is
 *  exactly the same width regardless of label length. Column min-width and
 *  icon size were both shrunk (2026-07-15, Danielle's call) — combined with
 *  the shorter display labels above and the Sole+Heel merge, everything now
 *  fits on one row on a typical desktop width instead of wrapping to a
 *  second. Scrollable mode (the homepage carousel) is unchanged — each
 *  button keeps its natural width in a horizontally-scrolling row. */
const CategoryFilterBar = ({ active, onChange, className, scrollable, iconSize = 20 }: Props) => {
  const containerClass = scrollable
    ? `flex flex-nowrap gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1 ${className ?? ""}`
    : `grid gap-2 md:gap-3 ${className ?? ""}`;
  const containerStyle = scrollable
    ? undefined
    : { gridTemplateColumns: "repeat(auto-fit, minmax(76px, 1fr))" };

  return (
    <div
      role="tablist"
      aria-label="Service categories"
      className={containerClass}
      style={containerStyle}
    >
      {FILTER_BAR_CATEGORIES.map((c) => {
        const isActive = c === active;
        return (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(c)}
            className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl text-[11px] font-medium text-center transition-colors min-w-0 ${
              scrollable ? "shrink-0" : "w-full"
            } ${isActive ? "text-primary border-[1.5px]" : "text-[#7a5c40] hover:text-primary"}`}
            style={
              isActive
                ? { backgroundColor: "#f5f0e8", borderColor: "#3d1700" }
                : undefined
            }
          >
            <img
              src={ICONS[c]}
              alt=""
              aria-hidden="true"
              style={{ width: iconSize, height: iconSize, opacity: 1 }}
            />
            <span
              className="leading-snug"
              style={
                isActive
                  ? { borderBottom: "2px solid #fdb600", paddingBottom: 1 }
                  : undefined
              }
            >
              {categoryDisplayLabel(c)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilterBar;
