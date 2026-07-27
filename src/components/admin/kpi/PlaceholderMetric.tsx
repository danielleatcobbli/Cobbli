import { Info } from "lucide-react";

/** Used for the handful of KPIs from the approved mockup that the current
 * schema genuinely can't compute yet -- Order Conversion Rate (no
 * visits/analytics source), On-Time Completion, Avg Fulfillment Time, and
 * Avg Time to Reply to Proposal (all three need order-status-change
 * timestamps; the schema only has a single mutable `updated_at`, not a
 * status history, so "time spent in a status" can't be derived
 * accurately). Renders an honest "not yet tracked" state instead of a
 * fabricated number -- never silently guess here. */
const PlaceholderMetric = ({ reason }: { reason: string }) => (
  <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/40 border border-dashed rounded-md p-3">
    <Info className="h-4 w-4 shrink-0 mt-0.5" />
    <span>{reason}</span>
  </div>
);

export default PlaceholderMetric;
