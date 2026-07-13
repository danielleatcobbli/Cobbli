import iconAll from "@/assets/category-icons/all.svg";
import iconBottom from "@/assets/category-icons/bottom.svg";
import iconHeel from "@/assets/category-icons/heel.svg";
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

/** Shared category icon set — also reused by StartRepair.tsx's checklist so
 *  the same icon appears for a category everywhere it's shown. */
export const CATEGORY_ICONS: Record<string, string> = {
  [ALL_CATEGORIES_LABEL]: iconAll,
  "Sole": iconBottom,
  "Heel": iconHeel,
  "Cleaning": iconCleaning,
  "Color, scuffs, & shine": iconColor,
  "Inside of shoe": iconInside,
  "Preventative care": iconPreventative,
  "Straps, buckles, & hardware": iconStraps,
  "Tears & holes": iconTears,
  "Zipper": iconZipper,
};

const ICONS = CATEGORY_ICONS;

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
 *  exactly the same width regardless of label length — long labels (e.g.
 *  "Straps, buckles, & hardware") wrap onto multiple lines within that fixed
 *  width instead of stretching the button, and every label starts flush at
 *  the same top edge since the grid stretches each button to the row's
 *  height. Scrollable mode (the homepage carousel) is unchanged — each
 *  button keeps its natural width in a horizontally-scrolling row. */
const CategoryFilterBar = ({ active, onChange, className, scrollable, iconSize = 24 }: Props) => {
  const containerClass = scrollable
    ? `flex flex-nowrap gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1 ${className ?? ""}`
    : `grid gap-3 md:gap-4 ${className ?? ""}`;
  const containerStyle = scrollable
    ? undefined
    : { gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))" };

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
            className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-xs font-medium text-center transition-colors min-w-0 ${
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
              {c}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CategoryFilterBar;
