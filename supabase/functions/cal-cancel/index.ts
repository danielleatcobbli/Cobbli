/**
 * cal-cancel
 *
 * Cancels a previously-booked Cal.com event so the reschedule flow can
 * replace it with a new one. Maintains the same request/response shape as the
 * old calendly-cancel function so OrderConfirmation.tsx needs no changes
 * beyond swapping the function name.
 *
 * Required Supabase secrets:
 *   CAL_API_KEY  – same key used by cal-book
 *
 * Request body (POST JSON):
 *   event_uri  – the Cal.com booking UID returned by cal-book and stored in
 *                orders.pickup_calendly_event_uri or
 *                orders.return_calendly_event_uri.
 *
 * Response:
 *   200 { cancelled: true }               – cancellation succeeded.
 *   200 { skipped: true, reason: string } – event_uri absent or blank.
 *   400 { error }                         – missing event_uri.
 *   502 { error }                         – Cal.com API returned an error.
 *   503 { error }                         – CAL_API_KEY not configured.
 *   500 { error }                         – Unexpected error.
 *
 * Cal.com API version: 2024-08-13
 * Docs: https://cal.com/docs/api-reference/v2/bookings/cancel-a-booking
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CAL_API_VERSION = "2024-08-13";
const CAL_BASE_URL = "https://api.cal.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const apiKey = Deno.env.get("CAL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Cal.com is not configured on this server." }),
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

    // For Cal.com, event_uri is just the booking UID (no URL prefix).
    // If for some reason it looks like a full URL (e.g. from an old Calendly
    // migration that stored a URI), extract the last path segment.
    const uid = event_uri.includes("/") ? event_uri.split("/").pop() ?? event_uri : event_uri;

    if (!uid) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Could not extract a booking UID from the provided event_uri." }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const cancelResp = await fetch(`${CAL_BASE_URL}/v2/bookings/${uid}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": CAL_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ cancellationReason: "Customer rescheduled" }),
    });

    if (cancelResp.ok) {
      return new Response(
        JSON.stringify({ cancelled: true }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // 404 = booking already cancelled or doesn't exist — treat as no-op.
    if (cancelResp.status === 404) {
      console.warn(`cal-cancel: booking ${uid} not found — may already be cancelled.`);
      return new Response(
        JSON.stringify({ cancelled: true }),
        { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const errorText = await cancelResp.text();
    console.error("cal-cancel: Cal.com error", cancelResp.status, errorText);
    return new Response(
      JSON.stringify({ error: `Cal.com returned ${cancelResp.status}. Check the API key and booking UID.` }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("cal-cancel error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
