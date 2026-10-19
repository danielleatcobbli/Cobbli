import { apiFetchJson } from "@/integrations/api/client";
import type { ProposedService } from "@/components/admin/ProposalBuilder";

// Types + loaders for the Requests list and detail pages. One request = one
// row in `assessments`; `order` is the booked order (orders.assessment_id),
// attached by GET /ops/assessments.

export type RequestBag = {
  id?: string;
  shoeType?: string | null;
  brand?: string | null;
  colors?: string[];
  photoPaths?: string[];
  description?: string | null;
};

export type LinkedOrder = {
  id: string;
  order_number: string | null;
  status: string;
} | null;

export type RequestProfile = {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
} | null;

export type RequestRow = {
  id: string;
  user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  pairs: RequestBag[];
  description?: string | null;
  guest_email?: string | null;
  guest_zip?: string | null;
  requested_conditions?: string[];
  proposed_services?: ProposedService[] | null;
  complimentary?: boolean | null;
  proposal_token?: string | null;
  order: LinkedOrder;
  profile: RequestProfile;
};

type Envelope<T> = T[] | { data?: T[] | null };
const unwrapList = <T,>(body: Envelope<T>): T[] =>
  Array.isArray(body) ? body : body?.data ?? [];

type ProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
};

const PROFILE_CHUNK = 50;

// Any failure here throws, so the whole load fails and LoadState shows the
// error. We never return a partial list (e.g. rows without their names).
async function loadProfiles(userIds: string[]): Promise<Map<string, ProfileRow>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, ProfileRow>();
  for (let i = 0; i < unique.length; i += PROFILE_CHUNK) {
    const chunk = unique.slice(i, i + PROFILE_CHUNK);
    const rows = unwrapList(
      await apiFetchJson<Envelope<ProfileRow>>(
        `/ops/profiles?ids=${encodeURIComponent(chunk.join(","))}`,
      ),
    );
    for (const p of rows) map.set(p.user_id, p);
  }
  return map;
}

type RawRequest = Omit<RequestRow, "profile" | "order" | "pairs"> & {
  pairs?: RequestBag[] | null;
  order?: LinkedOrder;
};

const toRow = (raw: RawRequest, profiles: Map<string, ProfileRow>): RequestRow => ({
  ...raw,
  pairs: raw.pairs ?? [],
  order: raw.order ?? null,
  profile: raw.user_id ? profiles.get(raw.user_id) ?? null : null,
});

/** Every request, newest first. Counts and filters are derived from this one result. */
export async function fetchRequests(): Promise<RequestRow[]> {
  const raw = unwrapList(await apiFetchJson<Envelope<RawRequest>>("/ops/assessments/"));
  const profiles = await loadProfiles(raw.map((r) => r.user_id ?? ""));
  return raw.map((r) => toRow(r, profiles));
}

export async function fetchRequest(id: string): Promise<RequestRow> {
  const body = await apiFetchJson<{ data: RawRequest }>(
    `/ops/assessments/${encodeURIComponent(id)}`,
  );
  const profiles = await loadProfiles([body.data.user_id ?? ""]);
  return toRow(body.data, profiles);
}

/**
 * Stage 1 reference number: derived from the request id, since requests have
 * no reference column yet. Stable and unique enough at current volume, but
 * not a clean sequence — replace with a real column if/when one is added.
 */
export const referenceFor = (id: string): string =>
  `REQ-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export const customerName = (row: RequestRow): string => {
  const name = [row.profile?.first_name, row.profile?.last_name].filter(Boolean).join(" ");
  return name || row.guest_email || "Unknown customer";
};
