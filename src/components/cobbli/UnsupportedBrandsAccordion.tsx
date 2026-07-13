/**
 * UnsupportedBrandsAccordion
 *
 * Extracted from ServiceDetail.tsx so PackageDetail.tsx can show the same
 * "brands not currently supported" disclosure for packages, without
 * duplicating the markup. Behavior/copy unchanged from the original.
 */

import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  brands: string[];
  open: boolean;
  onToggle: () => void;
};

const UnsupportedBrandsAccordion = ({ brands, open, onToggle }: Props) => (
  <div>
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
    >
      Brands not currently supported
      {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
    {open && (
      <div className="mt-2 space-y-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {brands.join(", ")}.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          These brands use signature materials, finishes, and techniques that require specialist
          handling and sourcing to repair correctly. We're working toward supporting them.
        </p>
        <button
          type="button"
          className="text-xs text-muted-foreground underline hover:text-primary"
        >
          👍 Vote to add support for these brands
        </button>
      </div>
    )}
  </div>
);

export default UnsupportedBrandsAccordion;
