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

/** The six required photo angles for both Intake ("before") and Outtake
 * ("after"). Danielle's call: unlike the rest of the form (condition
 * assessment, notes), these are a hard requirement, not optional — they're
 * what protects Cobbli against a customer claiming damage that was already
 * there at intake, or claiming a service wasn't actually done. Long-term,
 * the plan is for the condition assessment to eventually go away once the
 * AI model is trained, but this photo requirement stays permanently. */
export type RequiredPhotoAngle = "sole" | "topDown" | "leftSide" | "rightSide" | "back" | "inside";

/** An actual captured photo — a real file, previewable in the browser via an
 * object URL (client-side only; nothing uploads to a server yet, consistent
 * with the rest of this page's dummy-data/local-state approach). */
export type CapturedPhoto = {
  id: string;
  previewUrl: string;
  fileName: string;
};

/** One photo per required angle — undefined/absent means not yet captured —
 * plus an uncapped list of extra close-ups for anything the six standard
 * angles don't capture well (a specific scuff, a cracked buckle, etc.). */
export type PhotoSet = {
  angles: Partial<Record<RequiredPhotoAngle, CapturedPhoto>>;
  damageCloseUps: CapturedPhoto[];
};

type PhotoGroup = {
  /** Whatever the customer attached at checkout — unstructured, and not
   * subject to the six-angle requirement, since that's a staff-taken
   * standard we can't ask a customer to follow at drop-off. */
  customerSubmitted: number;
  before: PhotoSet;
  after: PhotoSet;
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
export type ShoePair = {
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
  /** Per-component condition answers from the Intake form, keyed by
   * ConditionComponentDef.key — e.g. { sole: ["worn-through"], surface:
   * ["scuffs", "stains"] }. Optional/undefined until intake is actually
   * started; local-state only for now (dummy data). */
  conditionAssessment?: Record<string, string[]>;
  /** Free-text notes from the Intake form — separate from customerNotes
   * (what the customer wrote at checkout) and from order-level notes. */
  intakeNotes?: string;
  /** Free-text notes from the Outtake form. */
  outtakeNotes?: string;
};

/** One answer option within a condition component — "Good"/"Not applicable"
 * map to no service (nothing wrong); every other option maps to exactly one
 * catalog service (see CONDITION_COMPONENTS below for why some real
 * services are deliberately unreachable from this list). */
type ConditionOption = {
  value: string;
  label: string;
  service?: string;
};

type ConditionComponentDef = {
  key: string;
  /** Used in the on-screen question: "What is the condition of the {label}?" */
  label: string;
  /** Whether more than one non-exclusive answer can be true at once (e.g.
   * Surface: scuffs AND stains can both be present). Single-select
   * components have fully mutually-exclusive options, Good/Not-applicable
   * included — picking one clears any other. */
  multi: boolean;
  /** Values that behave as an all-or-nothing reset in a multi-select
   * component (Good / Not applicable) — selecting one clears every other
   * answer in the group, and selecting anything else clears it. Unused for
   * single-select components, where every option is already exclusive. */
  exclusiveValues: string[];
  options: ConditionOption[];
};

export type OrderDetail = {
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

/** The six required photo angles, in the order they're shown in the Intake
 * and Outtake forms. Chosen to cover every condition-assessment component
 * with no gaps and minimal overlap:
 *  - Sole: covers Sole, and usually Heel/Heel tip (both visible from underneath).
 *  - Top-down: covers Surface, Color, Material, and Hardware on the vamp.
 *  - Left/right side: covers Strap, Buckle, Zipper, side stitching, and a
 *    second angle on Heel (often easier to judge from the side).
 *  - Back: the best angle for a cracked or separating heel.
 *  - Inside: the only angle that covers Insole and Inner lining at all.
 * "Damage close-ups" (see PhotoSet) is open-ended and uncapped — Danielle's
 * call, for anything localized the six standard angles don't capture well. */
export const REQUIRED_PHOTO_ANGLES: { key: RequiredPhotoAngle; label: string }[] = [
  { key: "sole",      label: "Sole (bottom, straight-on)" },
  { key: "topDown",   label: "Top-down" },
  { key: "leftSide",  label: "Left side" },
  { key: "rightSide", label: "Right side" },
  { key: "back",      label: "Back of shoe" },
  { key: "inside",    label: "Inside of shoe" },
];

function emptyPhotoSet(): PhotoSet {
  return { angles: {}, damageCloseUps: [] };
}

/** Total photo count for display — six required angles (however many are
 * filled) plus however many extra damage close-ups have been added. */
function photoSetCount(p: PhotoSet): number {
  return Object.values(p.angles).filter(Boolean).length + p.damageCloseUps.length;
}

/** All six required angles filled — the gate for completing Intake/Outtake.
 * Checked explicitly against REQUIRED_PHOTO_ANGLES (not just Object.values)
 * since angles is a partial record — an empty object would otherwise pass
 * an Object.values(...).every(...) check vacuously. Damage close-ups don't
 * factor in since they're uncapped/optional. */
export function photoSetComplete(p: PhotoSet): boolean {
  return REQUIRED_PHOTO_ANGLES.every(a => !!p.angles[a.key]);
}

/** A simple, offline SVG placeholder used for dummy-data photos that were
 * already "captured" before this page had a real upload UI — clearly a
 * placeholder (not a real photo), avoiding any false impression this is
 * production photo data. Real uploads (see PhotoAngleTile) use an actual
 * object URL from the picked file instead of this. */
function placeholderPhoto(label: string): CapturedPhoto {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#e0d8cc"/><text x="50%" y="50%" font-family="sans-serif" font-size="16" fill="#3d1700" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
  return {
    id: `placeholder-${label}-${Math.random().toString(36).slice(2)}`,
    previewUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    fileName: `${label}.svg`,
  };
}

/** All six required angles pre-filled with placeholders — shorthand for
 * dummy-data pairs whose intake/outtake is already "complete" and therefore
 * must have every required angle present. */
function allAnglesPlaceholder(): Partial<Record<RequiredPhotoAngle, CapturedPhoto>> {
  const result: Partial<Record<RequiredPhotoAngle, CapturedPhoto>> = {};
  for (const a of REQUIRED_PHOTO_ANGLES) result[a.key] = placeholderPhoto(a.label);
  return result;
}

/**
 * The per-component condition assessment that drives the Intake form.
 * Danielle's design, checked against the real 20-service catalog and then
 * revised per her follow-up:
 *  - Every component always includes a "Good" (or "Not applicable" for
 *    parts that don't exist on every shoe) baseline, so a blank answer
 *    never means "nobody looked" — it's always an explicit, positive answer.
 *  - Deliberately excludes two purely preventative services — Protective
 *    Soles and Waterproofing — from ever being auto-suggested here.
 *    Danielle's call: those are opt-in add-ons a customer asks for when they
 *    want them, and recommending them off a condition scan reads as
 *    upselling, which risks trust rather than building it. (Contrast with
 *    Deodorizing/Stretching/Dye, excluded for a different reason — no
 *    visual signal at all, not a trust concern.)
 *  - No dedicated "worn down but still attached" heel state — Danielle's
 *    call: mild sole-area wear is already captured by Sole's own options,
 *    and anything serious enough to need its own heel condition is already
 *    covered by Loose/Separated/Missing/Cracked below.
 *  - "Strap replacement" doesn't exist as a bookable service yet — Danielle
 *    expects it will in the future, so it's mapped here anyway; until the
 *    service actually exists this condition only tags photos for AI
 *    training and doesn't correspond to a real line item.
 */
const CONDITION_COMPONENTS: ConditionComponentDef[] = [
  {
    key: "sole", label: "sole", multi: false, exclusiveValues: ["good"],
    options: [
      { value: "good", label: "Good" },
      { value: "worn-through", label: "Worn through (hole present)", service: "Resole" },
      { value: "separated", label: "Separated or detached from upper", service: "Resole" },
    ],
  },
  {
    key: "heel", label: "heel", multi: false, exclusiveValues: ["good"],
    options: [
      { value: "good", label: "Good" },
      { value: "loose", label: "Loose (not yet detached)", service: "Heel repair" },
      { value: "separated", label: "Separated (detached but present)", service: "Heel replacement" },
      { value: "missing", label: "Missing entirely", service: "Heel replacement" },
      { value: "cracked", label: "Cracked or broken through the body", service: "Heel replacement" },
    ],
  },
  {
    key: "heel-tip", label: "heel tip", multi: false, exclusiveValues: ["not-applicable", "good"],
    options: [
      { value: "not-applicable", label: "Not applicable" },
      { value: "good", label: "Good" },
      { value: "worn-down", label: "Worn down", service: "High heel tip repair" },
      { value: "missing", label: "Missing", service: "High heel tip repair" },
    ],
  },
  {
    key: "insole", label: "insole", multi: false, exclusiveValues: ["good"],
    options: [
      { value: "good", label: "Good" },
      { value: "worn-down", label: "Worn down", service: "Insole replacement" },
      { value: "separating", label: "Separating", service: "Insole replacement" },
    ],
  },
  {
    key: "inner-lining", label: "inner lining", multi: false, exclusiveValues: ["good"],
    options: [
      { value: "good", label: "Good" },
      { value: "scratches-holes", label: "Contains scratches or holes", service: "Lining repair" },
    ],
  },
  {
    key: "stitching", label: "stitching", multi: false, exclusiveValues: ["good"],
    options: [
      { value: "good", label: "Good" },
      { value: "seam-separated", label: "Seam separated (opened, thread intact)", service: "Seam repair" },
      { value: "thread-broken", label: "Thread broken or frayed", service: "Seam repair" },
    ],
  },
  {
    key: "surface", label: "surface", multi: true, exclusiveValues: ["good"],
    options: [
      { value: "good", label: "Good" },
      { value: "dull", label: "Dull, no damage", service: "Shoe shine" },
      { value: "scuffs", label: "Scuffs present", service: "Scuff, stain, & color restoration" },
      { value: "scratches", label: "Scratches present", service: "Scuff, stain, & color restoration" },
      { value: "stains", label: "Stains present", service: "Scuff, stain, & color restoration" },
    ],
  },
  {
    key: "color", label: "color", multi: true, exclusiveValues: ["good"],
    options: [
      { value: "good", label: "Good" },
      { value: "faded", label: "Faded or streaky", service: "Scuff, stain, & color restoration" },
      { value: "discolored", label: "Discolored", service: "Scuff, stain, & color restoration" },
    ],
  },
  {
    key: "material", label: "material", multi: true, exclusiveValues: ["good"],
    options: [
      { value: "good", label: "Good" },
      { value: "dry-cracking", label: "Dry or cracking", service: "Cleaning & conditioning" },
      { value: "dull-dirty", label: "Dull or dirty (needs conditioning)", service: "Cleaning & conditioning" },
    ],
  },
  {
    key: "strap", label: "strap", multi: false, exclusiveValues: ["not-applicable", "good"],
    options: [
      { value: "not-applicable", label: "Not applicable" },
      { value: "good", label: "Good" },
      { value: "separating", label: "Separating from shoe", service: "Strap repair" },
      { value: "torn-damaged", label: "Torn or otherwise damaged", service: "Strap replacement" },
    ],
  },
  {
    key: "hardware", label: "hardware", multi: false, exclusiveValues: ["not-applicable", "good"],
    options: [
      { value: "not-applicable", label: "Not applicable" },
      { value: "good", label: "Good" },
      { value: "loose", label: "Loose or detached", service: "Hardware or buckle repair" },
      { value: "broken", label: "Broken or damaged", service: "Hardware or buckle replacement" },
      { value: "missing", label: "Missing", service: "Hardware or buckle replacement" },
    ],
  },
  {
    key: "buckle", label: "buckle", multi: false, exclusiveValues: ["not-applicable", "good"],
    options: [
      { value: "not-applicable", label: "Not applicable" },
      { value: "good", label: "Good" },
      { value: "loose", label: "Loose or detached", service: "Hardware or buckle repair" },
      { value: "broken", label: "Broken or damaged", service: "Hardware or buckle replacement" },
      { value: "missing", label: "Missing", service: "Hardware or buckle replacement" },
    ],
  },
  {
    key: "zipper", label: "zipper", multi: true, exclusiveValues: ["not-applicable", "good"],
    options: [
      { value: "not-applicable", label: "Not applicable" },
      { value: "good", label: "Good" },
      { value: "track-damaged", label: "Track or teeth detached/damaged", service: "Zipper repair" },
      { value: "slider-broken", label: "Slider broken or missing", service: "Zipper slider repair" },
    ],
  },
];

/** Every component must have at least one selected answer — Danielle's call:
 * for now, while the whole point of this form is maximizing AI training
 * data, nothing in the condition assessment is optional to *complete*
 * intake with (only "Save & finish later" allows partial answers). This is
 * a temporary, current-phase policy — see the requirements doc note on this
 * form being deliberately more thorough than its long-term shape. */
function allConditionsAnswered(answers: Record<string, string[]>): boolean {
  return CONDITION_COMPONENTS.every(c => (answers[c.key]?.length ?? 0) > 0);
}

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

export const ORDER_DETAILS: Record<string, OrderDetail> = {
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
        // Intake complete → all 6 required "before" angles filled. Completion
        // in-progress → outtake photos partly captured so far (2 of 6).
        photos: {
          customerSubmitted: 2,
          before: { angles: allAnglesPlaceholder(), damageCloseUps: [] },
          after:  { angles: { sole: placeholderPhoto("Sole"), topDown: placeholderPhoto("Top-down") }, damageCloseUps: [] },
        },
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
        // Intake not started → no required photos taken yet.
        photos: {
          customerSubmitted: 1,
          before: emptyPhotoSet(),
          after: emptyPhotoSet(),
        },
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
        // Intake complete → all 6 required "before" angles filled. Completion
        // not started → no "after" photos yet.
        photos: {
          customerSubmitted: 3,
          before: { angles: allAnglesPlaceholder(), damageCloseUps: [placeholderPhoto("Damage close-up")] },
          after: emptyPhotoSet(),
        },
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
        // Both intake and completion are complete → all 6 required angles
        // filled for both before and after.
        photos: {
          customerSubmitted: 2,
          before: { angles: allAnglesPlaceholder(), damageCloseUps: [] },
          after:  { angles: allAnglesPlaceholder(), damageCloseUps: [] },
        },
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
        // Both intake and completion are complete → all 6 required angles
        // filled for both before and after.
        photos: {
          customerSubmitted: 2,
          before: { angles: allAnglesPlaceholder(), damageCloseUps: [] },
          after:  { angles: allAnglesPlaceholder(), damageCloseUps: [] },
        },
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
        // Intake not started → no required photos taken yet.
        photos: {
          customerSubmitted: 4,
          before: emptyPhotoSet(),
          after: emptyPhotoSet(),
        },
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
  // Orders 3, 4, 6, 7, 8, 11–14 below: these exist in AdminDashboard's dummy
  // ORDERS list (so they show up in real dashboard tables/tabs, including
  // Dispatch's pickup/return schedule tabs) but previously had no matching
  // entry here — clicking into any of them fell through to buildFallback(),
  // which returns pairs: []. That's what caused the Dispatch "Repair
  // summary" sidebar to say "No shoe pairs recorded yet" for an order with a
  // pickup already scheduled — Danielle's bug report: a real order should
  // never have zero pairs, regardless of status. Filled in with lightweight
  // but real pair/service data (matching each order's dashboard context) so
  // Dispatch always has enough to answer a basic "what am I picking up /
  // what's being done to it" question, without needing full Workshop-level
  // detail (photos, condition assessment) on orders that aren't this
  // session's main demo (ORD-2026-001).
  "3": {
    id: "3",
    orderNumber: "ORD-2026-003",
    status: "pickup-scheduled",
    datePlaced: "2026-07-06",
    isRework: false,
    actionRequiredBy: null,
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    customer: {
      name: "Priya Nair",
      phone: "(917) 555-0303",
      email: "priya.nair@email.com",
    },
    address: "45 W 72nd St, New York, NY 10023",
    lastContactedAt: "2026-07-06",
    pickupSlot: { date: "2026-07-08", timeLabel: "10:00 – 11:30 AM" },
    pairs: [
      {
        id: "3-p1",
        shoeType: "Sneakers",
        shoeBrand: "Common Projects",
        shoeColorMaterial: "White leather",
        customerNotes: "Please be gentle with the suede panel on the side.",
        // Pickup hasn't happened yet — nothing captured on either side.
        photos: {
          customerSubmitted: 2,
          before: emptyPhotoSet(),
          after: emptyPhotoSet(),
        },
        services: [
          { id: "3-p1-s1", name: "Scuff, stain, & color restoration", priceCents: 8000, tag: "original", done: false },
          { id: "3-p1-s2", name: "Cleaning & conditioning",           priceCents: 6500, tag: "original", done: false },
        ],
        intakeStatus: "not-started",
        completionStatus: "not-started",
      },
    ],
    comments: [],
    notes: "Ring buzzer 3B — concierge can accept",
  },
  "4": {
    id: "4",
    orderNumber: "ORD-2026-004",
    status: "ready-for-return",
    datePlaced: "2026-07-02",
    isRework: false,
    actionRequiredBy: "2026-07-08",
    workshopAssignee: "OB",
    dispatchAssignee: "DO",
    customer: {
      name: "James O'Sullivan",
      phone: "(212) 555-0404",
      email: "james.osullivan@email.com",
    },
    address: "89 Bleecker St, New York, NY 10012",
    lastContactedAt: "2026-07-06",
    pickupSlot: { date: "2026-07-03", timeLabel: "9:00 – 10:30 AM" },
    pairs: [
      {
        id: "4-p1",
        shoeType: "Chukka boots",
        shoeBrand: "Red Wing",
        shoeColorMaterial: "Brown leather",
        // Repair fully done, awaiting return scheduling → intake and
        // outtake both complete, all required photos on file.
        photos: {
          customerSubmitted: 2,
          before: { angles: allAnglesPlaceholder(), damageCloseUps: [] },
          after:  { angles: allAnglesPlaceholder(), damageCloseUps: [] },
        },
        services: [
          { id: "4-p1-s1", name: "Resole",           priceCents: 8500, tag: "original", done: true },
          { id: "4-p1-s2", name: "Heel replacement", priceCents: 5500, tag: "original", done: true },
        ],
        intakeStatus: "complete",
        completionStatus: "complete",
      },
    ],
    comments: [],
  },
  "6": {
    id: "6",
    orderNumber: "ORD-2026-006",
    status: "rework-request-denied",
    datePlaced: "2026-06-10",
    isRework: true,
    actionRequiredBy: null,
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    customer: {
      name: "Luca Romano",
      phone: "(718) 555-0606",
      email: "luca.romano@email.com",
    },
    address: "55 Water St, Brooklyn, NY 11201",
    pickupSlot: { date: "2026-06-10", timeLabel: "1:00 – 2:30 PM" },
    returnSlot: { date: "2026-06-17", timeLabel: "3:00 – 4:30 PM" },
    pairs: [
      {
        id: "6-p1",
        shoeType: "Loafers",
        shoeBrand: "Ferragamo",
        shoeColorMaterial: "Black leather",
        photos: {
          customerSubmitted: 1,
          before: { angles: allAnglesPlaceholder(), damageCloseUps: [] },
          after:  { angles: allAnglesPlaceholder(), damageCloseUps: [] },
        },
        services: [
          { id: "6-p1-s1", name: "Cleaning & conditioning", priceCents: 6500, tag: "original", done: true },
        ],
        intakeStatus: "complete",
        completionStatus: "complete",
      },
    ],
    comments: [],
    notes: "Dispute escalated to owner — see Slack thread",
  },
  "7": {
    id: "7",
    orderNumber: "ORD-2026-007",
    status: "return-scheduled",
    datePlaced: "2026-06-18",
    isRework: false,
    actionRequiredBy: null,
    workshopAssignee: "OB",
    dispatchAssignee: "DO",
    customer: {
      name: "Ava Thompson",
      phone: "(212) 555-0707",
      email: "ava.thompson@email.com",
    },
    address: "1 Central Park W, New York, NY 10023",
    lastContactedAt: "2026-07-05",
    pickupSlot: { date: "2026-06-19", timeLabel: "11:00 AM – 12:30 PM" },
    returnSlot: { date: "2026-07-08", timeLabel: "2:00 – 3:30 PM" },
    pairs: [
      {
        id: "7-p1",
        shoeType: "Pumps",
        shoeBrand: "Jimmy Choo",
        shoeColorMaterial: "Nude patent leather",
        photos: {
          customerSubmitted: 1,
          before: { angles: allAnglesPlaceholder(), damageCloseUps: [] },
          after:  { angles: allAnglesPlaceholder(), damageCloseUps: [] },
        },
        services: [
          { id: "7-p1-s1", name: "High heel tip repair", priceCents: 3500, tag: "original", done: true },
        ],
        intakeStatus: "complete",
        completionStatus: "complete",
      },
    ],
    comments: [],
    notes: "Leave with doorman if customer unavailable",
  },
  "8": {
    id: "8",
    orderNumber: "ORD-2026-008",
    status: "completed",
    datePlaced: "2026-06-01",
    isRework: false,
    actionRequiredBy: null,
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    customer: {
      name: "Derek Huang",
      phone: "(917) 555-0808",
      email: "derek.huang@email.com",
    },
    address: "200 Varick St, New York, NY 10014",
    pickupSlot: { date: "2026-06-02", timeLabel: "10:00 – 11:30 AM" },
    returnSlot: { date: "2026-06-10", timeLabel: "1:00 – 2:30 PM" },
    pairs: [
      {
        id: "8-p1",
        shoeType: "Derby shoes",
        shoeBrand: "Allen Edmonds",
        shoeColorMaterial: "Oxblood leather",
        photos: {
          customerSubmitted: 2,
          before: { angles: allAnglesPlaceholder(), damageCloseUps: [] },
          after:  { angles: allAnglesPlaceholder(), damageCloseUps: [] },
        },
        services: [
          { id: "8-p1-s1", name: "Resole", priceCents: 8500, tag: "original", done: true },
        ],
        intakeStatus: "complete",
        completionStatus: "complete",
      },
    ],
    comments: [],
  },
  // 11 and 12 are Proposals (awaiting customer response) — no logistics yet,
  // and the services below are *proposed*, not yet approved or performed, so
  // nothing is checked off and intake/outtake haven't started. These will
  // move to the (not-yet-built) Proposal details page once that's built —
  // for now they at least stop showing up empty if clicked into.
  "11": {
    id: "11",
    orderNumber: "ORD-2026-011",
    status: "proposal-awaiting-customer-response",
    datePlaced: "2026-07-04",
    isRework: false,
    actionRequiredBy: null,
    workshopAssignee: "DO",
    dispatchAssignee: "OB",
    customer: {
      name: "Bianca Rossi",
      phone: "(347) 555-1111",
      email: "bianca.rossi@email.com",
    },
    address: "14 Wall St, New York, NY 10005",
    pairs: [
      {
        id: "11-p1",
        shoeType: "Sandals",
        shoeBrand: "Birkenstock",
        shoeColorMaterial: "Tan suede",
        photos: {
          customerSubmitted: 2,
          before: emptyPhotoSet(),
          after: emptyPhotoSet(),
        },
        services: [
          { id: "11-p1-s1", name: "Strap repair", priceCents: 4500, tag: "original", done: false },
        ],
        intakeStatus: "not-started",
        completionStatus: "not-started",
      },
    ],
    comments: [],
  },
  "12": {
    id: "12",
    orderNumber: "ORD-2026-012",
    status: "proposal-awaiting-customer-response",
    datePlaced: "2026-07-03",
    isRework: false,
    actionRequiredBy: null,
    workshopAssignee: "OB",
    dispatchAssignee: "DO",
    customer: {
      name: "Tomás Vega",
      phone: "(646) 555-1212",
      email: "tomas.vega@email.com",
    },
    address: "500 W 23rd St, New York, NY 10011",
    pairs: [
      {
        id: "12-p1",
        shoeType: "Sneakers",
        shoeBrand: "Golden Goose",
        shoeColorMaterial: "White / silver leather",
        photos: {
          customerSubmitted: 3,
          before: emptyPhotoSet(),
          after: emptyPhotoSet(),
        },
        services: [
          { id: "12-p1-s1", name: "Scuff, stain, & color restoration", priceCents: 8000, tag: "original", done: false },
        ],
        intakeStatus: "not-started",
        completionStatus: "not-started",
      },
    ],
    comments: [],
  },
  "13": {
    id: "13",
    orderNumber: "ORD-2026-013",
    status: "pickup-scheduled",
    datePlaced: "2026-07-08",
    isRework: false,
    actionRequiredBy: null,
    workshopAssignee: "DO",
    dispatchAssignee: "DO",
    customer: {
      name: "Wendy Alvarez",
      phone: "(212) 555-1313",
      email: "wendy.alvarez@email.com",
    },
    address: "350 5th Ave, New York, NY 10118",
    lastContactedAt: "2026-07-08",
    pickupSlot: { date: "2026-07-09", timeLabel: "9:00 – 10:30 AM" },
    pairs: [
      {
        id: "13-p1",
        shoeType: "Oxfords",
        shoeBrand: "To Boot New York",
        shoeColorMaterial: "Burgundy leather",
        // Pickup is tomorrow — nothing captured yet.
        photos: {
          customerSubmitted: 2,
          before: emptyPhotoSet(),
          after: emptyPhotoSet(),
        },
        services: [
          { id: "13-p1-s1", name: "Resole",              priceCents: 8500, tag: "original", done: false },
          { id: "13-p1-s2", name: "High heel tip repair", priceCents: 3500, tag: "original", done: false },
        ],
        intakeStatus: "not-started",
        completionStatus: "not-started",
      },
    ],
    comments: [],
    notes: "Front desk will hold shoes at reception",
  },
  "14": {
    id: "14",
    orderNumber: "ORD-2026-014",
    status: "return-scheduled",
    datePlaced: "2026-06-28",
    isRework: false,
    actionRequiredBy: null,
    workshopAssignee: "OB",
    dispatchAssignee: "OB",
    customer: {
      name: "Felix Ono",
      phone: "(646) 555-1414",
      email: "felix.ono@email.com",
    },
    address: "20 W 34th St, New York, NY 10001",
    lastContactedAt: "2026-07-07",
    pickupSlot: { date: "2026-06-29", timeLabel: "10:00 – 11:30 AM" },
    returnSlot: { date: "2026-07-11", timeLabel: "1:00 – 2:30 PM" },
    pairs: [
      {
        id: "14-p1",
        shoeType: "Derby shoes",
        shoeBrand: "Allen Edmonds",
        shoeColorMaterial: "Black leather",
        photos: {
          customerSubmitted: 1,
          before: { angles: allAnglesPlaceholder(), damageCloseUps: [] },
          after:  { angles: allAnglesPlaceholder(), damageCloseUps: [] },
        },
        services: [
          { id: "14-p1-s1", name: "Cleaning & conditioning", priceCents: 6500, tag: "original", done: true },
          { id: "14-p1-s2", name: "Waterproofing",           priceCents: 3000, tag: "original", done: true },
        ],
        intakeStatus: "complete",
        completionStatus: "complete",
      },
    ],
    comments: [],
    notes: "Building requires photo ID at security desk",
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
  onClick,
}: {
  label: string;
  status: FormStatus;
  disabled: boolean;
  /** Reopens the form (Intake so far) for review or to keep filling it in —
   * omitted for forms that don't have a UI to open yet (Outtake). */
  onClick?: () => void;
}) {
  const statusText = status === "not-started" ? "Not started" : status === "in-progress" ? "In progress" : "Complete";
  const iconColor = status === "complete" ? "#166534" : disabled ? "#d1d5db" : status === "in-progress" ? "#92400e" : "#9ca3af";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
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

/** One condition component's options, rendered as a row of toggle pills
 * under a plain section header (just the component name — "Sole," "Heel,"
 * etc.) rather than repeating the full "What is the condition of the...?"
 * question for every single component. That question is asked once, as the
 * section intro above the whole group (see IntakeFormModal) — Danielle's
 * call, to make a 13-component form easier to scan. Single-select components
 * behave like radio buttons (including Good/Not-applicable); multi-select
 * components allow combining non-exclusive answers, with Good/Not-applicable
 * still acting as an all-or-nothing reset — see toggleCondition in PairCard
 * for the logic. */
function ConditionGroup({
  comp,
  selected,
  onToggle,
}: {
  comp: ConditionComponentDef;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const heading = comp.label.charAt(0).toUpperCase() + comp.label.slice(1);
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 600, color: "#374151" }}>
        {heading}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {comp.options.map(opt => {
          const isSelected = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              style={{
                padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500,
                border: isSelected ? "1px solid #3d1700" : "1px solid #e0d8cc",
                backgroundColor: isSelected ? "#3d1700" : "#fff",
                color: isSelected ? "#fff" : "#374151",
                cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** One required-angle tile — a real file upload (not just a "mark as done"
 * toggle, per Danielle's feedback: staff should actually attach a photo they
 * can preview, not just tick a checkbox). Tapping an empty tile opens the
 * device's file/camera picker; once a photo's attached, the tile shows an
 * actual thumbnail preview with a remove ("×") button to clear and retake. */
function PhotoAngleTile({
  label,
  photo,
  onUpload,
  onRemove,
}: {
  label: string;
  photo: CapturedPhoto | undefined;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ width: 96 }}>
      <div style={{ position: "relative", width: 96, height: 80 }}>
        <label
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 96, height: 80, borderRadius: 8, cursor: "pointer", overflow: "hidden",
            border: photo ? "1px solid #166534" : "1px dashed #d1d5db",
            backgroundColor: photo ? "#f0fdf4" : "#fafafa",
          }}
        >
          {photo
            ? <img src={photo.previewUrl} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Camera size={20} style={{ color: "#9ca3af" }} />}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = ""; // allow re-selecting the same file to retake
            }}
          />
        </label>
        {photo && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove photo"
            style={{
              position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%",
              backgroundColor: "#fff", border: "1px solid #e0d8cc", color: "#991b1b", fontSize: 12, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 10, fontWeight: 500, color: photo ? "#166534" : "#6b7280", textAlign: "center", lineHeight: 1.2 }}>
        {label}
      </p>
    </div>
  );
}

/** Damage close-ups — an uncapped, open-ended list of extra photos (unlike
 * the six required angles, there's no fixed number expected). Each uploaded
 * photo shows as its own removable thumbnail; the dashed tile at the end is
 * always there to add another. */
function DamageCloseUpRow({
  photos,
  onAdd,
  onRemove,
}: {
  photos: CapturedPhoto[];
  onAdd: (file: File) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
      {photos.map(p => (
        <div key={p.id} style={{ position: "relative", width: 72, height: 72 }}>
          <img
            src={p.previewUrl}
            alt="Damage close-up"
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8, border: "1px solid #166534" }}
          />
          <button
            type="button"
            onClick={() => onRemove(p.id)}
            title="Remove photo"
            style={{
              position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%",
              backgroundColor: "#fff", border: "1px solid #e0d8cc", color: "#991b1b", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <label
        style={{
          width: 72, height: 72, borderRadius: 8, border: "1px dashed #d1d5db", backgroundColor: "#fafafa",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0,
        }}
      >
        <Camera size={18} style={{ color: "#9ca3af" }} />
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onAdd(file);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

/** The required-photo capture UI, shared between Intake ("before") and
 * Outtake ("after") — six labeled angle tiles, each a real upload (not a
 * "mark as done" toggle), plus an open-ended, uncapped row of damage
 * close-ups. These six angles are a hard requirement (Danielle: they're
 * what protects Cobbli against a customer claiming damage that was already
 * there, or that a service wasn't done). */
function PhotoAngleGrid({
  photos,
  onUploadAngle,
  onRemoveAngle,
  onAddCloseUp,
  onRemoveCloseUp,
}: {
  photos: PhotoSet;
  onUploadAngle: (angle: RequiredPhotoAngle, file: File) => void;
  onRemoveAngle: (angle: RequiredPhotoAngle) => void;
  onAddCloseUp: (file: File) => void;
  onRemoveCloseUp: (id: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {REQUIRED_PHOTO_ANGLES.map(a => (
          <PhotoAngleTile
            key={a.key}
            label={a.label}
            photo={photos.angles[a.key]}
            onUpload={file => onUploadAngle(a.key, file)}
            onRemove={() => onRemoveAngle(a.key)}
          />
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280" }}>Damage close-ups ({photos.damageCloseUps.length})</p>
        <DamageCloseUpRow photos={photos.damageCloseUps} onAdd={onAddCloseUp} onRemove={onRemoveCloseUp} />
      </div>
    </div>
  );
}

/** The Intake form itself — read-only services list (mirrors what's on this
 * pair, not editable here), the required photo capture, the full
 * per-component condition assessment, and a free-text notes field. "Save &
 * finish later" marks the pair in-progress without requiring anything
 * filled in; "Complete intake" is what actually unblocks the Services
 * checklist and Outtake for this pair, and — per Danielle's direction, while
 * this phase is about maximizing AI training data — is gated on **both**
 * all six required photos being present **and** every condition component
 * having an answer. Notes stays optional even at "Complete," since it's a
 * catch-all for anything extra, not something every intake will need. */
function IntakeFormModal({
  pair,
  services,
  photos,
  onUploadPhotoAngle,
  onRemovePhotoAngle,
  onAddDamageCloseUp,
  onRemoveDamageCloseUp,
  answers,
  notes,
  onToggleCondition,
  onNotesChange,
  onClose,
  onSave,
}: {
  pair: ShoePair;
  services: ServiceLine[];
  photos: PhotoSet;
  onUploadPhotoAngle: (angle: RequiredPhotoAngle, file: File) => void;
  onRemovePhotoAngle: (angle: RequiredPhotoAngle) => void;
  onAddDamageCloseUp: (file: File) => void;
  onRemoveDamageCloseUp: (id: string) => void;
  answers: Record<string, string[]>;
  notes: string;
  onToggleCondition: (comp: ConditionComponentDef, value: string) => void;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSave: (status: FormStatus) => void;
}) {
  const photosComplete = photoSetComplete(photos);
  const conditionsComplete = allConditionsAnswered(answers);
  const canComplete = photosComplete && conditionsComplete;
  return (
    <div
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(61,23,0,0.35)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 16px", zIndex: 50, overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: "#fff", borderRadius: 10, maxWidth: 640, width: "100%", padding: "24px 28px", marginBottom: 40 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#3d1700" }}>
            Intake form{pair.shoeType ? ` — ${pair.shoeType}` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontFamily: "inherit" }}
          >
            Close
          </button>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#9ca3af" }}>
          Assess this pair component by component. Every answer tags the pair for future AI training —
          it's separate from, and never changes, the services already on this order.
        </p>

        <div style={{ marginBottom: 18 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Services being performed
          </p>
          {services.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>No services recorded yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#374151" }}>
              {services.map(s => <li key={s.id}>{s.name}</li>)}
            </ul>
          )}
        </div>

        <div style={{ borderTop: "1px solid #f0ece5", paddingTop: 16, marginBottom: 18 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Photos — required
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9ca3af" }}>
            All six angles are required to complete intake — this is what protects Cobbli if a customer later claims damage that was already there at drop-off.
          </p>
          <PhotoAngleGrid
            photos={photos}
            onUploadAngle={onUploadPhotoAngle}
            onRemoveAngle={onRemovePhotoAngle}
            onAddCloseUp={onAddDamageCloseUp}
            onRemoveCloseUp={onRemoveDamageCloseUp}
          />
        </div>

        <div style={{ borderTop: "1px solid #f0ece5", paddingTop: 16 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            What is the condition of the...
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9ca3af" }}>
            Every component below is required to complete intake, for now — maximizing labeled training data matters more than form length while the AI model is still being trained.
          </p>
          {CONDITION_COMPONENTS.map(comp => (
            <ConditionGroup
              key={comp.key}
              comp={comp}
              selected={answers[comp.key] ?? []}
              onToggle={value => onToggleCondition(comp, value)}
            />
          ))}
        </div>

        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</p>
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Anything the checklist above doesn't capture..."
            rows={3}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e0d8cc", fontFamily: "inherit", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f0ece5" }}>
          {!canComplete && (
            <div
              role="alert"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", marginBottom: 10,
                borderRadius: 6, backgroundColor: "#fef2f2", border: "1px solid #fecaca",
                fontSize: 12, color: "#991b1b", fontWeight: 500,
              }}
            >
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              {!photosComplete && !conditionsComplete
                ? "All 6 required photos and every condition below must be completed before intake can be marked complete."
                : !photosComplete
                ? "All 6 required photos must be added before intake can be marked complete."
                : "Every condition below must have an answer before intake can be marked complete."}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={() => onSave("in-progress")}
              style={{ padding: "8px 16px", backgroundColor: "#fff", color: "#374151", border: "1px solid #e0d8cc", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Save &amp; finish later
            </button>
            <button
              type="button"
              disabled={!canComplete}
              onClick={() => onSave("complete")}
              style={{
                padding: "8px 16px", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                backgroundColor: canComplete ? "#3d1700" : "#d1d5db",
                color: "#fff",
                cursor: canComplete ? "pointer" : "not-allowed",
              }}
            >
              Complete intake
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The Outtake form — mirrors Intake's structure per Danielle's call
 * (required photos should be symmetric between the two, so before/after
 * actually line up shot-for-shot). Services are shown read-only here too:
 * per the resolved spec, Outtake reuses the same checklist staff already
 * checked off during the repair (see "Services applied") rather than a
 * second, separate confirmation pass. Gated on both all services being
 * checked off *and* all six required "after" photos being present. */
function OuttakeFormModal({
  pair,
  services,
  photos,
  onUploadPhotoAngle,
  onRemovePhotoAngle,
  onAddDamageCloseUp,
  onRemoveDamageCloseUp,
  notes,
  onNotesChange,
  onClose,
  onSave,
}: {
  pair: ShoePair;
  services: ServiceLine[];
  photos: PhotoSet;
  onUploadPhotoAngle: (angle: RequiredPhotoAngle, file: File) => void;
  onRemovePhotoAngle: (angle: RequiredPhotoAngle) => void;
  onAddDamageCloseUp: (file: File) => void;
  onRemoveDamageCloseUp: (id: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onClose: () => void;
  onSave: (status: FormStatus) => void;
}) {
  const photosComplete = photoSetComplete(photos);
  const allServicesDone = services.length > 0 && services.every(s => s.done);
  const canComplete = photosComplete && allServicesDone;

  return (
    <div
      style={{
        position: "fixed", inset: 0, backgroundColor: "rgba(61,23,0,0.35)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "40px 16px", zIndex: 50, overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: "#fff", borderRadius: 10, maxWidth: 640, width: "100%", padding: "24px 28px", marginBottom: 40 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#3d1700" }}>
            Outtake form{pair.shoeType ? ` — ${pair.shoeType}` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 13, fontFamily: "inherit" }}
          >
            Close
          </button>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#9ca3af" }}>
          Confirm each service was completed and document the finished pair — this closes out the repair for this pair.
        </p>

        <div style={{ marginBottom: 18 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Services completed
          </p>
          {services.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>No services recorded yet.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {services.map(s => (
                <li key={s.id} style={{ color: s.done ? "#166534" : "#991b1b" }}>
                  {s.name} — {s.done ? "done" : "not yet checked off"}
                </li>
              ))}
            </ul>
          )}
          {!allServicesDone && services.length > 0 && (
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "#991b1b" }}>
              All services must be checked off (see "Services applied" on the pair card) before outtake can be completed.
            </p>
          )}
        </div>

        <div style={{ borderTop: "1px solid #f0ece5", paddingTop: 16 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Photos — required
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9ca3af" }}>
            Same six angles as intake, so before and after actually line up shot-for-shot.
          </p>
          <PhotoAngleGrid
            photos={photos}
            onUploadAngle={onUploadPhotoAngle}
            onRemoveAngle={onRemovePhotoAngle}
            onAddCloseUp={onAddDamageCloseUp}
            onRemoveCloseUp={onRemoveDamageCloseUp}
          />
        </div>

        <div style={{ marginTop: 18 }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</p>
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Anything worth noting about the finished repair..."
            rows={3}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #e0d8cc", fontFamily: "inherit", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f0ece5" }}>
          {!canComplete && (
            <div
              role="alert"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", marginBottom: 10,
                borderRadius: 6, backgroundColor: "#fef2f2", border: "1px solid #fecaca",
                fontSize: 12, color: "#991b1b", fontWeight: 500,
              }}
            >
              <AlertTriangle size={13} style={{ flexShrink: 0 }} />
              {!allServicesDone
                ? "All services must be checked off, and all 6 required photos added, before outtake can be marked complete."
                : "All 6 required photos must be added before outtake can be marked complete."}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={() => onSave("in-progress")}
              style={{ padding: "8px 16px", backgroundColor: "#fff", color: "#374151", border: "1px solid #e0d8cc", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Save &amp; finish later
            </button>
            <button
              type="button"
              disabled={!canComplete}
              onClick={() => onSave("complete")}
              style={{
                padding: "8px 16px", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                backgroundColor: canComplete ? "#3d1700" : "#d1d5db",
                color: "#fff",
                cursor: canComplete ? "pointer" : "not-allowed",
              }}
            >
              Complete outtake
            </button>
          </div>
        </div>
      </div>
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

  // Intake/Outtake status now live in local state (rather than reading
  // pair.intakeStatus/completionStatus directly) so actually completing a
  // form in this session takes effect immediately — unblocking the Services
  // checklist and Outtake, or closing out the pair, without needing a page
  // reload or real backend round-trip.
  const [intakeStatus, setIntakeStatus] = useState<FormStatus>(pair.intakeStatus);
  const [completionStatus, setCompletionStatus] = useState<FormStatus>(pair.completionStatus);
  const [conditionAnswers, setConditionAnswers] = useState<Record<string, string[]>>(pair.conditionAssessment ?? {});
  const [intakeNotes, setIntakeNotes] = useState(pair.intakeNotes ?? "");
  const [outtakeNotes, setOuttakeNotes] = useState(pair.outtakeNotes ?? "");
  const [beforePhotos, setBeforePhotos] = useState<PhotoSet>(pair.photos.before);
  const [afterPhotos, setAfterPhotos] = useState<PhotoSet>(pair.photos.after);
  const [intakeModalOpen, setIntakeModalOpen] = useState(false);
  const [outtakeModalOpen, setOuttakeModalOpen] = useState(false);

  const intakeDone = intakeStatus === "complete";
  const outtakeDone = completionStatus === "complete";

  const toggleService = (id: string) => {
    // Guard the handler itself, not just the UI — a service can't be marked
    // done on a pair whose intake isn't complete yet (Danielle's bug report:
    // she was able to check off "Heel replacement" before intake started).
    if (!intakeDone) return;
    setServices(prev => prev.map(s => (s.id === id ? { ...s, done: !s.done } : s)));
  };

  // Good/Not-applicable is an all-or-nothing reset; beyond that, single-select
  // components behave like radio buttons (every option mutually exclusive),
  // while multi-select components (Surface, Color, Material, Zipper) allow
  // combining non-exclusive answers — e.g. scuffs and stains can both be true.
  const toggleCondition = (comp: ConditionComponentDef, value: string) => {
    setConditionAnswers(prev => {
      const current = prev[comp.key] ?? [];
      if (!comp.multi) {
        const next = current.includes(value) ? [] : [value];
        return { ...prev, [comp.key]: next };
      }
      if (comp.exclusiveValues.includes(value)) {
        const next = current.includes(value) ? [] : [value];
        return { ...prev, [comp.key]: next };
      }
      const withoutExclusive = current.filter(v => !comp.exclusiveValues.includes(v));
      const next = withoutExclusive.includes(value)
        ? withoutExclusive.filter(v => v !== value)
        : [...withoutExclusive, value];
      return { ...prev, [comp.key]: next };
    });
  };

  // Real file uploads — previewed via an object URL (client-side only, no
  // server upload yet). Revoking the old URL when a photo is replaced or
  // removed avoids piling up object URLs in memory over a long session.
  const uploadPhoto = (
    setPhotos: React.Dispatch<React.SetStateAction<PhotoSet>>,
    angle: RequiredPhotoAngle,
    file: File,
  ) => {
    const photo: CapturedPhoto = { id: `${angle}-${Date.now()}`, previewUrl: URL.createObjectURL(file), fileName: file.name };
    setPhotos(prev => {
      const existing = prev.angles[angle];
      if (existing) URL.revokeObjectURL(existing.previewUrl);
      return { ...prev, angles: { ...prev.angles, [angle]: photo } };
    });
  };
  const removePhoto = (setPhotos: React.Dispatch<React.SetStateAction<PhotoSet>>, angle: RequiredPhotoAngle) => {
    setPhotos(prev => {
      const existing = prev.angles[angle];
      if (existing) URL.revokeObjectURL(existing.previewUrl);
      const nextAngles = { ...prev.angles };
      delete nextAngles[angle];
      return { ...prev, angles: nextAngles };
    });
  };
  const addCloseUp = (setPhotos: React.Dispatch<React.SetStateAction<PhotoSet>>, file: File) => {
    const photo: CapturedPhoto = { id: `closeup-${Date.now()}-${Math.random().toString(36).slice(2)}`, previewUrl: URL.createObjectURL(file), fileName: file.name };
    setPhotos(prev => ({ ...prev, damageCloseUps: [...prev.damageCloseUps, photo] }));
  };
  const removeCloseUp = (setPhotos: React.Dispatch<React.SetStateAction<PhotoSet>>, id: string) => {
    setPhotos(prev => {
      const target = prev.damageCloseUps.find(p => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return { ...prev, damageCloseUps: prev.damageCloseUps.filter(p => p.id !== id) };
    });
  };

  const uploadBeforePhoto = (angle: RequiredPhotoAngle, file: File) => uploadPhoto(setBeforePhotos, angle, file);
  const removeBeforePhoto = (angle: RequiredPhotoAngle) => removePhoto(setBeforePhotos, angle);
  const uploadAfterPhoto = (angle: RequiredPhotoAngle, file: File) => uploadPhoto(setAfterPhotos, angle, file);
  const removeAfterPhoto = (angle: RequiredPhotoAngle) => removePhoto(setAfterPhotos, angle);

  const saveIntake = (status: FormStatus) => {
    setIntakeStatus(status);
    setIntakeModalOpen(false);
  };
  const saveOuttake = (status: FormStatus) => {
    setCompletionStatus(status);
    setOuttakeModalOpen(false);
  };

  const servicesTotal = services.reduce((s, l) => s + l.priceCents, 0);
  const allServicesDone = services.length > 0 && services.every(s => s.done);

  const headerCta = !intakeDone
    ? (intakeStatus === "not-started" ? "Complete intake form" : "Continue intake form")
    : !outtakeDone
    ? (completionStatus === "not-started" ? "Complete outtake form" : "Continue outtake form")
    : null;

  const title = total > 1
    ? `Pair ${index + 1}${pair.shoeType ? ` — ${pair.shoeType}` : ""}`
    : (pair.shoeType || "Shoe & services");

  const beforeFilled = REQUIRED_PHOTO_ANGLES.filter(a => beforePhotos.angles[a.key]).length;
  const beforeComplete = beforeFilled === REQUIRED_PHOTO_ANGLES.length;
  const afterFilled = REQUIRED_PHOTO_ANGLES.filter(a => afterPhotos.angles[a.key]).length;
  const afterComplete = afterFilled === REQUIRED_PHOTO_ANGLES.length;

  return (
    <>
      <Card
        title={title}
        headerAction={headerCta && (
          <button
            type="button"
            onClick={() => {
              if (!intakeDone) setIntakeModalOpen(true);
              else if (!outtakeDone) setOuttakeModalOpen(true);
            }}
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
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Photos</p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div style={{ minWidth: 140 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#9ca3af" }}>Customer-submitted (optional) · {pair.photos.customerSubmitted}</p>
              <PhotoGrid count={pair.photos.customerSubmitted} label="Customer-submitted" />
            </div>
            <div style={{ minWidth: 180 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#9ca3af" }}>
                Before (intake) — required · {beforeFilled}/{REQUIRED_PHOTO_ANGLES.length}
                {beforePhotos.damageCloseUps.length > 0 ? ` + ${beforePhotos.damageCloseUps.length} extra` : ""}
              </p>
              <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, backgroundColor: beforeComplete ? "#dcfce7" : "#fef3c7", color: beforeComplete ? "#166534" : "#92400e" }}>
                {beforeComplete ? "Required photos complete" : "Required photos missing"}
              </span>
            </div>
            <div style={{ minWidth: 180 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#9ca3af" }}>
                After (outtake) — required · {afterFilled}/{REQUIRED_PHOTO_ANGLES.length}
                {afterPhotos.damageCloseUps.length > 0 ? ` + ${afterPhotos.damageCloseUps.length} extra` : ""}
              </p>
              <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, backgroundColor: afterComplete ? "#dcfce7" : "#fef3c7", color: afterComplete ? "#166534" : "#92400e" }}>
                {afterComplete ? "Required photos complete" : "Required photos missing"}
              </span>
            </div>
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
            <FormRow label="Intake form" status={intakeStatus} disabled={false} onClick={() => setIntakeModalOpen(true)} />
            <FormRow label="Outtake form" status={completionStatus} disabled={!intakeDone} onClick={() => setOuttakeModalOpen(true)} />
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11, color: "#9ca3af" }}>
            Complete intake to start the repair — services can't be checked off until then. Complete outtake to close it out.
            {!allServicesDone && services.length > 0 ? " All services must be checked off before outtake can be marked complete." : ""}
          </p>
        </div>
      </Card>

      {intakeModalOpen && (
        <IntakeFormModal
          pair={pair}
          services={services}
          photos={beforePhotos}
          onUploadPhotoAngle={uploadBeforePhoto}
          onRemovePhotoAngle={removeBeforePhoto}
          onAddDamageCloseUp={file => addCloseUp(setBeforePhotos, file)}
          onRemoveDamageCloseUp={id => removeCloseUp(setBeforePhotos, id)}
          answers={conditionAnswers}
          notes={intakeNotes}
          onToggleCondition={toggleCondition}
          onNotesChange={setIntakeNotes}
          onClose={() => setIntakeModalOpen(false)}
          onSave={saveIntake}
        />
      )}

      {outtakeModalOpen && (
        <OuttakeFormModal
          pair={pair}
          services={services}
          photos={afterPhotos}
          onUploadPhotoAngle={uploadAfterPhoto}
          onRemovePhotoAngle={removeAfterPhoto}
          onAddDamageCloseUp={file => addCloseUp(setAfterPhotos, file)}
          onRemoveDamageCloseUp={id => removeCloseUp(setAfterPhotos, id)}
          notes={outtakeNotes}
          onNotesChange={setOuttakeNotes}
          onClose={() => setOuttakeModalOpen(false)}
          onSave={saveOuttake}
        />
      )}
    </>
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
        const totalPhotos = pair.photos.customerSubmitted + photoSetCount(pair.photos.before) + photoSetCount(pair.photos.after);
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
          DO
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
