import { REPAIR_STATUS, humanizeStatus, isClosedOrCanceledOrder } from "@/lib/repairStatus";
import type { RequestRow } from "./requestData";

// Derives where a request is, and who has to act next, from its status and
// its linked order. Nothing is stored — there are no stage/owner columns.

export type Owner = "cobbli" | "customer" | "none";

export const OWNERS: { id: Owner; label: string }[] = [
  { id: "cobbli", label: "Cobbli" },
  { id: "customer", label: "Customer" },
  { id: "none", label: "No one" },
];

export const STAGES = [
  { id: "new", label: "New" },
  { id: "needs_info", label: "Needs info" },
  { id: "recommendations_sent", label: "Recommendations sent" },
  { id: "waitlisted", label: "Waitlisted" },
  { id: "booked", label: "Booked" },
  { id: "completed", label: "Completed" },
  { id: "closed", label: "Closed" },
  { id: "other", label: "Other" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export type RequestStage = {
  id: StageId;
  /** Label shown in the list; usually the stage name, more specific for orders. */
  label: string;
  owner: Owner;
  nextAction: string;
};

const COMPLETED_ORDER = new Set(["returned", "completed", "rework-request-denied"]);

export const ownerLabel = (owner: Owner): string =>
  OWNERS.find((o) => o.id === owner)?.label ?? "No one";

export function stageFor(row: RequestRow): RequestStage {
  const order = row.order;

  // A linked order is the source of truth once the customer has booked.
  if (order) {
    const orderLabel = REPAIR_STATUS[order.status]?.label ?? humanizeStatus(order.status);
    if (isClosedOrCanceledOrder(order.status)) {
      return { id: "closed", label: "Order canceled", owner: "none", nextAction: "None" };
    }
    if (COMPLETED_ORDER.has(order.status)) {
      return { id: "completed", label: "Completed", owner: "none", nextAction: "None" };
    }
    if (order.status === "pending_payment") {
      return {
        id: "booked",
        label: "Confirmation pending",
        owner: "customer",
        nextAction: "Waiting for the customer to finish confirming",
      };
    }
    return {
      id: "booked",
      label: `Booked: ${orderLabel}`,
      owner: "cobbli",
      nextAction: `Track repair (${orderLabel})`,
    };
  }

  switch (row.status) {
    case "pending":
      return { id: "new", label: "New", owner: "cobbli", nextAction: "Review photos and send recommendations" };
    case "needs_more_info":
      return { id: "needs_info", label: "Needs info", owner: "customer", nextAction: "Waiting for the customer to reply" };
    case "quote_ready":
    case "proposal_sent":
      return {
        id: "recommendations_sent",
        label: "Recommendations sent",
        owner: "customer",
        nextAction: "Waiting for the customer to review and book",
      };
    case "waitlisted":
      return { id: "waitlisted", label: "Waitlisted", owner: "cobbli", nextAction: "Follow up when we can take this on" };
    case "declined":
      return { id: "closed", label: "Closed", owner: "none", nextAction: "None" };
    case "service_unavailable":
      return { id: "closed", label: "Service unavailable", owner: "none", nextAction: "None" };
    case "booked":
      // Booked but no order points back at it: surface it, don't hide it.
      return { id: "booked", label: "Booked (no order linked)", owner: "cobbli", nextAction: "Find the order for this request" };
    default:
      return { id: "other", label: humanizeStatus(row.status), owner: "cobbli", nextAction: "Check this request" };
  }
}
