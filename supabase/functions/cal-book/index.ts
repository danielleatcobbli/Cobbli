/**
 * cal-book
 *
 * Creates a Cal.com booking for the chosen pickup window, pre-populating all
 * attendee data so the customer never sees a Cal.com booking form.
 * Maintains the same request/response shape as the old calendly-book function
 * so Checkout.tsx needs no changes beyond swapping the function name.
 *
 * Required Supabase secrets:
 *   CAL_API_KEY          – Cal.com API key (Settings → Security → API Keys)
 *   CAL_EVENT_TYPE_ID    – Numeric ID of the "Cobbli Pickup & Return" event type
 *
 * Request body (POST JSON):
 *   start_time  – ISO 8601 UTC string (the selected pickup window start)
 *   name        – Customer full name
 *   email       – Customer email
 *   phone       – Customer phone number
 *   address     – Formatted pickup address string
 *   notes       – Any extra notes (optional)
 *
 * Response JSON on success:
 *   { event_uri: string }  – the Cal.com booking UID (stored in
 *                             orders.pickup_calendly_event_uri for use by
 *                             cal-cancel on reschedule)
 *
 * Cal.com API version: 2024-08-13
 * Docs: https://cal.com/docs/api-reference/v2/bookings/create-a-booking
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
const TIMEZONE = "America/New_York";

interface BookRequest {
  start_time: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const apiKey = Deno.env.get("CAL_API_KEY");
    const eventTypeIdStr = Deno.env.get("CAL_EVENT_TYPE_ID");

    if (!apiKey || !eventTypeIdStr) {
      return new Response(
        JSON.stringify({ error: "Cal.com is not configured on this server." }),
        { status: 503, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const eventTypeId = Number(eventTypeIdStr);
    if (isNaN(eventTypeId)) {
      return new Response(
        JSON.stringify({ error: "CAL_EVENT_TYPE_ID must be a number." }),
        { status: 503, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const {
      start_time,
      name,
      email,
      phone,
      address,
      notes = "",
    } = (await req.json()) as BookRequest;

    if (!start_time || !name || !email || !phone) {
      return new Response(
        JSON.stringify({ error: "start_time, name, email, and phone are required." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // Cal.com v2 bookings use an attendee object rather than Calendly's
    // invitees/questions-and-answers shape — this is a real rewrite, not a
    // find-and-replace.
    //
    // Address: confirmed directly against Cal.com's v2 API schema
    // (BookingInputAttendeeAddressLocation_2024_08_13) that the event type's
    // "In Person (Attendee Address)" location is populated via a top-level
    // `location: { type: "attendeeAddress", address }` object — NOT metadata.
    // Metadata is an invisible data bucket that never renders anywhere on the
    // booking; this was the actual reason the address wasn't showing up.
    const bookResp = await fetch(`${CAL_BASE_URL}/v2/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": CAL_API_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventTypeId,
        start: start_time,
        attendee: {
          name,
          email,
          timeZone: TIMEZONE,
          phoneNumber: phone,
        },
        location: {
          type: "attendeeAddress",
          address,
        },
        // "notes" is a built-in booking-form field on the event type (not a
        // free-form metadata bucket) — pass it via bookingFieldsResponses so
        // it shows up as an actual field on the booking, same as address now
        // does via location.
        ...(notes && { bookingFieldsResponses: { notes } }),
      }),
    });

    if (bookResp.ok) {
      const data = await bookResp.json();
      // Cal.com returns data.uid (the booking's unique identifier). We store
      // this as event_uri to match the interface expected by Checkout.tsx and
      // the orders table (pickup_calendly_event_uri column).
      const uid: string = data?.data?.uid ?? data?.uid ?? "";
      return new Response(JSON.stringify({ event_uri: uid }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const errorText = await bookResp.text();
    console.error("Cal.com booking error:", bookResp.status, errorText);
    return new Response(
      JSON.stringify({
        error: `Cal.com returned ${bookResp.status}. Verify your API key and event type configuration.`,
      }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("cal-book error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
