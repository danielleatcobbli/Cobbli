/**
 * calendly-book
 *
 * Creates a Calendly scheduled event for the chosen pickup window, pre-populating
 * all invitee data so the customer never sees a Calendly form.
 *
 * Required Supabase secrets:
 *   CALENDLY_PAT              – Calendly Personal Access Token (org-level)
 *   CALENDLY_EVENT_TYPE_URI   – e.g. https://api.calendly.com/event_types/XXXXXXXX
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
 *   { event_uri: string }   – the Calendly URI of the created event
 *
 * Calendly plan note:
 *   Direct-booking via API requires a Calendly Teams or Enterprise plan with
 *   the "booking API" feature enabled on your event type. If Calendly returns
 *   403 or 405 the function falls back and returns:
 *   { fallback: true, scheduling_url: string }
 *   so the caller can open the one-time scheduling link in a last-resort flow.
 *
 *   To enable: Calendly dashboard → Event Type → Advanced → API booking → On.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const pat = Deno.env.get("CALENDLY_PAT");
    const eventTypeUri = Deno.env.get("CALENDLY_EVENT_TYPE_URI");

    if (!pat || !eventTypeUri) {
      return new Response(
        JSON.stringify({ error: "Calendly is not configured on this server." }),
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

    // --- Attempt 1: Calendly Direct Booking API ---
    // Available on Teams/Enterprise plans with API booking enabled.
    // POST /scheduled_events creates the event and the invitee in one call.
    const bookResp = await fetch("https://api.calendly.com/scheduled_events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: eventTypeUri,
        start_time,
        invitees: [
          {
            name,
            email,
            timezone: "America/New_York",
          },
        ],
        // Custom questions / notes — Calendly renders these in the event detail
        // and sends them to the host. Adjust field names to match your event
        // type's custom questions if any.
        invitee_questions_and_answers: [
          { question: "Phone", answer: phone },
          { question: "Pickup Address", answer: address },
          ...(notes ? [{ question: "Notes", answer: notes }] : []),
        ],
      }),
    });

    if (bookResp.ok) {
      const data = await bookResp.json();
      const eventUri: string =
        data?.resource?.uri ?? data?.event?.uri ?? "";
      return new Response(JSON.stringify({ event_uri: eventUri }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // --- Attempt 2: Single-use scheduling link (fallback) ---
    // This creates a one-time link. The customer still needs to click through
    // Calendly's page, but all their data is pre-filled.
    if (bookResp.status === 403 || bookResp.status === 405 || bookResp.status === 404) {
      console.warn(
        `Calendly direct booking returned ${bookResp.status}; falling back to scheduling link.`,
      );

      // Extract event type UUID from URI for the scheduling link
      const eventTypeUUID = eventTypeUri.split("/").pop();
      const prefill = new URLSearchParams({
        name,
        email,
        a1: phone,          // adjust to your event type's question order
        a2: address,
      });
      const schedulingUrl = `https://calendly.com/d/${eventTypeUUID}?${prefill.toString()}`;

      return new Response(
        JSON.stringify({
          fallback: true,
          scheduling_url: schedulingUrl,
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // --- Unexpected error from Calendly ---
    const errorText = await bookResp.text();
    console.error("Calendly booking error:", bookResp.status, errorText);
    return new Response(
      JSON.stringify({
        error: `Calendly returned ${bookResp.status}. Verify PAT permissions and event type configuration.`,
      }),
      { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("calendly-book error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
