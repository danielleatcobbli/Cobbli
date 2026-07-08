/**
 * AdminDashboard
 *
 * Operations dashboard for Cobbli staff. All data is currently hardcoded —
 * layout, columns, tabs, colors, and interactions are intentionally finalized
 * so Henry / Olivier can wire to live data afterward.
 *
 * Route: /admin  (admin + staff roles)
 *
 * NOTE ON "Preview as" control: staff_team / admin role isn't wired to real
 * Supabase auth yet (see Section 9 of the requirements doc). The dropdown next
 * to the avatar simulates the three viewer types (Admin, Workshop staff,
 * Dispatch staff) purely so the tab-visibility / personalized-filtering rules
 * can be reviewed with dummy data before that wiring happens. Remove it once
 * the real `staff_team` field drives this instead.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
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

type ScheduleSlot = { date: string; timeLabel: string };

type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  datePlaced: string;
  customer: { name: string; phone: string };
  address: string;
  workshopAssignee: string;
  dispatchAssignee: string;
  isRework: boolean;
  actionRequiredBy: string | null;
  /** Date of the last contact attempt (automated link/reminder send, or a
   * manual call) — replaces the earlier categorical "contact status" badge.
   * Danielle's call: what actually drives whether an order needs a human
   * follow-up is *when* we last reached out, not a label like "reminder
   * sent" — so surface the date itself instead of a status word. */
  lastContactedAt?: string | null;
  pickupSlot?: ScheduleSlot;
  returnSlot?: ScheduleSlot;
  notes?: string;
};

type TopView = "workshop" | "dispatch" | "kpis";
type WorkshopTab = "action-required" | "all-orders" | "proposals" | "awaiting-repair" | "in-repair" | "reworks" | "completed";
type DispatchTab = "action-required" | "today-schedule" | "tomorrow-schedule" | "all-scheduled" | "all-orders";

/** Simulated viewer perspective — see file-header note. */
type Perspective = "admin" | "workshop-staff" | "dispatch-staff";

const PERSPECTIVE_LABEL: Record<Perspective, string> = {
  admin: "Admin — sees everything",
  "workshop-staff": "Staff — Workshop team",
  "dispatch-staff": "Staff — Dispatch team",
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants — status config
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

/** Statuses permanently excluded from "All orders" — Completed has its own
 * tab, and "awaiting customer response" proposals live in the Proposals tab.
 * No toggle to reveal them here anymore — see Section 9 revision. */
const HIDDEN_FROM_ALL_ORDERS: Set<OrderStatus> = new Set([
  "completed",
  "proposal-awaiting-customer-response",
]);

const ALL_STATUSES = Object.keys(STATUS_CFG) as OrderStatus[];
const ALL_ORDERS_STATUS_OPTIONS = ALL_STATUSES.filter(s => !HIDDEN_FROM_ALL_ORDERS.has(s));
const WORKSHOP_ACTION_STATUSES: OrderStatus[] = ["proposal-awaiting-our-response", "at-the-workshop", "in-repair", "rework-request-pending"];
const DISPATCH_ACTION_STATUSES: OrderStatus[] = ["ready-for-return", "rework-request-approved"];
const PROPOSAL_STATUSES: OrderStatus[] = ["proposal-awaiting-our-response", "proposal-awaiting-customer-response"];
const REWORK_STATUSES: OrderStatus[] = ["rework-request-pending", "rework-request-approved", "rework-request-denied"];
/** "Reworks open" excludes denied — a denied rework isn't waiting on anyone
 * anymore, it's just sitting out its auto-close grace window. */
const REWORK_OPEN_STATUSES: OrderStatus[] = ["rework-request-pending", "rework-request-approved"];

// ─────────────────────────────────────────────────────────────────────────────
// Dummy data  (hardcoded — replace with live fetch)
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = "2026-07-08";
const TOMORROW = "2026-07-09";
const CURRENT_USER = "DO";

const ORDERS: Order[] = [
  {
    id: "1",
    orderNumber: "ORD-2026-001",
    status: "proposal-awaiting-our-response",
    datePlaced: "2026-06-29",
    customer: { name: "Sarah Chen", phone: "(212) 555-0101" },
    address: "123 Park Ave, New York, NY 10017",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    isRework: false,
    actionRequiredBy: "2026-07-05", // 3 days overdue
  },
  {
    id: "2",
    orderNumber: "ORD-2026-002",
    status: "in-repair",
    datePlaced: "2026-06-25",
    customer: { name: "Marcus Webb", phone: "(646) 555-0202" },
    address: "456 Lexington Ave, New York, NY 10017",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    isRework: false,
    actionRequiredBy: "2026-07-08", // due today
  },
  {
    id: "3",
    orderNumber: "ORD-2026-003",
    status: "pickup-scheduled",
    datePlaced: "2026-07-06",
    customer: { name: "Priya Nair", phone: "(917) 555-0303" },
    address: "45 W 72nd St, New York, NY 10023",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    isRework: false,
    actionRequiredBy: null,
    lastContactedAt: "2026-07-06",
    pickupSlot: { date: "2026-07-08", timeLabel: "10:00 – 11:30 AM" },
    notes: "Ring buzzer 3B — concierge can accept",
  },
  {
    id: "4",
    orderNumber: "ORD-2026-004",
    // Was "placed" (paid, pickup not yet scheduled) — that gap no longer
    // exists now that checkout requires scheduling a pickup as part of
    // payment (see Section 5). Re-purposed to demonstrate the equivalent
    // still-real gap on the *return* side, which does still need a reminder
    // cadence since return scheduling happens later, post-repair.
    status: "ready-for-return",
    datePlaced: "2026-07-02",
    customer: { name: "James O'Sullivan", phone: "(212) 555-0404" },
    address: "89 Bleecker St, New York, NY 10012",
    workshopAssignee: "OB",
    dispatchAssignee: "DO",
    isRework: false,
    actionRequiredBy: "2026-07-08", // automated reminders exhausted — due today
    lastContactedAt: "2026-07-06", // day-2 automated reminder — customer still hasn't scheduled
  },
  {
    id: "5",
    orderNumber: "ORD-2026-005",
    status: "rework-request-pending",
    datePlaced: "2026-06-15",
    customer: { name: "Nina Patel", phone: "(347) 555-0505" },
    address: "330 E 57th St, New York, NY 10022",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    isRework: true,
    actionRequiredBy: "2026-07-06", // 2 days overdue
    notes: "Customer says stitching separated after first wear",
  },
  {
    id: "6",
    orderNumber: "ORD-2026-006",
    status: "rework-request-denied",
    datePlaced: "2026-06-10",
    customer: { name: "Luca Romano", phone: "(718) 555-0606" },
    address: "55 Water St, Brooklyn, NY 11201",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    isRework: true,
    actionRequiredBy: null,
    notes: "Dispute escalated to owner — see Slack thread",
  },
  {
    id: "7",
    orderNumber: "ORD-2026-007",
    status: "return-scheduled",
    datePlaced: "2026-06-18",
    customer: { name: "Ava Thompson", phone: "(212) 555-0707" },
    address: "1 Central Park W, New York, NY 10023",
    workshopAssignee: "OB",
    dispatchAssignee: "DO",
    isRework: false,
    actionRequiredBy: null,
    lastContactedAt: "2026-07-05",
    returnSlot: { date: "2026-07-08", timeLabel: "2:00 – 3:30 PM" },
    notes: "Leave with doorman if customer unavailable",
  },
  {
    id: "8",
    orderNumber: "ORD-2026-008",
    status: "completed",
    datePlaced: "2026-06-01",
    customer: { name: "Derek Huang", phone: "(917) 555-0808" },
    address: "200 Varick St, New York, NY 10014",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    isRework: false,
    actionRequiredBy: null,
  },
  {
    id: "9",
    orderNumber: "ORD-2026-009",
    status: "rework-request-approved",
    datePlaced: "2026-06-20",
    customer: { name: "Grace Kim", phone: "(212) 555-0909" },
    address: "77 Franklin St, New York, NY 10013",
    workshopAssignee: "OB",
    dispatchAssignee: "DO",
    isRework: true,
    actionRequiredBy: "2026-07-08", // reminders exhausted — needs dispatch follow-up
    lastContactedAt: "2026-07-06", // day-2 automated reminder — customer still hasn't scheduled
    notes: "Approved re-stitch on left heel — awaiting pickup scheduling",
  },
  {
    id: "10",
    orderNumber: "ORD-2026-010",
    status: "at-the-workshop",
    datePlaced: "2026-07-07",
    customer: { name: "Omar Faruk", phone: "(212) 555-1010" },
    address: "10 Hanover Sq, New York, NY 10005",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    isRework: false,
    actionRequiredBy: "2026-07-11", // upcoming
  },
  {
    id: "11",
    orderNumber: "ORD-2026-011",
    status: "proposal-awaiting-customer-response",
    datePlaced: "2026-07-04",
    customer: { name: "Bianca Rossi", phone: "(347) 555-1111" },
    address: "14 Wall St, New York, NY 10005",
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    isRework: false,
    actionRequiredBy: null, // ball's in the customer's court, no SLA
  },
  {
    id: "12",
    orderNumber: "ORD-2026-012",
    status: "proposal-awaiting-customer-response",
    datePlaced: "2026-07-03",
    customer: { name: "Tomás Vega", phone: "(646) 555-1212" },
    address: "500 W 23rd St, New York, NY 10011",
    workshopAssignee: "OB",
    dispatchAssignee: "DO",
    isRework: false,
    actionRequiredBy: null, // ball's in the customer's court, no SLA
  },
  {
    id: "13",
    orderNumber: "ORD-2026-013",
    status: "pickup-scheduled",
    datePlaced: "2026-07-08",
    customer: { name: "Wendy Alvarez", phone: "(212) 555-1313" },
    address: "350 5th Ave, New York, NY 10118",
    workshopAssignee: "DO",
    dispatchAssignee: "DO",
    isRework: false,
    actionRequiredBy: null,
    lastContactedAt: "2026-07-08",
    pickupSlot: { date: "2026-07-09", timeLabel: "9:00 – 10:30 AM" }, // tomorrow
    notes: "Front desk will hold shoes at reception",
  },
  {
    id: "14",
    orderNumber: "ORD-2026-014",
    status: "return-scheduled",
    datePlaced: "2026-06-28",
    customer: { name: "Felix Ono", phone: "(646) 555-1414" },
    address: "20 W 34th St, New York, NY 10001",
    workshopAssignee: "OB",
    dispatchAssignee: "OB",
    isRework: false,
    actionRequiredBy: null,
    lastContactedAt: "2026-07-07",
    returnSlot: { date: "2026-07-11", timeLabel: "1:00 – 2:30 PM" }, // a few days out — populates "All scheduled" beyond today/tomorrow
    notes: "Building requires photo ID at security desk",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function dueTiming(dateStr: string | null): "overdue" | "today" | "upcoming" | null {
  if (!dateStr) return null;
  const d = dateStr.slice(0, 10);
  if (d < TODAY) return "overdue";
  if (d === TODAY) return "today";
  return "upcoming";
}

function daysOverdue(dateStr: string): number {
  const diff =
    new Date(TODAY).getTime() - new Date(dateStr + "T00:00:00").getTime();
  return Math.round(diff / 86_400_000);
}

function fmtDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function workshopAction(status: OrderStatus): string | null {
  switch (status) {
    case "proposal-awaiting-our-response": return "Respond to proposal";
    case "at-the-workshop":               return "Start repair";
    case "in-repair":                     return "Complete repair";
    case "rework-request-pending":         return "Respond to rework";
    default: return null;
  }
}

function dispatchAction(order: Order): string | null {
  // An order only becomes an actionable escalation once actionRequiredBy is
  // set — i.e. once the automated link + automated reminder have both gone
  // out and the customer still hasn't scheduled (see the day-0/2/4 cadence in
  // Section 9 of the requirements doc). Orders still mid-automation have no
  // actionRequiredBy yet, so nothing shows here for them.
  if (order.actionRequiredBy === null) return null;
  switch (order.status) {
    // Both automated reminders already went out with no response — this is a
    // manual follow-up, not a first attempt, so the label is just the plain
    // scheduling task itself ("Schedule return" / "Schedule pickup"), not
    // "Follow up — ...". A rework-approved order still needs its *pickup*
    // scheduled (that's what re-enters it into the main pipeline), not a return.
    case "ready-for-return":         return "Schedule return";
    case "rework-request-approved":  return "Schedule pickup";
    default: return null;
  }
}

/** Sort overdue-first (most overdue first), then due-today, then upcoming
 * (soonest first), then no-date-set last. Applied everywhere action-required
 * style tables render so staff close out the oldest overdue items first. */
function sortByDue(orders: Order[]): Order[] {
  const bucket = (o: Order): number => {
    const t = dueTiming(o.actionRequiredBy);
    if (t === "overdue") return 0;
    if (t === "today") return 1;
    if (t === "upcoming") return 2;
    return 3;
  };
  return [...orders].sort((a, b) => {
    const ba = bucket(a);
    const bb = bucket(b);
    if (ba !== bb) return ba - bb;
    if (a.actionRequiredBy && b.actionRequiredBy) return a.actionRequiredBy.localeCompare(b.actionRequiredBy);
    return 0;
  });
}

function rowBorderColor(order: Order): string {
  const t = dueTiming(order.actionRequiredBy);
  if (t === "overdue") return "#dc2626";
  if (t === "today")   return "#f59e0b";
  return "transparent";
}

function encodeAddress(addr: string): string {
  return encodeURIComponent(addr);
}

/** Personalized workshop action-required set — admin sees everyone's, staff sees only their own. */
function workshopActionOrdersFor(orders: Order[], perspective: Perspective): Order[] {
  const base = orders.filter(o => workshopAction(o.status) !== null);
  if (perspective === "admin") return base;
  if (perspective === "workshop-staff") return base.filter(o => o.workshopAssignee === CURRENT_USER);
  return []; // dispatch-staff has no workshop actions
}

/** Personalized dispatch action-required set — same rule as above. */
function dispatchActionOrdersFor(orders: Order[], perspective: Perspective): Order[] {
  const base = orders.filter(o => dispatchAction(o) !== null);
  if (perspective === "admin") return base;
  if (perspective === "dispatch-staff") return base.filter(o => o.dispatchAssignee === CURRENT_USER);
  return []; // workshop-staff has no dispatch actions
}

// ─────────────────────────────────────────────────────────────────────────────
// Atom components
// ─────────────────────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: OrderStatus }) {
  const c = STATUS_CFG[status];
  return (
    <span style={{ display: "inline-block", backgroundColor: c.bg, color: c.fg, padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}

/** Shows how long ago we last attempted to reach the customer (automated or
 * manual) — just the relative count ("2 days ago"), no separate date, since
 * it's how stale the last attempt is that actually drives whether an order
 * needs a follow-up, not a label like "reminder sent". */
function LastContactedCell({ dateStr }: { dateStr: string | null | undefined }) {
  if (!dateStr) return <span style={{ color: "#d1d5db" }}>—</span>;
  const days = daysOverdue(dateStr);
  const agoLabel = days <= 0 ? "Today" : `${days} ${days === 1 ? "day" : "days"} ago`;
  return <span style={{ fontSize: 12, color: "#374151" }}>{agoLabel}</span>;
}

function TypePill({ type }: { type: "Pickup" | "Return" }) {
  const isPickup = type === "Pickup";
  return (
    <span style={{ display: "inline-block", backgroundColor: isPickup ? "#dbeafe" : "#dcfce7", color: isPickup ? "#1e40af" : "#166534", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 500 }}>
      {type}
    </span>
  );
}

function ActionBtn({ label }: { label: string }) {
  return (
    <button
      type="button"
      style={{ backgroundColor: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}
    >
      {label}
    </button>
  );
}

function DueCell({ dateStr }: { dateStr: string | null }) {
  const t = dueTiming(dateStr);
  if (!t || !dateStr) return <span style={{ color: "#d1d5db" }}>—</span>;
  if (t === "overdue") {
    const n = daysOverdue(dateStr);
    return <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 12 }}>{n} {n === 1 ? "day" : "days"} overdue</span>;
  }
  if (t === "today") return <span style={{ color: "#d97706", fontWeight: 600, fontSize: 12 }}>Due today</span>;
  return <span style={{ color: "#9ca3af", fontSize: 12 }}>Due {fmtDate(dateStr)}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-select dropdown (shared by Status + Assigned-to filters)
// ─────────────────────────────────────────────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };

  const buttonText =
    selected.length === 0
      ? label
      : selected.length === 1
        ? options.find(o => o.value === selected[0])?.label ?? label
        : `${selected.length} selected`;

  const S = { border: "1px solid #e0d8cc", borderRadius: 6, padding: "7px 10px", fontSize: 13, backgroundColor: "#fff", color: "#374151", cursor: "pointer", outline: "none" } as const;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{ ...S, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
      >
        {buttonText}
        <ChevronDown size={13} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 60,
            backgroundColor: "#fff",
            border: "1px solid #e0d8cc",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            minWidth: 220,
            maxHeight: 320,
            overflowY: "auto",
            padding: 6,
          }}
        >
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 12, color: "#2563eb", background: "none", border: "none", cursor: "pointer", borderBottom: "1px solid #f0ece5", marginBottom: 4 }}
            >
              Clear selection
            </button>
          )}
          {options.map(o => (
            <label
              key={o.value}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 13, color: "#374151", cursor: "pointer", borderRadius: 4 }}
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                style={{ cursor: "pointer", accentColor: "#3d1700" }}
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter row (shared)
// ─────────────────────────────────────────────────────────────────────────────

type FilterState = {
  search: string;
  statusFilter: OrderStatus[];
  assignedFilter: string[];
};

function FilterRow({
  state,
  onChange,
  statusOptions,
}: {
  state: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  /** null = don't show the status filter at all (tab only ever has one possible status) */
  statusOptions: OrderStatus[] | null;
}) {
  const S = { border: "1px solid #e0d8cc", borderRadius: 6, padding: "7px 10px", fontSize: 13, backgroundColor: "#fff", color: "#374151", cursor: "pointer", outline: "none" } as const;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
      {/* Search */}
      <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", pointerEvents: "none" }} />
        <input
          value={state.search}
          onChange={e => onChange({ search: e.target.value })}
          placeholder="Search by order # or customer…"
          style={{ ...S, width: "100%", paddingLeft: 30, boxSizing: "border-box" }}
        />
      </div>
      {/* Status — only rendered when the tab spans more than one possible status */}
      {statusOptions && statusOptions.length > 1 && (
        <MultiSelect
          label="All statuses"
          options={statusOptions.map(s => ({ value: s, label: STATUS_CFG[s].label }))}
          selected={state.statusFilter}
          onChange={next => onChange({ statusFilter: next as OrderStatus[] })}
        />
      )}
      {/* Assigned — nothing selected = everyone (no filter) */}
      <MultiSelect
        label="All staff"
        options={[
          { value: "DO", label: "DO (you)" },
          { value: "OB", label: "OB" },
        ]}
        selected={state.assignedFilter}
        onChange={next => onChange({ assignedFilter: next })}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workshop table
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ message = "No orders match the current filters." }: { message?: string }) {
  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8, padding: "40px 24px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
      {message}
    </div>
  );
}

const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "11px 14px", verticalAlign: "middle" };

function WorkshopTable({ orders, actionFn = workshopAction, onRowClick }: { orders: Order[]; actionFn?: (s: OrderStatus) => string | null; onRowClick?: (id: string) => void }) {
  if (orders.length === 0) return <EmptyState />;
  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e0d8cc", backgroundColor: "#faf8f5" }}>
            {["Order #", "Status", "Date placed", "Due by", "Action required", "Assigned to"].map(h => (
              <th key={h} style={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const action = actionFn(o.status);
            const borderCol = rowBorderColor(o);
            return (
              <tr
                key={o.id}
                onClick={() => onRowClick?.(o.id)}
                style={{
                  borderBottom: i < orders.length - 1 ? "1px solid #f0ece5" : "none",
                  borderLeft: `3px solid ${borderCol}`,
                  backgroundColor: o.isRework ? "#fffbeb" : "#fff",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
              >
                <td style={TD}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ color: "#2563eb", fontWeight: 500, fontSize: 12 }}>{o.orderNumber}</span>
                    {o.isRework && (
                      <span style={{ backgroundColor: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4 }}>Rework</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{o.customer.name}</div>
                </td>
                <td style={TD}><StatusPill status={o.status} /></td>
                <td style={{ ...TD, color: "#6b7280", fontSize: 12 }}>{fmtDate(o.datePlaced)}</td>
                <td style={TD}><DueCell dateStr={o.actionRequiredBy} /></td>
                <td style={TD} onClick={e => e.stopPropagation()}>
                  {action ? <ActionBtn label={action} /> : <span style={{ color: "#d1d5db" }}>—</span>}
                </td>
                <td style={{ ...TD, color: "#9ca3af", fontSize: 12, fontWeight: 500 }}>{o.workshopAssignee}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workshop view
// ─────────────────────────────────────────────────────────────────────────────

function WorkshopView({ orders, perspective }: { orders: Order[]; perspective: Perspective }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<WorkshopTab>("action-required");

  const defaultAssignee = useMemo(() => (perspective === "admin" ? [] : [CURRENT_USER]), [perspective]);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    statusFilter: [],
    assignedFilter: defaultAssignee,
  });

  // Re-apply the role-based default whenever perspective changes (e.g. via the
  // "Preview as" switcher) so switching perspectives actually demonstrates the
  // rule rather than leaving a stale filter behind.
  useEffect(() => {
    setFilters(f => ({ ...f, assignedFilter: defaultAssignee }));
  }, [defaultAssignee]);

  const handleTabChange = (t: WorkshopTab) => {
    setTab(t);
    setFilters(f => ({ ...f, search: "", statusFilter: [], assignedFilter: defaultAssignee }));
  };

  // Orders scoped to the selected tab
  const tabOrders = useMemo((): Order[] => {
    switch (tab) {
      case "action-required":
        return workshopActionOrdersFor(orders, perspective);
      case "awaiting-repair":
        return orders.filter(o => o.status === "at-the-workshop");
      case "in-repair":
        return orders.filter(o => o.status === "in-repair");
      case "proposals":
        return orders.filter(o => PROPOSAL_STATUSES.includes(o.status));
      case "reworks":
        return orders.filter(o => REWORK_STATUSES.includes(o.status));
      case "completed":
        return orders.filter(o => o.status === "completed");
      case "all-orders":
      default:
        return orders.filter(o => !HIDDEN_FROM_ALL_ORDERS.has(o.status));
    }
  }, [orders, tab, perspective]);

  // Apply search + status + assigned filters, then sort overdue-first
  const displayed = useMemo(() => {
    let r = tabOrders;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      r = r.filter(o => o.orderNumber.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q));
    }
    if (filters.statusFilter.length > 0) r = r.filter(o => filters.statusFilter.includes(o.status));
    if (filters.assignedFilter.length > 0) r = r.filter(o => filters.assignedFilter.includes(o.workshopAssignee));
    return sortByDue(r);
  }, [tabOrders, filters]);

  const actionCount = workshopActionOrdersFor(orders, perspective).length;
  // Badges count only the actionable subset — Proposals/Reworks tabs show
  // every sub-status once opened, but the badge mirrors "how many need my
  // response right now" (same totals-vs-our-turn split as the summary tiles).
  const proposalCount = orders.filter(o => o.status === "proposal-awaiting-our-response").length;
  const reworkCount = orders.filter(o => o.status === "rework-request-pending").length;

  const statusOptionsByTab: Record<WorkshopTab, OrderStatus[] | null> = {
    "action-required": WORKSHOP_ACTION_STATUSES,
    "all-orders": ALL_ORDERS_STATUS_OPTIONS,
    proposals: PROPOSAL_STATUSES,
    "awaiting-repair": null,
    "in-repair": null,
    reworks: REWORK_STATUSES,
    completed: null,
  };

  const tabs: [WorkshopTab, string, number | null, string | null][] = [
    ["action-required", "Action required", actionCount, "#dc2626"],
    ["all-orders",      "All orders",      null,        null],
    ["proposals",       "Proposals",       proposalCount, "#d97706"],
    ["awaiting-repair", "Awaiting repair", null,        null],
    ["in-repair",       "In repair",       null,        null],
    ["reworks",         "Reworks",         reworkCount, "#d97706"],
    ["completed",       "Completed",       null,        null],
  ];

  return (
    <div>
      <TabBar<WorkshopTab> tabs={tabs} active={tab} onSelect={handleTabChange} />
      <FilterRow
        state={filters}
        onChange={patch => setFilters(f => ({ ...f, ...patch }))}
        statusOptions={statusOptionsByTab[tab]}
      />
      <WorkshopTable orders={displayed} onRowClick={id => navigate(`/admin/order/${id}?view=workshop`)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch — action required table
// ─────────────────────────────────────────────────────────────────────────────

function DispatchActionTable({ orders, onRowClick }: { orders: Order[]; onRowClick?: (id: string) => void }) {
  if (orders.length === 0) return <EmptyState />;
  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e0d8cc", backgroundColor: "#faf8f5" }}>
            {["Order #", "Status", "Last contacted", "Phone", "Contact by", "Action"].map(h => (
              <th key={h} style={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const action = dispatchAction(o);
            const borderCol = rowBorderColor(o);
            return (
              <tr
                key={o.id}
                onClick={() => onRowClick?.(o.id)}
                style={{
                  borderBottom: i < orders.length - 1 ? "1px solid #f0ece5" : "none",
                  borderLeft: `3px solid ${borderCol}`,
                  backgroundColor: o.isRework ? "#fffbeb" : "#fff",
                  cursor: "pointer",
                }}
              >
                <td style={TD}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#2563eb", fontWeight: 500, fontSize: 12 }}>{o.orderNumber}</span>
                    {o.isRework && <span style={{ backgroundColor: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 600, padding: "1px 5px", borderRadius: 4 }}>Rework</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{o.customer.name}</div>
                </td>
                <td style={TD}><StatusPill status={o.status} /></td>
                <td style={TD}><LastContactedCell dateStr={o.lastContactedAt} /></td>
                <td style={{ ...TD, color: "#6b7280", fontSize: 12 }}>{o.customer.phone}</td>
                <td style={TD}><DueCell dateStr={o.actionRequiredBy} /></td>
                <td style={TD} onClick={e => e.stopPropagation()}>{action ? <ActionBtn label={action} /> : <span style={{ color: "#d1d5db" }}>—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch — today's schedule table
// ─────────────────────────────────────────────────────────────────────────────

type ScheduleRow = {
  order: Order;
  type: "Pickup" | "Return";
  slot: ScheduleSlot;
};

/** Powers both "Today's schedule" and "Tomorrow's schedule" — same table,
 * just scoped to a different single date, so planning tomorrow's route the
 * night before works exactly like checking today's. */
function ScheduleTable({ orders, date, emptyMessage, onRowClick }: { orders: Order[]; date: string; emptyMessage: string; onRowClick?: (id: string) => void }) {
  const rows: ScheduleRow[] = useMemo(() => {
    const result: ScheduleRow[] = [];
    for (const o of orders) {
      if (o.pickupSlot?.date === date) result.push({ order: o, type: "Pickup", slot: o.pickupSlot });
      if (o.returnSlot?.date === date) result.push({ order: o, type: "Return", slot: o.returnSlot });
    }
    // Sort by time label (works lexicographically for 12-h times when sorted by hour start)
    result.sort((a, b) => a.slot.timeLabel.localeCompare(b.slot.timeLabel));
    return result;
  }, [orders, date]);

  if (rows.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e0d8cc", backgroundColor: "#faf8f5" }}>
            {["Order #", "Type", "Time slot", "Address", "Phone", "Notes"].map(h => (
              <th key={h} style={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ order: o, type, slot }, i) => (
            <tr
              key={`${o.id}-${type}`}
              onClick={() => onRowClick?.(o.id)}
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid #f0ece5" : "none",
                backgroundColor: "#fff",
                cursor: "pointer",
              }}
            >
              <td style={TD}>
                <span style={{ color: "#2563eb", fontWeight: 500, fontSize: 12 }}>{o.orderNumber}</span>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{o.customer.name}</div>
              </td>
              <td style={TD}><TypePill type={type} /></td>
              <td style={{ ...TD, color: "#374151", fontWeight: 500, fontSize: 12 }}>{slot.timeLabel}</td>
              <td style={TD} onClick={e => e.stopPropagation()}>
                <a
                  href={`https://maps.google.com/?q=${encodeAddress(o.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#2563eb", textDecoration: "underline", fontSize: 12 }}
                >
                  {o.address}
                </a>
              </td>
              <td style={{ ...TD, color: "#6b7280", fontSize: 12 }}>{o.customer.phone}</td>
              <td style={{ ...TD, color: "#9ca3af", fontSize: 12, fontStyle: o.notes ? "normal" : "italic" }}>
                {o.notes ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch — all scheduled pickups/returns (today, tomorrow, and beyond)
// ─────────────────────────────────────────────────────────────────────────────

/** Every future scheduled pickup/return, not just today/tomorrow — lets
 * Dispatch see everything on the calendar in one place, sorted soonest first. */
function AllScheduledTable({ orders, onRowClick }: { orders: Order[]; onRowClick?: (id: string) => void }) {
  const rows: ScheduleRow[] = useMemo(() => {
    const result: ScheduleRow[] = [];
    for (const o of orders) {
      if (o.pickupSlot) result.push({ order: o, type: "Pickup", slot: o.pickupSlot });
      if (o.returnSlot) result.push({ order: o, type: "Return", slot: o.returnSlot });
    }
    result.sort((a, b) => {
      if (a.slot.date !== b.slot.date) return a.slot.date.localeCompare(b.slot.date);
      return a.slot.timeLabel.localeCompare(b.slot.timeLabel);
    });
    return result;
  }, [orders]);

  if (rows.length === 0) return <EmptyState message="No pickups or returns currently scheduled." />;

  return (
    <div style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e0d8cc", backgroundColor: "#faf8f5" }}>
            {["Order #", "Type", "Date", "Time slot", "Address", "Phone", "Notes"].map(h => (
              <th key={h} style={TH}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ order: o, type, slot }, i) => (
            <tr
              key={`${o.id}-${type}`}
              onClick={() => onRowClick?.(o.id)}
              style={{
                borderBottom: i < rows.length - 1 ? "1px solid #f0ece5" : "none",
                backgroundColor: "#fff",
                cursor: "pointer",
              }}
            >
              <td style={TD}>
                <span style={{ color: "#2563eb", fontWeight: 500, fontSize: 12 }}>{o.orderNumber}</span>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{o.customer.name}</div>
              </td>
              <td style={TD}><TypePill type={type} /></td>
              <td style={{ ...TD, color: "#6b7280", fontSize: 12 }}>
                {slot.date === TODAY ? "Today" : slot.date === TOMORROW ? "Tomorrow" : fmtDate(slot.date)}
              </td>
              <td style={{ ...TD, color: "#374151", fontWeight: 500, fontSize: 12 }}>{slot.timeLabel}</td>
              <td style={TD}>
                <a
                  href={`https://maps.google.com/?q=${encodeAddress(o.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#2563eb", textDecoration: "underline", fontSize: 12 }}
                >
                  {o.address}
                </a>
              </td>
              <td style={{ ...TD, color: "#6b7280", fontSize: 12 }}>{o.customer.phone}</td>
              <td style={{ ...TD, color: "#9ca3af", fontSize: 12, fontStyle: o.notes ? "normal" : "italic" }}>
                {o.notes ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatch view
// ─────────────────────────────────────────────────────────────────────────────

function DispatchView({ orders, perspective }: { orders: Order[]; perspective: Perspective }) {
  const navigate = useNavigate();
  const goToOrder = (id: string) => navigate(`/admin/order/${id}?view=dispatch`);
  const [tab, setTab] = useState<DispatchTab>("action-required");

  const defaultAssignee = useMemo(() => (perspective === "admin" ? [] : [CURRENT_USER]), [perspective]);

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    statusFilter: [],
    assignedFilter: defaultAssignee,
  });

  useEffect(() => {
    setFilters(f => ({ ...f, assignedFilter: defaultAssignee }));
  }, [defaultAssignee]);

  const handleTabChange = (t: DispatchTab) => {
    setTab(t);
    setFilters(f => ({ ...f, search: "", statusFilter: [], assignedFilter: defaultAssignee }));
  };

  // Orders scoped to dispatch action required: reminder sent and next action pending
  const actionRequiredOrders = useMemo(() => dispatchActionOrdersFor(orders, perspective), [orders, perspective]);

  // All orders for the all-orders sub-tab (dispatch view)
  const allOrdersScoped = useMemo(() => {
    let base = orders.filter(o => !HIDDEN_FROM_ALL_ORDERS.has(o.status));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      base = base.filter(o => o.orderNumber.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q));
    }
    if (filters.statusFilter.length > 0) base = base.filter(o => filters.statusFilter.includes(o.status));
    if (filters.assignedFilter.length > 0) base = base.filter(o => filters.assignedFilter.includes(o.dispatchAssignee));
    return sortByDue(base);
  }, [orders, filters]);

  const filteredActionRequired = useMemo(() => {
    let r = actionRequiredOrders;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      r = r.filter(o => o.orderNumber.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q));
    }
    if (filters.statusFilter.length > 0) r = r.filter(o => filters.statusFilter.includes(o.status));
    if (filters.assignedFilter.length > 0) r = r.filter(o => filters.assignedFilter.includes(o.dispatchAssignee));
    return sortByDue(r);
  }, [actionRequiredOrders, filters]);

  const actionCount = actionRequiredOrders.length;

  const statusOptionsByTab: Record<DispatchTab, OrderStatus[] | null> = {
    "action-required": DISPATCH_ACTION_STATUSES,
    "today-schedule": null,
    "tomorrow-schedule": null,
    "all-scheduled": null,
    "all-orders": ALL_ORDERS_STATUS_OPTIONS,
  };

  // "Escalations" — for Dispatch, the only actions that ever come up are
  // manual follow-ups after both automated reminders have already failed, so
  // this isn't a general "action required" queue the way Workshop's is; it's
  // specifically the escalation queue. Kept consistent with the matching
  // summary-strip tile label (see SummaryStrip).
  //
  // "Today's schedule"/"Tomorrow's schedule" let Danielle plan her route the
  // night before (e.g. sleeping in if tomorrow's first pickup is nearby vs.
  // heading uptown early). "All scheduled" is the full calendar of every
  // upcoming pickup/return beyond just today and tomorrow.
  const tabs: [DispatchTab, string, number | null, string | null][] = [
    ["action-required",     "Escalations",         actionCount, "#dc2626"],
    ["today-schedule",      "Today's schedule",    null,        null],
    ["tomorrow-schedule",   "Tomorrow's schedule", null,        null],
    ["all-scheduled",       "All scheduled",       null,        null],
    ["all-orders",          "All orders",          null,        null],
  ];

  return (
    <div>
      <TabBar<DispatchTab> tabs={tabs} active={tab} onSelect={handleTabChange} />

      {tab === "action-required" && (
        <>
          <FilterRow
            state={filters}
            onChange={patch => setFilters(f => ({ ...f, ...patch }))}
            statusOptions={statusOptionsByTab["action-required"]}
          />
          <DispatchActionTable orders={filteredActionRequired} onRowClick={goToOrder} />
        </>
      )}

      {tab === "today-schedule" && (
        <ScheduleTable orders={orders} date={TODAY} emptyMessage="No pickups or returns scheduled for today." onRowClick={goToOrder} />
      )}

      {tab === "tomorrow-schedule" && (
        <ScheduleTable orders={orders} date={TOMORROW} emptyMessage="No pickups or returns scheduled for tomorrow." onRowClick={goToOrder} />
      )}

      {tab === "all-scheduled" && <AllScheduledTable orders={orders} onRowClick={goToOrder} />}

      {tab === "all-orders" && (
        <>
          <FilterRow
            state={filters}
            onChange={patch => setFilters(f => ({ ...f, ...patch }))}
            statusOptions={statusOptionsByTab["all-orders"]}
          />
          {/* Reuse WorkshopTable with dispatch assignee filtering already applied */}
          <WorkshopTable orders={allOrdersScoped} onRowClick={goToOrder} />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPIs view
// ─────────────────────────────────────────────────────────────────────────────

function KPIsView() {
  return (
    <div style={{ padding: "60px 24px", textAlign: "center" }}>
      <p style={{ fontSize: 22, fontWeight: 600, color: "#3d1700", marginBottom: 10 }}>KPIs — admin only</p>
      <p style={{ fontSize: 14, color: "#9ca3af", maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
        Revenue, fulfillment time, rework rate, and more coming soon.
      </p>
      <p style={{ fontSize: 12, color: "#b5a99a", maxWidth: 420, margin: "16px auto 0", lineHeight: 1.6 }}>
        Note: this covers operational metrics from Cobbli's own order data (revenue, turnaround time, rework rate) — a complement to Google Analytics, not an overlap.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic tab bar  (reused by Workshop + Dispatch)
// ─────────────────────────────────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: [T, string, number | null, string | null][];
  active: T;
  onSelect: (t: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #e0d8cc", marginBottom: 16, overflowX: "auto" }}>
      {tabs.map(([t, label, count, badgeColor]) => (
        <button
          key={t}
          type="button"
          onClick={() => onSelect(t)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: active === t ? 600 : 400,
            color: active === t ? "#3d1700" : "#6b7280",
            background: "none",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            borderBottom: active === t ? "2px solid #3d1700" : "2px solid transparent",
            cursor: "pointer",
            whiteSpace: "nowrap",
            fontFamily: "inherit",
          }}
        >
          {label}
          {count !== null && count > 0 && (
            <span style={{ backgroundColor: badgeColor!, color: "#fff", borderRadius: 9999, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary Strip
// ─────────────────────────────────────────────────────────────────────────────

function SummaryStrip({
  view,
  orders,
  activeActionOrders,
}: {
  view: TopView;
  orders: Order[];
  /** The personalized, currently-active-view action-required set — keeps this
   * tile in sync with whichever tab badge is on screen (Workshop vs Dispatch),
   * instead of a separate global recomputation that could silently drift. */
  activeActionOrders: Order[];
}) {
  const overdue     = activeActionOrders.filter(o => dueTiming(o.actionRequiredBy) === "overdue").length;
  const actionReqd  = activeActionOrders.length;
  const active      = orders.filter(o => !["completed", "returned"].includes(o.status)).length;
  // Both substates combined — overall pipeline volume, not "is this my action".
  const proposals   = orders.filter(o => PROPOSAL_STATUSES.includes(o.status)).length;
  // Excludes denied — a denied rework isn't "open" anymore, just waiting out its auto-close window.
  const reworks     = orders.filter(o => REWORK_OPEN_STATUSES.includes(o.status)).length;

  // Dispatch's actions are always manual follow-ups after both automated
  // reminders already failed, so its tile is labeled "Escalations" — matching
  // the Dispatch tab of the same name. Dispatch also doesn't show Proposals
  // pending / Reworks pending — those are Workshop-side concepts (Danielle's
  // call: dispatch just needs Overdue tasks, Escalations, and Open orders).
  const isDispatch = view === "dispatch";

  const cards = isDispatch
    ? [
        { label: "Overdue tasks", value: overdue,    sub: "need attention now", valueColor: "#dc2626" },
        { label: "Escalations",   value: actionReqd, sub: "manual follow-ups needed", valueColor: "#d97706" },
        { label: "Open orders",   value: active,     sub: "in progress",       valueColor: "#3d1700" },
      ]
    : [
        { label: "Overdue tasks",      value: overdue,    sub: "need attention now",        valueColor: "#dc2626" },
        { label: "Action required",    value: actionReqd, sub: "pending actions",           valueColor: "#d97706" },
        { label: "Open orders",        value: active,     sub: "in progress",               valueColor: "#3d1700" },
        { label: "Proposals pending",  value: proposals,  sub: "awaiting our or their response", valueColor: "#d97706" },
        { label: "Reworks pending",    value: reworks,    sub: "pending or awaiting scheduling", valueColor: "#dc2626" },
      ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cards.length}, 1fr)`, gap: 12, marginBottom: 20 }}>
      {cards.map(c => (
        <div key={c.label} style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8, padding: "14px 16px" }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9ca3af", margin: 0, marginBottom: 4 }}>{c.label}</p>
          <p style={{ fontSize: 30, fontWeight: 700, color: c.valueColor, lineHeight: 1, margin: 0 }}>{c.value}</p>
          <p style={{ fontSize: 11, color: "#b5a99a", margin: 0, marginTop: 4 }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview-as switcher (dummy-data phase only — see file header note)
// ─────────────────────────────────────────────────────────────────────────────

function PreviewAsSwitcher({ value, onChange }: { value: Perspective; onChange: (p: Perspective) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 6,
          fontSize: 12, fontWeight: 500, border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", cursor: "pointer",
        }}
      >
        Preview as: {PERSPECTIVE_LABEL[value]}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 60,
          backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.16)", minWidth: 240, padding: 6,
        }}>
          {(Object.keys(PERSPECTIVE_LABEL) as Perspective[]).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { onChange(p); setOpen(false); }}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 4,
                fontSize: 13, color: p === value ? "#3d1700" : "#374151", fontWeight: p === value ? 600 : 400,
                background: p === value ? "#fdf3e0" : "none", border: "none", cursor: "pointer",
              }}
            >
              {PERSPECTIVE_LABEL[p]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [perspective, setPerspective] = useState<Perspective>("admin");
  const [view, setView] = useState<TopView>("workshop");

  const visibleTopTabs: [TopView, string][] = useMemo(() => {
    if (perspective === "workshop-staff") return [["workshop", "Workshop"]];
    if (perspective === "dispatch-staff") return [["dispatch", "Dispatch"]];
    return [["workshop", "Workshop"], ["dispatch", "Dispatch"], ["kpis", "KPIs"]];
  }, [perspective]);

  // Land on (and snap back to) whichever tab the current perspective is
  // actually allowed to see — mirrors the real staff_team-driven behavior
  // described in Section 9 ("hide the tab, don't just disable it").
  useEffect(() => {
    const allowed = visibleTopTabs.map(([v]) => v);
    if (!allowed.includes(view)) setView(allowed[0]);
  }, [visibleTopTabs, view]);

  const workshopActionOrders = useMemo(() => workshopActionOrdersFor(ORDERS, perspective), [perspective]);
  const dispatchActionOrders = useMemo(() => dispatchActionOrdersFor(ORDERS, perspective), [perspective]);
  const activeActionOrders = view === "dispatch" ? dispatchActionOrders : workshopActionOrders;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9f7f4", fontFamily: "'Public Sans', 'Albert Sans', sans-serif" }}>
      {/* ── Top bar ── */}
      <header style={{
        backgroundColor: "#3d1700",
        padding: "0 24px",
        height: 54,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 50,
        gap: 12,
      }}>
        {/* Logo */}
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: "-0.3px" }}>Cobbli</span>

        {/* Tab toggle — only shows tabs the current perspective's team grants */}
        <div style={{ display: "flex", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 8, padding: 3, gap: 2 }}>
          {visibleTopTabs.map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={{
                padding: "5px 16px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                backgroundColor: view === v ? "#fdb600" : "transparent",
                color: view === v ? "#3d1700" : "rgba(255,255,255,0.82)",
                transition: "background 0.15s, color 0.15s",
                fontFamily: "inherit",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <PreviewAsSwitcher value={perspective} onChange={setPerspective} />
          {/* Avatar */}
          <div style={{ width: 34, height: 34, borderRadius: "50%", backgroundColor: "#fdb600", color: "#3d1700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, letterSpacing: "0.5px", flexShrink: 0 }}>
            {CURRENT_USER}
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 20px" }}>
        <SummaryStrip view={view} orders={ORDERS} activeActionOrders={activeActionOrders} />

        {/* View panel */}
        <div style={{ backgroundColor: "#fff", border: "1px solid #e0d8cc", borderRadius: 8, padding: "20px 20px 24px" }}>
          {view === "workshop" && <WorkshopView orders={ORDERS} perspective={perspective} />}
          {view === "dispatch" && <DispatchView orders={ORDERS} perspective={perspective} />}
          {view === "kpis"     && <KPIsView />}
        </div>
      </main>
    </div>
  );
}
