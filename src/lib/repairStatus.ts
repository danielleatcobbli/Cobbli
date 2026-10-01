/**
 * repairStatus
 *
 * A single customer-facing status vocabulary for both requests (assessments)
 * and confirmed repairs (orders) — shared between Account.tsx's "My Repairs"
 * list and the Repair Details page (2026-10-01). Presentation-layer only:
 * this does NOT change any status value written to the database, so none of
 * the existing admin tooling, RPCs, or the request→order transition needed
 * to change. Collapsing the underlying status machine itself is tracked
 * separately (task #124) and is explicitly out of scope here.
 */

export type StatusMeta = { label: string; pill: string; next: string; action: string };

// Real, currently-written assessment statuses, confirmed against Admin.tsx's
// STATUS_TABS and AssessmentProposal.tsx's own status checks (2026-10-01):
// pending, quote_ready, waitlisted, booked, service_unavailable, declined,
// needs_more_info. "booked" assessments are excluded from the My Repairs
// query (they become an order instead) so a repair never appears twice.
//
// Bug fix carried over from the My Repairs rework: the previous status map
// keyed off "proposal_sent" / "expired" — values Admin.tsx's own comment
// confirms are never written. The real value is "quote_ready".
export const REQUEST_STATUS: Record<string, StatusMeta> = {
  pending: {
    label: "Request received",
    pill: "bg-amber-100 text-amber-900",
    next: "We're reviewing your photos and will follow up with next steps.",
    action: "View details",
  },
  needs_more_info: {
    label: "Request received",
    pill: "bg-amber-100 text-amber-900",
    next: "We need a couple more photos from you to continue.",
    action: "Add photos",
  },
  quote_ready: {
    label: "Recommendations ready",
    pill: "bg-blue-100 text-blue-800",
    next: "Review your recommendations and pick one to continue.",
    action: "Review recommendations",
  },
  waitlisted: {
    label: "Waitlisted",
    pill: "bg-purple-100 text-purple-800",
    // Not "we'll email you" — "waitlisted" has no automated or confirmed
    // manual follow-up process behind it yet (it's a staff-preview-only
    // status today, task #124), so this can't promise a specific channel or
    // timing (2026-10-01 fix).
    next: "We'll reach out as soon as we can take on your repair.",
    action: "View details",
  },
  declined: {
    label: "Closed",
    pill: "bg-gray-200 text-gray-700",
    next: "You let us know this repair isn't needed. Changed your mind? Just reach out.",
    action: "View details",
  },
  service_unavailable: {
    label: "Closed",
    pill: "bg-gray-200 text-gray-700",
    next: "We're not able to take on this repair right now. No charge was made.",
    action: "View details",
  },
};

// Real orders.status values, confirmed against adminData.ts's KNOWN_STATUSES
// (2026-10-01). Several granular internal states collapse into one
// customer-facing bucket — pickup dates, rework requests, etc. show up as
// the "next" line / the Pickup & Return card rather than their own status.
export const REPAIR_STATUS: Record<string, StatusMeta> = {
  // 2026-10-01 fix: these three statuses are all PRE-pickup — the bag is
  // still with the customer, so copy must not imply we have it yet
  // ("We've got your bag..." was wrong here). "Your repair is confirmed."
  // is accurate regardless of whether pickup has been scheduled yet.
  placed: { label: "Repair confirmed", pill: "bg-blue-100 text-blue-800", next: "Your repair is confirmed.", action: "View details" },
  pending_payment: { label: "Repair confirmed", pill: "bg-blue-100 text-blue-800", next: "Finishing up your confirmation.", action: "View details" },
  "pickup-scheduled": { label: "Repair confirmed", pill: "bg-blue-100 text-blue-800", next: "Your repair is confirmed. Pickup is scheduled — we'll see you soon.", action: "View details" },
  "picked-up": { label: "In repair", pill: "bg-amber-100 text-amber-900", next: "Your bag is on its way to our workshop.", action: "View details" },
  "at-the-workshop": { label: "In repair", pill: "bg-amber-100 text-amber-900", next: "Your bag is at our workshop.", action: "View details" },
  "in-repair": { label: "In repair", pill: "bg-amber-100 text-amber-900", next: "Your bag is being repaired.", action: "View details" },
  "rework-request-pending": { label: "In repair", pill: "bg-amber-100 text-amber-900", next: "We're reviewing your rework request.", action: "View details" },
  "rework-request-approved": { label: "In repair", pill: "bg-amber-100 text-amber-900", next: "We're taking another look per your rework request.", action: "View details" },
  "ready-for-return": { label: "Ready to return", pill: "bg-teal-100 text-teal-900", next: "We'll be in touch to schedule your return.", action: "View details" },
  "return-scheduled": { label: "Ready to return", pill: "bg-teal-100 text-teal-900", next: "Your return is scheduled.", action: "View details" },
  returned: { label: "Completed", pill: "bg-green-100 text-green-800", next: "Your repair is complete.", action: "View details" },
  completed: { label: "Completed", pill: "bg-green-100 text-green-800", next: "Your repair is complete.", action: "View details" },
  "rework-request-denied": { label: "Completed", pill: "bg-green-100 text-green-800", next: "Your repair is complete. See details for notes on your rework request.", action: "View details" },
  cancelled: { label: "Canceled", pill: "bg-gray-200 text-gray-700", next: "This repair was canceled.", action: "View details" },
  canceled: { label: "Canceled", pill: "bg-gray-200 text-gray-700", next: "This repair was canceled.", action: "View details" },
};

// Order statuses in pipeline order, coarse-grained — used to answer "has
// pickup already happened" / "are we at-or-past ready-for-return" without
// hardcoding those comparisons in every place that needs them (Repair
// Details' Pickup & Return card). Statuses not listed (e.g. a future/unknown
// value) are treated as "at the end" defensively, so unrecognized states lean
// toward not showing a stale "promise future work" message.
const ORDER_STAGE_ORDER = [
  "placed",
  "pending_payment",
  "pickup-scheduled",
  "picked-up",
  "at-the-workshop",
  "in-repair",
  "rework-request-pending",
  "rework-request-approved",
  "ready-for-return",
  "return-scheduled",
  "returned",
  "completed",
  "rework-request-denied",
];

export const orderStageIndex = (status: string): number => {
  const i = ORDER_STAGE_ORDER.indexOf(status);
  return i === -1 ? ORDER_STAGE_ORDER.length : i;
};

export const isPickedUpOrLater = (status: string): boolean =>
  orderStageIndex(status) >= ORDER_STAGE_ORDER.indexOf("picked-up");

export const isReadyForReturnOrLater = (status: string): boolean =>
  orderStageIndex(status) >= ORDER_STAGE_ORDER.indexOf("ready-for-return");

export const isReturnedOrLater = (status: string): boolean =>
  orderStageIndex(status) >= ORDER_STAGE_ORDER.indexOf("returned");

export const isClosedOrCanceledOrder = (status: string): boolean =>
  status === "cancelled" || status === "canceled";

export const isClosedRequest = (status: string): boolean =>
  status === "declined" || status === "service_unavailable";

export const humanizeStatus = (s: string) =>
  s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const fallbackMeta = (status: string): StatusMeta => ({
  label: humanizeStatus(status),
  pill: "bg-gray-100 text-gray-800",
  next: "",
  action: "View details",
});
