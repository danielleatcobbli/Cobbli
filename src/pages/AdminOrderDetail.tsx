/**
 * AdminOrderDetail
 *
 * Single order detail page for Cobbli staff.
 * – One shared page with an in-page "Workshop details" / "Dispatch details"
 *   tab switcher (not just a URL param) — defaults to whichever tab matches
 *   where you clicked in from (?view=workshop|dispatch), but you can freely
 *   switch tabs without leaving the page. Same underlying order data either
 *   way — switching tabs just re-prioritizes which sections are primary vs.
 *   sidebar, nothing is actually hidden.
 * – All data is currently hardcoded dummy data — wired to real Supabase fetch later.
 *
 * Route: /admin/order/:id?view=workshop|dispatch  (view= just sets the initial tab)
 */

import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Circle, Clock, FileText, MapPin, MessageSquare, Phone, User, XCircle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types  (mirrors AdminDashboard — will share a module once wired to live data)
// ─────────────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "proposal-awaiting-our-response"
  | "proposal-awaiting-customer-response"
  | "pickup-scheduled"
  | "picked-up"
  | "at-the-workshop"
  | "in-repair"
  | "ready-for-return"
  | "return-scheduled"
  | "returned"
  | "completed"
  | "rework-request-pending"
  | "rework-request-approved"
  | "rework-request-denied";

type FormStatus = "not-started" | "in-progress" | "complete";
type DetailView = "workshop" | "dispatch";

type ServiceLine = {
  id: string;
  name: string;
  priceCents: number;
  tag: "original" | "rework";
  /** Manually checked off by staff as each service is actually completed —
   * lets a multi-service pair track progress line by line instead of an
   * all-or-nothing status, so nothing gets forgotten. */
  done?: boolean;
};

type Comment = {
  initials: string;
  author: string;
  isoTimestamp: string;
  text: string;
};

type PhotoGroup = {
  customerSubmitted: number;
  before: number;
  after: number;
};

/** A past pickup/return leg, retained rather than overwritten — e.g. once a
 * rework is approved and a new pickup gets scheduled, the *original* pickup
 * and return don't disappear, they move here so the order's full logistics
 * history stays visible (Danielle's call: retain the initial pickup data
 * rather than lose it when a new cycle starts). */
type LogisticsLeg = { label: string; date: string; timeLabel: string };

/** One pair of shoes within an order. An order can contain multiple pairs
 * from a single checkout (one bag, several pairs) — each pair has its own
 * shoe details, notes, photos, services, and its own independent intake/
 * outtake gating, rather than one combined status for the whole order. */
type ShoePair = {
  id: string;
  shoeType: string;
  shoeBrand: string;
  shoeColorMaterial: string;
  /** Notes the customer added when submitting this specific pair at checkout. */
  customerNotes?: string;
  photos: PhotoGroup;
  services: ServiceLine[];
  intakeStatus: FormStatus;
  completionStatus: FormStatus;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  datePlaced: string;
  isRework: boolean;
  actionRequiredBy: string | null;
  workshopAssignee: string;
  dispatchAssignee: string;
  customer: { name: string; phone: string; email: string };
  address: string;
  /** Current/most-recent pickup and return — independent of each other, since
   * e.g. an order can have a confirmed pickup with no return scheduled yet. */
  pickupSlot?: { date: string; timeLabel: string };
  returnSlot?: { date: string; timeLabel: string };
  /** Prior legs (e.g. the original pickup/return from before a rework),
   * shown alongside the current pickup/return rather than replacing them. */
  logisticsHistory?: LogisticsLeg[];
  pairs: ShoePair[];
  comments: Comment[];
  /** Order-level operational note (e.g. rework context) — distinct from a
   * pair's customerNotes, which is what the customer wrote at checkout. */
  notes?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Status config  (matches AdminDashboard)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OrderStatus, { label: string; bg: string; fg: string }> = {
  "proposal-awaiting-our-response":      { label: "Proposal — awaiting our response",     bg: "#fef3c7", fg: "#92400e" },
  "proposal-awaiting-customer-response": { label: "Proposal — awaiting customer response", bg: "#dcfce7", fg: "#166534" },
  "pickup-scheduled":                    { label: "Pickup scheduled",                      bg: "#dbeafe", fg: "#1e40af" },
  "picked-up":                           { label: "Picked up",                             bg: "#dbeafe", fg: "#1e40af" },
  "at-the-workshop":                     { label: "At the workshop",                       bg: "#f3e8ff", fg: "#6b21a8" },
  "in-repair":                           { label: "In repair",                             bg: "#dbeafe", fg: "#1e40af" },
  "ready-for-return":                    { label: "Ready for return",                      bg: "#dcfce7", fg: "#166534" },
  "return-scheduled":                    { label: "Return scheduled",                      bg: "#dcfce7", fg: "#166534" },
  "returned":                            { label: "Returned",                              bg: "#dcfce7", fg: "#166534" },
  "completed":                           { label: "Completed",                             bg: "#f3f4f6", fg: "#6b7280" },
  "rework-request-pending":              { label: "Rework request pending",                bg: "#fef3c7", fg: "#92400e" },
  "rework-request-approved":             { label: "Rework request approved",               bg: "#dcfce7", fg: "#166534" },
  "rework-request-denied":              { label: "Rework request denied",                 bg: "#fee2e2", fg: "#991b1b" },
};

const QUICK_ACTION: Partial<Record<OrderStatus, string>> = {
  "proposal-awaiting-our-response": "Respond to proposal",
  "at-the-workshop":                "Start repair",
  "in-repair":                      "Complete repair",
  "rework-request-pending":         "Respond to rework",
  "ready-for-return":               "Schedule return",
  "rework-request-approved":        "Schedule pickup",
};

/** Which team currently owns the action for a given status — mirrors
 * WORKSHOP_ACTION_STATUSES / DISPATCH_ACTION_STATUSES in AdminDashboard.tsx.
 * Surfaced on the order header so opening the details page doesn't lose the
 * "who does this belong to" context the dashboard tabs already make clear. */
const ACTION_OWNER: Partial<Record<OrderStatus, "workshop" | "dispatch">> = {
  "proposal-awaiting-our-response": "workshop",
  "at-the-workshop":                "workshop",
  "in-repair":                      "workshop",
  "rework-request-pending":         "workshop",
  "ready-for-return":               "dispatch",
  "rework-request-approved":        "dispatch",
};

const ACTION_OWNER_LABEL: Record<"workshop" | "dispatch", string> = {
  workshop: "Workshop action",
  dispatch: "Dispatch action",
};

const ACTION_OWNER_COLOR: Record<"workshop" | "dispatch", string> = {
  workshop: "#6b21a8",
  dispatch: "#1e40af",
};

// ─────────────────────────────────────────────────────────────────────────────
// Dummy data  (one fully-populated order + fallbacks)
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = "2026-07-08";

const ORDER_DETAILS: Record<string, OrderDetail> = {
  // Demo order for Danielle's per-pair-of-shoes preview request. Two pairs in
  // one order — one further along (intake done, services checked, outtake in
  // progress) and one just starting — to show how pairs progress independently
  // within the same order. Diverges from the dashboard's dummy status for
  // ORD-2026-001 (a proposal there) specifically so intake/outtake has
  // something real to show; same customer/address for continuity.
  "1": {
    id: "1",
    orderNumber: "ORD-2026-001",
    status: "in-repair",
    datePlaced: "2026-06-29",
    isRework: false,
    actionRequiredBy: "2026-07-05", // 3 days overdue
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    customer: {
      name: "Sarah Chen",
      phone: "(212) 555-0101",
      email: "sarah.chen@email.com",
    },
    address: "123 Park Ave, New York, NY 10017",
    pickupSlot: { date: "2026-07-03", timeLabel: "10:00 – 11:30 AM" },
    pairs: [
      {
        id: "1-p1",
        shoeType: "Oxford / Dress shoe",
        shoeBrand: "Cole Haan",
        shoeColorMaterial: "Cognac leather",
        customerNotes: "Please match the color as close as possible to the original — these are for a wedding next month.",
        photos: { customerSubmitted: 2, before: 2, after: 0 },
        services: [
          { id: "1-p1-s1", name: "Resole",                    priceCents: 8500, tag: "original", done: true },
          { id: "1-p1-s2", name: "Cleaning & conditioning",    priceCents: 6500, tag: "original", done: true },
        ],
        intakeStatus: "complete",
        completionStatus: "in-progress",
      },
      {
        id: "1-p2",
        shoeType: "Ankle boot",
        shoeBrand: "Frye",
        shoeColorMaterial: "Black leather",
        // No customerNotes for this pair — shown as "No notes provided" rather than hidden.
        photos: { customerSubmitted: 1, before: 0, after: 0 },
        services: [
          { id: "1-p2-s1", name: "Heel replacement", priceCents: 5500, tag: "original", done: false },
        ],
        intakeStatus: "not-started",
        completionStatus: "not-started",
      },
    ],
    comments: [
      {
        initials: "DO",
        author: "Danielle Olsen",
        isoTimestamp: "2026-07-03T10:45:00",
        text: "Picked up both pairs from concierge. Dress shoe intake done — starting resole. Boot still needs intake.",
      },
      {
        initials: "OB",
        author: "Olivier B.",
        isoTimestamp: "2026-07-05T14:10:00",
        text: "Dress shoe resole + conditioning both done — starting outtake photos. Will get to the boot's intake tomorrow.",
      },
    ],
  },
  "2": {
    id: "2",
    orderNumber: "ORD-2026-002",
    status: "in-repair",
    datePlaced: "2026-06-25",
    isRework: false,
    actionRequiredBy: "2026-07-08",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    customer: {
      name: "Marcus Webb",
      phone: "(646) 555-0202",
      email: "marcus.webb@email.com",
    },
    address: "456 Lexington Ave, New York, NY 10017",
    pickupSlot: { date: "2026-07-07", timeLabel: "9:00 – 10:30 AM" },
    pairs: [
      {
        id: "2-p1",
        shoeType: "Oxford / Dress shoe",
        shoeBrand: "Allen Edmonds",
        shoeColorMaterial: "Black leather",
        photos: { customerSubmitted: 3, before: 4, after: 0 },
        services: [
          { id: "2-p1-s1", name: "Resole",                        priceCents: 8500, tag: "original", done: true },
          { id: "2-p1-s2", name: "Leather or suede conditioning",  priceCents: 6500, tag: "original", done: false },
          { id: "2-p1-s3", name: "High-heel tip replacement",      priceCents: 3500, tag: "rework",   done: false },
        ],
        intakeStatus: "complete",
        completionStatus: "not-started",
      },
    ],
    comments: [
      {
        initials: "DO",
        author: "Danielle Olsen",
        isoTimestamp: "2026-07-07T09:32:00",
        text: "Picked up from building concierge. Left boot has more wear on the outer heel than the customer's photos suggested — flagged for extra attention during resole.",
      },
      {
        initials: "OB",
        author: "Olivier B.",
        isoTimestamp: "2026-07-07T11:15:00",
        text: "Checked in at the workshop. Starting resole today. Will update once soles are removed so we can confirm any sub-sole damage.",
      },
      {
        initials: "DO",
        author: "Danielle Olsen",
        isoTimestamp: "2026-07-08T08:44:00",
        text: "Reminder: completion due today. How's progress?",
      },
    ],
  },
  "5": {
    id: "5",
    orderNumber: "ORD-2026-005",
    status: "rework-request-pending",
    datePlaced: "2026-06-15",
    isRework: true,
    actionRequiredBy: "2026-07-06",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    customer: {
      name: "Nina Patel",
      phone: "(347) 555-0505",
      email: "nina.patel@email.com",
    },
    address: "330 E 57th St, New York, NY 10022",
    pickupSlot: { date: "2026-06-21", timeLabel: "11:00 AM – 12:30 PM" },
    returnSlot: { date: "2026-06-30", timeLabel: "2:00 – 3:30 PM" },
    pairs: [
      {
        id: "5-p1",
        shoeType: "Ankle boot",
        shoeBrand: "Isabel Marant",
        shoeColorMaterial: "Tan suede",
        photos: { customerSubmitted: 2, before: 3, after: 2 },
        services: [
          { id: "5-p1-s1", name: "Seam repair", priceCents: 5000, tag: "original", done: true },
          { id: "5-p1-s2", name: "Shoe shine",   priceCents: 2000, tag: "original", done: true },
        ],
        intakeStatus: "complete",
        completionStatus: "complete",
      },
    ],
    comments: [
      {
        initials: "OB",
        author: "Olivier B.",
        isoTimestamp: "2026-06-30T14:22:00",
        text: "Returned to customer. Seam repair and shine done.",
      },
      {
        initials: "DO",
        author: "Danielle Olsen",
        isoTimestamp: "2026-07-05T09:10:00",
        text: "Rework request received — customer says stitching separated after first wear. Photos attached in request. Need to review and respond.",
      },
    ],
    notes: "Customer says stitching separated after first wear",
  },
  "9": {
    id: "9",
    orderNumber: "ORD-2026-009",
    status: "rework-request-approved",
    datePlaced: "2026-06-20",
    isRework: true,
    actionRequiredBy: "2026-07-08",
    workshopAssignee: "OB",
    dispatchAssignee: "DO",
    customer: {
      name: "Grace Kim",
      phone: "(212) 555-0909",
      email: "grace.kim@email.com",
    },
    address: "77 Franklin St, New York, NY 10013",
    // No current pickup/return — the rework pickup hasn't been scheduled yet
    // (order is "awaiting pickup scheduling"). The *original* pickup/return
    // from before the rework are retained below, not cleared.
    logisticsHistory: [
      { label: "Initial pickup", date: "2026-06-20", timeLabel: "1:00 – 2:30 PM" },
      { label: "Initial return", date: "2026-06-27", timeLabel: "3:00 – 4:30 PM" },
    ],
    pairs: [
      {
        id: "9-p1",
        shoeType: "Chelsea boot",
        shoeBrand: "Common Projects",
        shoeColorMaterial: "Black leather",
        photos: { customerSubmitted: 2, before: 3, after: 3 },
        services: [
          { id: "9-p1-s1", name: "Seam repair", priceCents: 5500, tag: "original", done: true },
          { id: "9-p1-s2", name: "Heel repair",  priceCents: 4500, tag: "rework",   done: true },
        ],
        intakeStatus: "complete",
        completionStatus: "complete",
      },
    ],
    comments: [
      {
        initials: "OB",
        author: "Olivier B.",
        isoTimestamp: "2026-06-27T15:40:00",
        text: "Returned to customer. Seam repair done and looking clean.",
      },
      {
        initials: "DO",
        author: "Danielle Olsen",
        isoTimestamp: "2026-07-06T10:05:00",
        text: "Rework approved — left heel re-stitch, no charge. Waiting on customer to schedule pickup.",
      },
    ],
    notes: "Approved re-stitch on left heel — awaiting pickup scheduling",
  },
  "10": {
    id: "10",
    orderNumber: "ORD-2026-010",
    status: "at-the-workshop",
    datePlaced: "2026-07-07",
    isRework: false,
    actionRequiredBy: "2026-07-11",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    customer: {
      name: "Omar Faruk",
      phone: "(212) 555-1010",
      email: "omar.faruk@email.com",
    },
    address: "10 Hanover Sq, New York, NY 10005",
    pickupSlot: { date: "2026-07-08", timeLabel: "10:00 – 11:30 AM" },
    pairs: [
      {
        id: "10-p1",
        shoeType: "Loafer",
        shoeBrand: "Gucci",
        shoeColorMaterial: "Tan leather / horsebit hardware",
        photos: { customerSubmitted: 4, before: 0, after: 0 },
        services: [
          { id: "10-p1-s1", name: "Hardware repair",      priceCents: 4500, tag: "original", done: false },
          { id: "10-p1-s2", name: "Leather conditioning",  priceCents: 6500, tag: "original", done: false },
        ],
        intakeStatus: "not-started",
        completionStatus: "not-started",
      },
    ],
    comments: [],
  },
};

/** Fallback for orders not in the detail map — shows generic content */
function buildFallback(id: string): OrderDetail {
  return {
    id,
    orderNumber: `ORD-2026-${id.padStart(3, "0")}`,
    status: "pickup-scheduled",
    datePlaced: "2026-07-01",
    isRework: false,
    actionRequiredBy: null,
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    customer: { name: "Customer Name", phone: "(212) 555-0000", email: "customer@email.com" },
    address: "New York, NY",
    pairs: [],
    comments: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtPrice(cents: number) {
  return "$" + (cents / 100).toFixed(0);
}

function dueTiming(dateStr: string | null): "overdue" | "today" | "upcoming" | null {
  if (!dateStr) return null;
  const d = dateStr.slice(0, 10);
  if (d < TODAY) return "overdue";
  if (d === TODAY) return "today";
  return "upcoming";
}

function daysOverdue(dateStr: string) {
  return Math.round((new Date(TODAY).getTime() - new Date(dateStr + "T00:00:00").getTime()) / 86_400_000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Atom / shared components
// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: OrderStatus }) {
  const c = STATUS_CFG[status];
  return (
    <span style={{ display: "inline-block", backgroundColor: c.bg, color: c.fg, padding: "3px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 500 }}>
      {c.label}
    </span>
  );
}

function FormStatusBadge({ status, label }: { status: FormStatus; label: string }) {
  const cfg: Record<FormStatus, { icon: React.ReactNode; color: string; bg: string }> = {
    "not-started": { icon: <Circle size={14} />,       color: "#9ca3af", bg: "#f3f4f6" },
    "in-progress": { icon: <Clock size={14} />,        color: "#92400e", bg: "#fef3c7" },
    "complete":    { icon: <CheckCircle2 size={14} />, color: "#166534", bg: "#dcfce7" },
  };
  const c = cfg[status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: c.bg, color: c.color, padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, width: "fit-content" }}>
      {c.icon}
      {label}: {status === "not-started" ? "Not started" : status === "in-progress" ? "In progress" : "Complete"}
    </div>
  );
}

/** Generic section card — optionally takes a headerAction (e.g. a single CTA
 * button shown to the right of the title, instead of buttons buried in the
 * body of the card). */
function Card({
  title,
  children,
  icon,
  headerAction,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #f0ece5", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon && <span style={{ color: "#9ca3af" }}>{icon}</span>}
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#3d1700" }}>{title}</h2>
        </div>
        {headerAction}
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

/** Key–value row used in Customer details */
function KVRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start", fontSize: 13 }}>
      <span style={{ color: "#9ca3af", minWidth: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#374151" }}>{children}</span>
    </div>
  );
}

/** Photo thumbnail grid with placeholder tiles */
function PhotoGrid({ count, label }: { count: number; label: string }) {
  if (count === 0) {
    return <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>No {label.toLowerCase()} photos yet.</p>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 72, height: 72, borderRadius: 6, backgroundColor: "#f3f4f6",
            border: "1px solid #e0d8cc", display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "zoom-in", flexShrink: 0,
          }}
          title={`${label} photo ${i + 1}`}
        >
          <Camera size={20} style={{ color: "#9ca3af" }} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section components
// ─────────────────────────────────────────────────────────────────────────────

function CustomerLogisticsCard({ order, expanded }: { order: OrderDetail; expanded: boolean }) {
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(order.address)}`;
  return (
    <Card title="Customer details" icon={<User size={14} />}>
      <KVRow label="Name">{order.customer.name}</KVRow>
      <KVRow label="Phone">
        <a href={`tel:${order.customer.phone}`} style={{ color: "#2563eb", textDecoration: "none" }}>
          {order.customer.phone}
        </a>
      </KVRow>
      {expanded && (
        <KVRow label="Email">
          <a href={`mailto:${order.customer.email}`} style={{ color: "#2563eb", textDecoration: "none" }}>
            {order.customer.email}
          </a>
        </KVRow>
      )}
      <KVRow label="Address">
        <a href={mapUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
          {order.address}
        </a>
      </KVRow>
      {/* Pickup and return are flagged independently — an order can have a
       * confirmed pickup with no return scheduled yet (the common case), so
       * neither should wait on the other before showing a "not scheduled" flag. */}
      <KVRow label="Pickup">
        {order.pickupSlot
          ? `${fmtDate(order.pickupSlot.date)}, ${order.pickupSlot.timeLabel}`
          : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Not yet scheduled</span>}
      </KVRow>
      <KVRow label="Return">
        {order.returnSlot
          ? `${fmtDate(order.returnSlot.date)}, ${order.returnSlot.timeLabel}`
          : <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Not yet scheduled</span>}
      </KVRow>
      {order.logisticsHistory && order.logisticsHistory.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0ece5" }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Prior logistics
          </p>
          {order.logisticsHistory.map((leg, i) => (
            <KVRow key={i} label={leg.label}>
              {fmtDate(leg.date)}, {leg.timeLabel}
            </KVRow>
          ))}
        </div>
      )}
      {order.notes && expanded && (
        <KVRow label="Notes">
          <span style={{ fontStyle: "italic", color: "#6b7280" }}>{order.notes}</span>
        </KVRow>
      )}
    </Card>
  );
}

/** A single form row — reads like a document you click into, not a checkbox
 * to tick. Grayed out and unclickable when blocked (Outtake before Intake is
 * done); otherwise a normal clickable row. */
function FormRow({
  label,
  status,
  disabled,
}: {
  label: string;
  status: FormStatus;
  disabled: boolean;
}) {
  const statusText = status === "not-started" ? "Not started" : status === "in-progress" ? "In progress" : "Complete";
  const iconColor = status === "complete" ? "#166534" : disabled ? "#d1d5db" : status === "in-progress" ? "#92400e" : "#9ca3af";
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        padding: "10px 12px", borderRadius: 6, border: "1px solid #e0d8cc",
        backgroundColor: disabled ? "#f9fafb" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        fontFamily: "inherit",
      }}
    >
      {status === "complete" ? <CheckCircle2 size={16} style={{ color: iconColor, flexShrink: 0 }} /> : <FileText size={16} style={{ color: iconColor, flexShrink: 0 }} />}
      <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>{label}</span>
      <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{statusText}</span>
    </button>
  );
}

/** Services shown as an actual checklist — staff check each one off as it's
 * completed, rather than a single all-or-nothing status, so nothing gets
 * forgotten on a multi-service pair. Local state only for now (dummy data);
 * wiring to persist real completions comes with the live backend. */
function ServiceChecklist({
  services,
  onToggle,
  locked,
}: {
  services: ServiceLine[];
  onToggle: (id: string) => void;
  /** True when this pair's intake isn't complete yet — checkboxes render
   * disabled and clicking one surfaces an explanation instead of silently
   * doing nothing. Guards both the UI and the handler itself. */
  locked: boolean;
}) {
  if (services.length === 0) {
    return <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>No services recorded yet.</p>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {locked && (
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", marginBottom: 2,
            borderRadius: 6, backgroundColor: "#fef2f2", border: "1px solid #fecaca",
            fontSize: 12, color: "#991b1b", fontWeight: 500,
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          Complete intake before checking off services on this pair.
        </div>
      )}
      {services.map(s => (
        <label
          key={s.id}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 6,
            cursor: locked ? "not-allowed" : "pointer",
            backgroundColor: s.done ? "#f0fdf4" : "transparent",
            opacity: locked ? 0.55 : 1,
          }}
          title={locked ? "Complete intake before checking off services on this pair." : undefined}
        >
          <input
            type="checkbox"
            checked={!!s.done}
            disabled={locked}
            onChange={() => { if (!locked) onToggle(s.id); }}
            style={{ cursor: locked ? "not-allowed" : "pointer", accentColor: "#166534", width: 15, height: 15, flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: s.done ? "#166534" : "#374151", textDecoration: s.done ? "line-through" : "none", flex: 1 }}>
            {s.name}
          </span>
          <span
            style={{
              fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4, flexShrink: 0,
              backgroundColor: s.tag === "rework" ? "#fee2e2" : "#f3f4f6",
              color: s.tag === "rework" ? "#991b1b" : "#6b7280",
            }}
          >
            {s.tag === "rework" ? "Added via rework" : "Original"}
          </span>
          <span style={{ fontSize: 13, color: "#374151", fontWeight: 500, minWidth: 44, textAlign: "right", flexShrink: 0 }}>
            {fmtPrice(s.priceCents)}
          </span>
        </label>
      ))}
    </div>
  );
}

/** One card per pair of shoes in the order — shoe details, notes, photos,
 * a services checklist, and this pair's own intake/outtake status, all in one
 * place (Danielle's ask: this reads closer to the compact "Repair summary"
 * style than the previous split-into-three-cards layout). An order with
 * multiple pairs gets one of these per pair, each progressing independently —
 * outtake for a pair is blocked until that pair's own intake is complete. */
function PairCard({ pair, index, total }: { pair: ShoePair; index: number; total: number }) {
  const [services, setServices] = useState<ServiceLine[]>(pair.services);
  const intakeDone = pair.intakeStatus === "complete";
  const toggleService = (id: string) => {
    // Guard the handler itself, not just the UI — a service can't be marked
    // done on a pair whose intake isn't complete yet (Danielle's bug report:
    // she was able to check off "Heel replacement" before intake started).
    if (!intakeDone) return;
    setServices(prev => prev.map(s => (s.id === id ? { ...s, done: !s.done } : s)));
  };
  const servicesTotal = services.reduce((s, l) => s + l.priceCents, 0);
  const allServicesDone = services.length > 0 && services.every(s => s.done);

  const outtakeDone = pair.completionStatus === "complete";
  const headerCta = !intakeDone
    ? (pair.intakeStatus === "not-started" ? "Complete intake form" : "Continue intake form")
    : !outtakeDone
    ? (pair.completionStatus === "not-started" ? "Complete outtake form" : "Continue outtake form")
    : null;

  const title = total > 1
    ? `Pair ${index + 1}${pair.shoeType ? ` — ${pair.shoeType}` : ""}`
    : (pair.shoeType || "Shoe & services");

  const photoGroups = [
    { label: "Customer-submitted", count: pair.photos.customerSubmitted },
    { label: "Before (intake)",    count: pair.photos.before },
    { label: "After (outtake)",    count: pair.photos.after },
  ];

  return (
    <Card
      title={title}
      headerAction={headerCta && (
        <button
          type="button"
          style={{ padding: "6px 14px", backgroundColor: "#3d1700", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          {headerCta} →
        </button>
      )}
    >
      <KVRow label="Shoe type">{pair.shoeType || "—"}</KVRow>
      <KVRow label="Brand">{pair.shoeBrand || "—"}</KVRow>
      <KVRow label="Color / material">{pair.shoeColorMaterial || "—"}</KVRow>
      <KVRow label="Notes">
        {pair.customerNotes
          ? <span style={{ fontStyle: "italic" }}>{pair.customerNotes}</span>
          : <span style={{ color: "#9ca3af" }}>No notes provided</span>}
      </KVRow>

      <div style={{ marginTop: 14 }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Photos (optional)</p>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {photoGroups.map(g => (
            <div key={g.label} style={{ minWidth: 140 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#9ca3af" }}>{g.label} · {g.count}</p>
              <PhotoGrid count={g.count} label={g.label} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Services applied</p>
        <ServiceChecklist services={services} onToggle={toggleService} locked={!intakeDone} />
        {services.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6, fontSize: 13, fontWeight: 600, color: "#3d1700" }}>
            Total: {fmtPrice(servicesTotal)}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <FormRow label="Intake form" status={pair.intakeStatus} disabled={false} />
          <FormRow label="Outtake form" status={pair.completionStatus} disabled={!intakeDone} />
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9ca3af" }}>
          Complete intake to start the repair — services can't be checked off until then. Complete outtake to close it out.
          {!allServicesDone && services.length > 0 ? " All services must be checked off before outtake can be marked complete." : ""}
        </p>
      </div>
    </Card>
  );
}

function CommentsCard({ order }: { order: OrderDetail }) {
  const [draft, setDraft] = useState("");
  const [comments, setComments] = useState<Comment[]>(order.comments);

  const addComment = () => {
    const text = draft.trim();
    if (!text) return;
    setComments(prev => [
      ...prev,
      { initials: "DO", author: "Danielle Olsen", isoTimestamp: new Date().toISOString(), text },
    ]);
    setDraft("");
  };

  return (
    <Card title="Internal comments" icon={<MessageSquare size={14} />}>
      {comments.length === 0 && (
        <p style={{ color: "#9ca3af", fontSize: 13, marginBottom: 16 }}>No comments yet — be the first to leave a note.</p>
      )}
      {comments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
          {comments.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", backgroundColor: "#fdf3e0", color: "#3d1700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {c.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#3d1700" }}>{c.author}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtTimestamp(c.isoTimestamp)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.5 }}>{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Add comment */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addComment(); }}
          style={{ flex: 1, border: "1px solid #e0d8cc", borderRadius: 6, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", color: "#374151" }}
        />
        <button
          type="button"
          onClick={addComment}
          disabled={!draft.trim()}
          style={{ padding: "8px 14px", backgroundColor: "#3d1700", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: draft.trim() ? "pointer" : "not-allowed", opacity: draft.trim() ? 1 : 0.45, flexShrink: 0 }}
        >
          Add comment
        </button>
      </div>
    </Card>
  );
}

/** Compact sidebar card — shows condensed shoe/services/intake info for Dispatch view */
function WorkshopSummaryCard({ order }: { order: OrderDetail }) {
  return (
    <Card title="Repair summary">
      {order.isRework && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, backgroundColor: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, marginBottom: 12 }}>
          Rework order
        </div>
      )}
      {order.pairs.length === 0 && (
        <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>No shoe pairs recorded yet.</p>
      )}
      {order.pairs.map((pair, i) => {
        const totalServices = pair.services.length;
        const doneServices = pair.services.filter(s => s.done).length;
        const totalPhotos = pair.photos.customerSubmitted + pair.photos.before + pair.photos.after;
        return (
          <div
            key={pair.id}
            style={{
              marginBottom: i < order.pairs.length - 1 ? 16 : 0,
              paddingBottom: i < order.pairs.length - 1 ? 16 : 0,
              borderBottom: i < order.pairs.length - 1 ? "1px solid #f0ece5" : "none",
            }}
          >
            {order.pairs.length > 1 && (
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Pair {i + 1}
              </p>
            )}
            <KVRow label="Shoe">{pair.shoeType}{pair.shoeBrand ? ` · ${pair.shoeBrand}` : ""}</KVRow>
            <KVRow label="Services">
              {totalServices ? `${doneServices}/${totalServices} done` : "None recorded"}
            </KVRow>
            {pair.services.slice(0, 3).map((s, si) => (
              <div key={si} style={{ paddingLeft: 110, fontSize: 12, color: s.done ? "#166534" : "#6b7280", marginBottom: 3 }}>
                {s.done ? "✓ " : "· "}{s.name}
              </div>
            ))}
            {pair.services.length > 3 && (
              <div style={{ paddingLeft: 110, fontSize: 12, color: "#9ca3af", marginBottom: 3 }}>+ {pair.services.length - 3} more</div>
            )}
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <FormStatusBadge status={pair.intakeStatus} label="Intake" />
              <FormStatusBadge status={pair.completionStatus} label="Outtake" />
            </div>
            {totalPhotos > 0 && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6b7280" }}>{totalPhotos} photo{totalPhotos > 1 ? "s" : ""} on file</p>
            )}
          </div>
        );
      })}
    </Card>
  );
}

/** Compact sidebar for Workshop view — condensed Customer details */
function CustomerSidebarCard({ order }: { order: OrderDetail }) {
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(order.address)}`;
  return (
    <Card title="Customer details" icon={<User size={14} />}>
      <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>{order.customer.name}</div>
      <a href={`tel:${order.customer.phone}`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#2563eb", textDecoration: "none", marginBottom: 8 }}>
        <Phone size={13} /> {order.customer.phone}
      </a>
      <a href={mapUrl} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#2563eb", textDecoration: "underline", marginBottom: 8 }}>
        <MapPin size={13} style={{ marginTop: 1, flexShrink: 0 }} /> {order.address}
      </a>
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        <span style={{ fontWeight: 500 }}>Pickup:</span>{" "}
        {order.pickupSlot ? `${fmtDate(order.pickupSlot.date)}, ${order.pickupSlot.timeLabel}` : <em>Not yet scheduled</em>}
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
        <span style={{ fontWeight: 500 }}>Return:</span>{" "}
        {order.returnSlot ? `${fmtDate(order.returnSlot.date)}, ${order.returnSlot.timeLabel}` : <em>Not yet scheduled</em>}
      </div>
      {order.logisticsHistory && order.logisticsHistory.length > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9ca3af" }}>
          + {order.logisticsHistory.length} prior logistics entr{order.logisticsHistory.length === 1 ? "y" : "ies"} on file
        </p>
      )}
      {order.notes && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>{order.notes}</p>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

function PageHeader({ order }: { order: OrderDetail }) {
  const navigate = useNavigate();
  const timing = dueTiming(order.actionRequiredBy);
  const quickAction = QUICK_ACTION[order.status];
  const actionOwner = ACTION_OWNER[order.status];

  const dueLabel = (() => {
    if (!timing || !order.actionRequiredBy) return null;
    if (timing === "overdue") {
      const n = daysOverdue(order.actionRequiredBy);
      return <span style={{ color: "#dc2626", fontWeight: 700 }}>{n} {n === 1 ? "day" : "days"} overdue</span>;
    }
    if (timing === "today") return <span style={{ color: "#d97706", fontWeight: 600 }}>Due today</span>;
    return <span style={{ color: "#6b7280" }}>Due {fmtDate(order.actionRequiredBy)}</span>;
  })();

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8, padding: "18px 22px", marginBottom: 16 }}>
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", marginBottom: 14, padding: 0, fontFamily: "inherit" }}
      >
        <ArrowLeft size={14} /> Back to operations dashboard
      </button>

      {/* Top row: order # + badges (left) — consolidated action block (right) */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#3d1700" }}>{order.orderNumber}</span>
          <StatusPill status={order.status} />
          {order.isRework && (
            <span style={{ backgroundColor: "#fef3c7", color: "#92400e", fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 5 }}>Rework</span>
          )}
        </div>

        {/* Everything about the current action — who owns it, what it is, and
         * how overdue it is — lives in one block on the far right, so opening
         * the details page doesn't scatter that context across the header
         * the way "Workshop action" / the button / "3 days overdue" used to.
         * The action button itself is colored the same red used for
         * "Action required" badges on the dashboard tables, rather than the
         * page's standard brown CTA color — same visual language for "this
         * needs doing" everywhere in the admin views. */}
        {quickAction && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            {actionOwner && (
              <span style={{ fontSize: 10, fontWeight: 700, color: ACTION_OWNER_COLOR[actionOwner], textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {ACTION_OWNER_LABEL[actionOwner]}
              </span>
            )}
            <button
              type="button"
              style={{ padding: "7px 16px", backgroundColor: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {quickAction}
            </button>
            {dueLabel && <span style={{ fontSize: 12 }}>{dueLabel}</span>}
          </div>
        )}
      </div>

      {/* Meta row */}
      <div style={{ marginTop: 10, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#6b7280" }}>Placed {fmtDate(order.datePlaced)}</span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>Workshop assigned: <strong style={{ color: "#374151" }}>{order.workshopAssignee}</strong></span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>Dispatch assigned: <strong style={{ color: "#374151" }}>{order.dispatchAssignee}</strong></span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workshop details / Dispatch details tab switcher
// ─────────────────────────────────────────────────────────────────────────────

/** In-page tab switcher — defaults to whichever tab matches where you clicked
 * in from, but switches instantly without leaving the page (unlike the old
 * behavior, which only changed layout if you navigated back and re-entered
 * from the other dashboard view). */
function DetailTabBar({ active, onSelect }: { active: DetailView; onSelect: (v: DetailView) => void }) {
  const tabs: [DetailView, string][] = [
    ["workshop", "Workshop details"],
    ["dispatch", "Dispatch details"],
  ];
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e0d8cc", marginBottom: 16 }}>
      {tabs.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onSelect(v)}
          style={{
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: active === v ? 600 : 400,
            color: active === v ? "#3d1700" : "#6b7280",
            background: "none",
            border: "none",
            borderBottom: active === v ? "2px solid #3d1700" : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminOrderDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView: DetailView = searchParams.get("view") === "dispatch" ? "dispatch" : "workshop";
  const [detailView, setDetailView] = useState<DetailView>(initialView);

  const handleTabSelect = (v: DetailView) => {
    setDetailView(v);
    // Keep the URL in sync (so refresh/share preserves the tab) without a full navigation.
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set("view", v);
      return next;
    }, { replace: true });
  };

  const order = ORDER_DETAILS[id] ?? buildFallback(id);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9f7f4", fontFamily: "'Public Sans', 'Albert Sans', sans-serif" }}>
      {/* ── Top bar (matches dashboard) ── */}
      <header style={{ backgroundColor: "#3d1700", padding: "0 24px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: "-0.3px" }}>Cobbli</span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
          {detailView === "workshop" ? "Workshop" : "Dispatch"} — Order detail
        </span>
        <div style={{ width: 34, height: 34, borderRadius: "50%", backgroundColor: "#fdb600", color: "#3d1700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
          DA
        </div>
      </header>

      {/* ── Page content ── */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
        <PageHeader order={order} />

        <DetailTabBar active={detailView} onSelect={handleTabSelect} />

        {/* Two-column layout — primary/sidebar swap based on the active tab */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, alignItems: "start" }}>

          {detailView === "workshop" ? (
            <>
              {/* Primary column — workshop: one card per pair of shoes (shoe
                  details, notes, photos, services checklist, intake/outtake),
                  then internal comments shared across the whole order. */}
              <div>
                {order.pairs.length === 0 ? (
                  <Card title="Shoe &amp; services">
                    <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>No shoe pairs recorded yet.</p>
                  </Card>
                ) : (
                  order.pairs.map((pair, i) => (
                    <PairCard key={pair.id} pair={pair} index={i} total={order.pairs.length} />
                  ))
                )}
                <CommentsCard order={order} />
              </div>
              {/* Sidebar — condensed customer & logistics */}
              <div>
                <CustomerSidebarCard order={order} />
              </div>
            </>
          ) : (
            <>
              {/* Primary column — dispatch: customer & logistics (full pickup/return detail) first */}
              <div>
                <CustomerLogisticsCard order={order} expanded />
                <CommentsCard order={order} />
              </div>
              {/* Sidebar — condensed repair summary (not critical for dispatch, kept for reference) */}
              <div>
                <WorkshopSummaryCard order={order} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
