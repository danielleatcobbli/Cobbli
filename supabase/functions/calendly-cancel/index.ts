/**
 * calendly-cancel
 *
 * Cancels a previously-booked Calendly event so the reschedule flow can
 * replace it with a new one. Without this step a naive reschedule would leave
 * the original booking on Danielle's calendar alongside the new one.
 *
 * Required Supabase secrets:
 *   CALENDLY_PAT  – same Personal Access Token used by calendly-book
 *
 * Request body (POST JSON):
 *   event_uri  – the full Calendly scheduled_event URI that was returned by
 *                calendly-book and stored in orders.pickup_calendly_event_uri
 *                or orders.return_calendly_event_uri.
 *
 * Response:
 *   200 { cancelled: true }               – cancellation succeeded.
 *   200 { skipped: true, reason: string } – event URI is absent or from a
 *                                           fallback (non-direct) booking that
 *                                           has no corresponding API event.
 *                                           The caller should warn the user to
 *                                           cancel the old event in Calendly.
 *   400 { error }                         – missing or malformed event_uri.
 *   502 { error }                         – Calendly API returned an error.
 *   503 { error }                         – CALENDLY_PAT not configured.
 *   500 { error }                         – Unexpected error.
 *
 * Calendly plan note (same caveat as calendly-book):
 *   Direct API cancellation requires a Calendly Teams or Enterprise plan with
 *   the "booking API" feature enabled on your event type. If your account is
 *   on a lower plan, Calendly returns 403/405. The function handles this by
 *   returning 200 { skipped } so the reschedule still proceeds — but Danielle
 *   will need to cancel the old event manually in Calendly.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Extract the UUID from a full Calendly event URI.
 * e.g. "https://api.calendly.com/scheduled_events/XXXX" → "XXXX" */
function extractUuid(eventUri: string): string | null {
  if (!eventUri) return null;
  const idx = eventUri.lastIndexOf("/");
  const uuid = idx >= 0 ? eventUri.slice(idx + 1) : eventUri;
  // Basic sanity check — Calendly UUIDs are alphanumeric with hyphens, 36 chars
  return uuid.length >= 8 ? uuid : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const pat = Deno.env.get("CALENDLY_PAT");
    if (!pat) {
      return new Response(
        JSON.stringify({ error: "Calendly is not configured on this server." }),
        { status: 503, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { event_uri } = body as { event_uri?: string };

    if (!event_uri) {
      return new Response(
        JSON.stringify({ error: "event_uri is required." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const uuid = extractUuid(event_uri);
    if (!uuid) {
      // Likely a fallback scheduling URL rather than an API event URI —
      // nothing to cancel via the API.
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: "event_uri does not look like a Calendly scheduled_event URI. If the original booking was made via a scheduling link rather than the direct booking API, please cancel it in Calendly manually.",
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const cancelUrl =
      `https://api.calendly.com/scheduled_events/${uuid}/cancellation`;

    const resp = await fetch(cancelUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: "Customer rescheduled" }),
    });

    if (resp.ok) {
      return new Response(
        JSON.stringify({ cancelled: true }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // 403/405 mean the plan doesn't support direct booking/cancellation.
    // Return 200 { skipped } so the reschedule can still proceed — the caller
    // will surface a warning asking the user to cancel in Calendly manually.
    if (resp.status === 403 || resp.status === 405 || resp.status === 404) {
      const bodyText = await resp.text();
      console.warn(
        `calendly-cancel: Calendly returned ${resp.status} — likely non-direct-booking plan or event already cancelled. body: ${bodyText}`,
      );
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: `Calendly returned ${resp.status}. Your Calendly plan may not support direct API cancellation. Please cancel the previous booking manually in Calendly before the new one takes effect.`,
        }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const errorText = await resp.text();
    console.error("calendly-cancel: Calendly API error", resp.status, errorText);
    return new Response(
      JSON.stringify({
        error: `Calendly returned ${resp.status}. Check the PAT and event URI.`,
      }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("calendly-cancel error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
