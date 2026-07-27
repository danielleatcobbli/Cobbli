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
import iconOdor from "@/assets/category-icons/odor.svg";
import { CATEGORIES_ORDERED, type ServiceCategory } from "@/types/service";

export const ALL_CATEGORIES_LABEL = "All services" as const;
export const FILTER_BAR_CATEGORIES = [ALL_CATEGORIES_LABEL, ...CATEGORIES_ORDERED] as const;
export type CategoryFilter = (typeof FILTER_BAR_CATEGORIES)[number];

/** Shared category icon set — also reused by StartRepair.tsx's checklist so
 *  the same icon appears for a category everywhere it's shown. "Sole" and
 *  "Heel" stay here individually for the checklist's own separate Sole/Heel
 *  groups; "Sole & Heel" (the combined filter-bar button) deliberately reuses
 *  the sole icon rather than getting a new one — Danielle's call, the two
 *  "naturally go together." */
export const CATEGORY_ICONS: Record<string, string> = {
  [ALL_CATEGORIES_LABEL]: iconAll,
  "Sole": iconBottom,
  "Heel": iconHeel,
  "Sole & Heel": iconBottom,
  "Cleaning": iconCleaning,
  "Color, scuffs, & shine": iconColor,
  "Inside of shoe": iconInside,
  "Preventative care": iconPreventative,
  "Straps, buckles, & hardware": iconStraps,
  "Tears & holes": iconTears,
  "Zipper": iconZipper,
  // Dedicated "stinky shoe" icon Danielle supplied (2026-07-16), recolored to
  // match the set's brown (#3d1700) and normalized to the same svg wrapper
  // conventions as the rest of category-icons/*.
  "Odor": iconOdor,
};

const ICONS = CATEGORY_ICONS;

/** Display text overrides, shared by this filter bar and the Starter repair
 *  checklist (StartRepair.tsx) so a category reads the same way in both
 *  places. Two different motivations, same mechanism:
 *  - "Straps, buckles, & hardware" / "Color, scuffs, & shine" are shortened
 *    (2026-07-15) so every filter-bar button fits on one row.
 *  - "Inside of shoe" -> "Insole" and "Tears & holes" -> "Tears, holes, &
 *    stitching" (2026-07-15) are clarity renames: "Insole" is more concrete
 *    and matches how customers actually describe that part of the shoe, and
 *    a separated seam doesn't read as a "tear" to most people.
 *  All four are display-only — the underlying ServiceCategory value (used
 *  for matching against a service's real category tags, and as the
 *  CATEGORY_ICONS key) is untouched, so none of this needs a catalog data
 *  migration and can't drift out of sync with it. */
const CATEGORY_DISPLAY_LABELS: Partial<Record<ServiceCategory, string>> = {
  "Straps, buckles, & hardware": "Straps & hardware",
  "Color, scuffs, & shine": "Color & shine",
  "Inside of shoe": "Insole",
  "Tears & holes": "Tears, holes, & stitching",
};

/** The text to show for a category, anywhere it's displayed — see
 *  CATEGORY_DISPLAY_LABELS above for which categories get overridden and why. */
export const categoryDisplayLabel = (c: ServiceCategory | typeof ALL_CATEGORIES_LABEL): string =>
  CATEGORY_DISPLAY_LABELS[c as ServiceCategory] ?? c;

/** Whether a service (by its real category tags) matches the active filter.
 *  Special-cases "Sole & Heel" — the one filter-bar entry that isn't a real
 *  per-service tag — as "tagged Sole OR Heel" rather than an exact match, so
 *  merging those two into one button never requires touching the catalog's
 *  own "Sole"/"Heel" tags. */
export function categoryMatches(categories: ServiceCategory[], filter: CategoryFilter): boolean {
  if (filter === ALL_CATEGORIES_LABEL) return true;
  if (filter === "Sole & Heel") return categories.includes("Sole") || categories.includes("Heel");
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
