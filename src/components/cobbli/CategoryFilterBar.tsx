import iconAll from "@/assets/category-icons/all.svg";
import iconBottom from "@/assets/category-icons/bottom.svg";
import iconCleaning from "@/assets/category-icons/cleaning.svg";
import iconColor from "@/assets/category-icons/color.svg";
import iconInside from "@/assets/category-icons/inside.svg";
import iconPreventative from "@/assets/category-icons/preventative.svg";
import iconStraps from "@/assets/category-icons/straps.svg";
import iconTears from "@/assets/category-icons/tears.svg";
import iconZipper from "@/assets/category-icons/zipper.svg";
import { CATEGORIES_ORDERED } from "@/types/service";

export const ALL_CATEGORIES_LABEL = "All services" as const;
export const FILTER_BAR_CATEGORIES = [ALL_CATEGORIES_LABEL, ...CATEGORIES_ORDERED] as const;
export type CategoryFilter = (typeof FILTER_BAR_CATEGORIES)[number];

const ICONS: Record<string, string> = {
  [ALL_CATEGORIES_LABEL]: iconAll,
  "Bottom of shoe & heel": iconBottom,
  "Cleaning": iconCleaning,
  "Color, scuffs, & shine": iconColor,
  "Inside of shoe": iconInside,
  "Preventative care": iconPreventative,
  "Straps, buckles, & hardware": iconStraps,
  "Tears & holes": iconTears,
  "Zipper": iconZipper,
};

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
 *  /services page so icon assets and styling stay in lockstep. */
const CategoryFilterBar = ({ active, onChange, className, scrollable, iconSize = 24 }: Props) => {
  const containerClass = scrollable
    ? `flex flex-nowrap gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1 ${className ?? ""}`
    : `flex flex-wrap gap-3 md:gap-4 ${className ?? ""}`;

  return (
    <div
      role="tablist"
      aria-label="Service categories"
      className={containerClass}
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
            className={`shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-medium transition-colors ${
              isActive ? "text-primary border-[1.5px]" : "text-[#7a5c40] hover:text-primary"
            }`}
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
              style={
                isActive
                  ? { borderBottom: "2px solid #fdb600", paddingBottom: 1 }
                  : undefined
              }
            >
              {c}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilterBar;
