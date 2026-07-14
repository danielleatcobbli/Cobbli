/**
 * adminData
 *
 * Real Supabase data access for the admin dashboard (AdminDashboard.tsx /
 * AdminOrderDetail.tsx), replacing the hardcoded ORDERS / ORDER_DETAILS
 * dummy arrays. Maps live rows into the exact same shapes those two files
 * already expect, so every component downstream (WorkshopView, DispatchView,
 * PhotosView, pair cards, Intake/Outtake forms, etc.) keeps working
 * unchanged — only the data source changes.
 *
 * Scope (see cobbli-requirements.md Section 12 developer requirement):
 * this file covers READS and photo uploads only. The interactive
 * save/toggle mutations (condition assessment answers, services-done
 * checkboxes, save & finish later) are intentionally left as local state
 * for now — Danielle's call, to keep the riskiest, hardest-to-verify-blind
 * part of this rewrite in a developer's hands. See the requirements doc for
 * what's still open.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Order, OrderStatus, ScheduleSlot } from "./AdminDashboard";
import type {
  CapturedPhoto,
  OrderDetail,
  PhotoSet,
  RequiredPhotoAngle,
  ShoePair,
} from "./AdminOrderDetail";
import { REQUIRED_PHOTO_ANGLES } from "./AdminOrderDetail";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const KNOWN_STATUSES = new Set<OrderStatus>([
  // Standard checkout path
  "placed",
  "pending_payment",
  // Proposal / assessment path
  "proposal-awaiting-our-response",
  "proposal-awaiting-customer-response",
  // Logistics
  "pickup-scheduled",
  "picked-up",
  "at-the-workshop",
  "in-repair",
  "ready-for-return",
  "return-scheduled",
  "returned",
  "completed",
  // Rework sub-flow
  "rework-request-pending",
  "rework-request-approved",
  "rework-request-denied",
]);

/** Defensive: `orders.status` is a plain text column, not a DB-level enum
 * (deliberately, since Olivier's checkout work and the admin dashboard's own
 * status transitions both write to it, and locking it to an enum this early
 * risks a rejected insert from a status string nobody's added here yet).
 * Falls back to "pickup-scheduled" (a fresh order's natural starting point
 * per Section 9) rather than letting an unrecognized string reach STATUS_CFG
 * lookups and crash the page. */
function coerceStatus(raw: string): OrderStatus {
  if (KNOWN_STATUSES.has(raw as OrderStatus)) return raw as OrderStatus;
  console.warn(`adminData: unrecognized order status "${raw}", falling back to "pickup-scheduled"`);
  return "pickup-scheduled";
}

function toDateOnly(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

type AddressLike = { street?: string; street2?: string; city?: string; state?: string; zip?: string } | null;

function formatAddress(addr: AddressLike): string {
  if (!addr) return "";
  const parts = [addr.street, addr.street2, addr.city, addr.state, addr.zip];
  return parts.filter((p): p is string => typeof p === "string" && p.length > 0).join(", ");
}

type ProfileRow = { user_id: string; first_name: string | null; last_name: string | null; phone: string | null };

function initialsFromProfile(p: ProfileRow | undefined): string {
  if (!p) return "";
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return initials || "";
}

function fullNameFromProfile(p: ProfileRow | undefined): string {
  if (!p) return "Customer";
  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return name || "Customer";
}

async function fetchProfileMap(userIds: string[]): Promise<Map<string, ProfileRow>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, first_name, last_name, phone")
    .in("user_id", unique);
  if (error) throw error;
  return new Map((data ?? []).map(p => [p.user_id, p]));
}

async function fetchReworkOrderIds(orderIds: string[]): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();
  const { data, error } = await supabase.from("reworks").select("order_id").in("order_id", orderIds);
  if (error) throw error;
  return new Set((data ?? []).map(r => r.order_id));
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminDashboard — orders list
// ─────────────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  user_id: string;
  order_number: string;
  status: string;
  placed_at: string;
  delivery_address: AddressLike;
  contact_phone: string;
  workshop_assignee: string | null;
  dispatch_assignee: string | null;
  action_required_by: string | null;
  last_contacted_at: string | null;
  pickup_date: string | null;
  pickup_time_label: string | null;
  return_date: string | null;
  return_time_label: string | null;
  notes: string | null;
};

function mapOrderRow(
  r: OrderRow,
  profiles: Map<string, ProfileRow>,
  reworkOrderIds: Set<string>,
): Order {
  const pickupSlot: ScheduleSlot | undefined =
    r.pickup_date && r.pickup_time_label ? { date: r.pickup_date, timeLabel: r.pickup_time_label } : undefined;
  const returnSlot: ScheduleSlot | undefined =
    r.return_date && r.return_time_label ? { date: r.return_date, timeLabel: r.return_time_label } : undefined;

  return {
    id: r.id,
    orderNumber: r.order_number,
    status: coerceStatus(r.status),
    datePlaced: toDateOnly(r.placed_at),
    customer: {
      name: fullNameFromProfile(profiles.get(r.user_id)),
      phone: r.contact_phone ?? "",
    },
    address: formatAddress(r.delivery_address),
    workshopAssignee: r.workshop_assignee ? initialsFromProfile(profiles.get(r.workshop_assignee)) : "",
    dispatchAssignee: r.dispatch_assignee ? initialsFromProfile(profiles.get(r.dispatch_assignee)) : "",
    isRework: reworkOrderIds.has(r.id),
    actionRequiredBy: r.action_required_by ? toDateOnly(r.action_required_by) : null,
    lastContactedAt: r.last_contacted_at ? toDateOnly(r.last_contacted_at) : null,
    pickupSlot,
    returnSlot,
    notes: r.notes ?? undefined,
  };
}

/** Replaces the hardcoded ORDERS array in AdminDashboard.tsx. Returns every
 * order — the existing Workshop/Dispatch view components already do their
 * own tab/status/assignee filtering client-side, same as they did against
 * the dummy array. */
export async function fetchOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, user_id, order_number, status, placed_at, delivery_address, contact_phone, workshop_assignee, dispatch_assignee, action_required_by, last_contacted_at, pickup_date, pickup_time_label, return_date, return_time_label, notes",
    )
    .order("placed_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as OrderRow[];

  const userIds = rows.flatMap(r => [r.user_id, r.workshop_assignee, r.dispatch_assignee].filter((x): x is string => !!x));
  const [profiles, reworkOrderIds] = await Promise.all([
    fetchProfileMap(userIds),
    fetchReworkOrderIds(rows.map(r => r.id)),
  ]);

  return rows.map(r => mapOrderRow(r, profiles, reworkOrderIds));
}

// ─────────────────────────────────────────────────────────────────────────────
// AdminOrderDetail — single order + pairs + services + photos + notes
// ─────────────────────────────────────────────────────────────────────────────

type OrderDetailRow = OrderRow & {
  contact_email: string;
  assessment_id: string | null;
};

type OrderPairRow = {
  id: string;
  order_id: string;
  shoe_type: string | null;
  shoe_brand: string | null;
  shoe_color_material: string | null;
  customer_notes: string | null;
  intake_status: string;
  completion_status: string;
  condition_assessment: Record<string, string[]> | null;
  intake_notes: string | null;
  outtake_notes: string | null;
};

type OrderItemRow = {
  id: string;
  order_pair_id: string | null;
  service_snapshot: { name?: string } | null;
  price_cents: number;
  done: boolean;
};

type PairPhotoRow = {
  id: string;
  order_pair_id: string;
  side: string;
  angle: string | null;
  storage_path: string;
};

/** Signed URLs are short-lived by design (the pair-photos bucket is
 * private — these are evidence photos, not public marketing images). One
 * hour is generous for a staff session actively working an order without
 * leaving stale long-lived links floating around. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

async function toCapturedPhoto(row: PairPhotoRow): Promise<CapturedPhoto> {
  const { data, error } = await supabase.storage
    .from("pair-photos")
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return {
    id: row.id,
    previewUrl: data.signedUrl,
    fileName: row.storage_path.split("/").pop() ?? row.storage_path,
    storagePath: row.storage_path,
  };
}

function emptyPhotoSetShape(): PhotoSet {
  return { angles: {}, damageCloseUps: [] };
}

async function buildPhotoSet(rows: PairPhotoRow[]): Promise<PhotoSet> {
  const set = emptyPhotoSetShape();
  for (const row of rows) {
    const photo = await toCapturedPhoto(row);
    if (row.angle && REQUIRED_PHOTO_ANGLES.some(a => a.key === row.angle)) {
      set.angles[row.angle as RequiredPhotoAngle] = photo;
    } else {
      set.damageCloseUps.push(photo);
    }
  }
  return set;
}

/** Replaces the ORDER_DETAILS[id] lookup in AdminOrderDetail.tsx. Returns
 * null if the order doesn't exist (caller falls back to its own
 * buildFallback(), same as the not-found path already handled). */
export async function fetchOrderDetail(id: string): Promise<OrderDetail | null> {
  const { data: orderRow, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, user_id, order_number, status, placed_at, delivery_address, contact_phone, contact_email, workshop_assignee, dispatch_assignee, action_required_by, last_contacted_at, pickup_date, pickup_time_label, return_date, return_time_label, notes, assessment_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (orderErr) throw orderErr;
  if (!orderRow) return null;
  const order = orderRow as OrderDetailRow;

  const [{ data: pairRows, error: pairErr }, { data: noteRows, error: noteErr }] = await Promise.all([
    supabase
      .from("order_pairs")
      .select(
        "id, order_id, shoe_type, shoe_brand, shoe_color_material, customer_notes, intake_status, completion_status, condition_assessment, intake_notes, outtake_notes",
      )
      .eq("order_id", id),
    supabase
      .from("order_notes")
      .select("id, author_name, body, created_at")
      .eq("order_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (pairErr) throw pairErr;
  if (noteErr) throw noteErr;
  const pairs = (pairRows ?? []) as OrderPairRow[];

  const pairIds = pairs.map(p => p.id);
  const [{ data: itemRows, error: itemErr }, { data: photoRows, error: photoErr }, profiles, reworkOrderIds] = await Promise.all([
    pairIds.length > 0
      ? supabase.from("order_items").select("id, order_pair_id, service_snapshot, price_cents, done").in("order_pair_id", pairIds)
      : Promise.resolve({ data: [] as OrderItemRow[], error: null }),
    pairIds.length > 0
      ? supabase.from("pair_photos").select("id, order_pair_id, side, angle, storage_path").in("order_pair_id", pairIds)
      : Promise.resolve({ data: [] as PairPhotoRow[], error: null }),
    fetchProfileMap([order.user_id, order.workshop_assignee, order.dispatch_assignee].filter((x): x is string => !!x)),
    fetchReworkOrderIds([id]),
  ]);
  if (itemErr) throw itemErr;
  if (photoErr) throw photoErr;
  const items = (itemRows ?? []) as OrderItemRow[];
  const photoRowsList = (photoRows ?? []) as PairPhotoRow[];

  const shoePairs: ShoePair[] = [];
  for (const p of pairs) {
    const pairItems = items.filter(i => i.order_pair_id === p.id);
    const beforeRows = photoRowsList.filter(ph => ph.order_pair_id === p.id && ph.side === "before");
    const afterRows = photoRowsList.filter(ph => ph.order_pair_id === p.id && ph.side === "after");
    const [before, after] = await Promise.all([buildPhotoSet(beforeRows), buildPhotoSet(afterRows)]);

    shoePairs.push({
      id: p.id,
      shoeType: p.shoe_type ?? "",
      shoeBrand: p.shoe_brand ?? "",
      shoeColorMaterial: p.shoe_color_material ?? "",
      customerNotes: p.customer_notes ?? undefined,
      photos: {
        // No table tracks customer-submitted checkout photos yet (separate
        // from staff intake/outtake) -- left at 0 rather than guessed.
        customerSubmitted: 0,
        before,
        after,
      },
      services: pairItems.map(i => ({
        id: i.id,
        name: i.service_snapshot?.name ?? "Service",
        priceCents: i.price_cents,
        tag: "original" as const,
        done: i.done,
      })),
      intakeStatus: (p.intake_status as ShoePair["intakeStatus"]) ?? "not-started",
      completionStatus: (p.completion_status as ShoePair["completionStatus"]) ?? "not-started",
      conditionAssessment: p.condition_assessment ?? undefined,
      intakeNotes: p.intake_notes ?? undefined,
      outtakeNotes: p.outtake_notes ?? undefined,
    });
  }

  // If this order was created from a proposal approval, fetch the assessment
  // snapshot (photos + proposed services) for traceability in the detail page.
  let assessmentRef: OrderDetail["assessmentRef"] | undefined;
  if (order.assessment_id) {
    try {
      const { data: aRow } = await supabase
        .from("assessments")
        .select("id, pairs, proposed_services")
        .eq("id", order.assessment_id)
        .maybeSingle();

      if (aRow) {
        type AssessmentPair = { photoPaths?: string[] };
        type AssessmentService = { name: string; price_cents: number; tier: string };
        const aPairs = (aRow.pairs as unknown as AssessmentPair[]) ?? [];
        const aServices = (aRow.proposed_services as unknown as AssessmentService[]) ?? [];

        // Build signed URLs for the first pair's first 4 photos.
        const photoUrls: string[] = [];
        const paths = (aPairs[0]?.photoPaths ?? []).slice(0, 4);
        for (const path of paths) {
          const { data: su } = await supabase.storage
            .from("assessment-uploads")
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
          if (su?.signedUrl) photoUrls.push(su.signedUrl);
        }

        assessmentRef = {
          id: aRow.id as string,
          photoUrls,
          services: aServices.map(s => ({
            name: s.name,
            priceCents: s.price_cents,
            tier: (s.tier === "essential" || s.tier === "recommended") ? s.tier : "essential",
          })),
        };
      }
    } catch {
      // Non-fatal: assessment lookup failing shouldn't break the order detail page.
    }
  }

  return {
    id: order.id,
    orderNumber: order.order_number,
    status: coerceStatus(order.status),
    datePlaced: toDateOnly(order.placed_at),
    isRework: reworkOrderIds.has(order.id),
    actionRequiredBy: order.action_required_by ? toDateOnly(order.action_required_by) : null,
    workshopAssignee: order.workshop_assignee ? initialsFromProfile(profiles.get(order.workshop_assignee)) : "",
    dispatchAssignee: order.dispatch_assignee ? initialsFromProfile(profiles.get(order.dispatch_assignee)) : "",
    customer: {
      name: fullNameFromProfile(profiles.get(order.user_id)),
      phone: order.contact_phone ?? "",
      email: order.contact_email ?? "",
    },
    address: formatAddress(order.delivery_address),
    pickupSlot: order.pickup_date && order.pickup_time_label ? { date: order.pickup_date, timeLabel: order.pickup_time_label } : undefined,
    returnSlot: order.return_date && order.return_time_label ? { date: order.return_date, timeLabel: order.return_time_label } : undefined,
    // Prior pickup/return legs from before a rework aren't tracked in any
    // table yet (Section 12's "Pickup/return history retained across
    // reworks") -- a known gap, left empty rather than guessed at.
    logisticsHistory: [],
    pairs: shoePairs,
    comments: (noteRows ?? []).map(n => ({
      initials: (n.author_name ?? "Staff")
        .split(/\s+/)
        .map(w => w.charAt(0))
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      author: n.author_name ?? "Staff",
      isoTimestamp: n.created_at,
      text: n.body,
    })),
    notes: order.notes ?? undefined,
    assessmentRef,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Photo upload — real Storage writes (replaces URL.createObjectURL preview)
// ─────────────────────────────────────────────────────────────────────────────

/** Key convention matches the developer requirement in
 * cobbli-requirements.md Section 12: {order_id}/{pair_id}/{before|after}/
 * {angle}.jpg for the six required angles, .../closeup-{uuid}.jpg for
 * damage close-ups. */
function storageKey(orderId: string, pairId: string, side: "before" | "after", slot: RequiredPhotoAngle | "closeup", ext: string): string {
  const name = slot === "closeup" ? `closeup-${crypto.randomUUID()}` : slot;
  return `${orderId}/${pairId}/${side}/${name}.${ext}`;
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type === "image/png" ? "png" : "jpg";
}

/** Uploads one photo to the pair-photos bucket and records it in
 * pair_photos. Returns a CapturedPhoto (with a signed preview URL) ready to
 * drop straight into a PhotoSet, same shape the old object-URL path
 * produced. */
export async function uploadPairPhoto(params: {
  orderId: string;
  pairId: string;
  side: "before" | "after";
  angle: RequiredPhotoAngle | null;
  file: File;
}): Promise<CapturedPhoto> {
  const { orderId, pairId, side, angle, file } = params;
  const path = storageKey(orderId, pairId, side, angle ?? "closeup", extensionFor(file));

  const { error: uploadErr } = await supabase.storage.from("pair-photos").upload(path, file, {
    // Required angles are 1:1 with (pair, side, angle) via the unique index
    // -- a re-upload to the same angle should replace, not fail.
    upsert: angle !== null,
  });
  if (uploadErr) throw uploadErr;

  const { data: row, error: insertErr } = await supabase
    .from("pair_photos")
    .insert({ order_pair_id: pairId, side, angle, storage_path: path })
    .select("id, order_pair_id, side, angle, storage_path")
    .single();
  if (insertErr) throw insertErr;

  return toCapturedPhoto(row as PairPhotoRow);
}

/** Removes a photo: deletes the file from Storage and its pair_photos row.
 * Matches the existing "×" remove/retake affordance on each photo tile. */
export async function removePairPhoto(photo: CapturedPhoto, storagePath: string): Promise<void> {
  const { error: removeErr } = await supabase.storage.from("pair-photos").remove([storagePath]);
  if (removeErr) throw removeErr;
  const { error: deleteErr } = await supabase.from("pair_photos").delete().eq("id", photo.id);
  if (deleteErr) throw deleteErr;
}

// ─────────────────────────────────────────────────────────────────────────────
// Photos gallery (Section 14) — every pair with a complete before AND after
// photo set, for pulling social media content.
// ─────────────────────────────────────────────────────────────────────────────

/** Matches AdminDashboard.tsx's GalleryItem shape exactly, so PhotosView
 * doesn't need to change beyond swapping its data source. */
export type GalleryItem = {
  orderId: string;
  orderNumber: string;
  pairId: string;
  shoeBrand: string;
  shoeType: string;
  shoeColorMaterial: string;
  serviceNames: string[];
  before: PhotoSet;
  after: PhotoSet;
};

function hasAllRequiredAngles(rows: PairPhotoRow[]): boolean {
  const angles = new Set(rows.map(r => r.angle).filter(Boolean));
  return REQUIRED_PHOTO_ANGLES.every(a => angles.has(a.key));
}

export async function fetchGalleryItems(): Promise<GalleryItem[]> {
  const { data: pairRows, error: pairErr } = await supabase
    .from("order_pairs")
    .select("id, order_id, shoe_type, shoe_brand, shoe_color_material, orders(order_number)");
  if (pairErr) throw pairErr;
  const pairs = (pairRows ?? []) as unknown as (OrderPairRow & { orders: { order_number: string } | null })[];
  if (pairs.length === 0) return [];

  const pairIds = pairs.map(p => p.id);
  const [{ data: photoRows, error: photoErr }, { data: itemRows, error: itemErr }] = await Promise.all([
    supabase.from("pair_photos").select("id, order_pair_id, side, angle, storage_path").in("order_pair_id", pairIds),
    supabase.from("order_items").select("order_pair_id, service_snapshot").in("order_pair_id", pairIds),
  ]);
  if (photoErr) throw photoErr;
  if (itemErr) throw itemErr;
  const allPhotos = (photoRows ?? []) as PairPhotoRow[];
  const allItems = (itemRows ?? []) as { order_pair_id: string | null; service_snapshot: { name?: string } | null }[];

  const items: GalleryItem[] = [];
  for (const pair of pairs) {
    const beforeRows = allPhotos.filter(p => p.order_pair_id === pair.id && p.side === "before");
    const afterRows = allPhotos.filter(p => p.order_pair_id === pair.id && p.side === "after");
    if (!hasAllRequiredAngles(beforeRows) || !hasAllRequiredAngles(afterRows)) continue;

    const [before, after] = await Promise.all([buildPhotoSet(beforeRows), buildPhotoSet(afterRows)]);
    const serviceNames = allItems
      .filter(i => i.order_pair_id === pair.id)
      .map(i => i.service_snapshot?.name ?? "Service");

    items.push({
      orderId: pair.order_id,
      orderNumber: pair.orders?.order_number ?? "",
      pairId: pair.id,
      shoeBrand: pair.shoe_brand ?? "",
      shoeType: pair.shoe_type ?? "",
      shoeColorMaterial: pair.shoe_color_material ?? "",
      serviceNames,
      before,
      after,
    });
  }
  return items;
}
