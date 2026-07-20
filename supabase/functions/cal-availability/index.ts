/**
 * cal-availability
 *
 * Proxies Cal.com's GET /v2/slots/available endpoint so the API key never
 * reaches the browser. Maintains the same request/response shape as the
 * old calendly-availability function so PickupScheduler.tsx needs no changes
 * beyond swapping the function name.
 *
 * Required Supabase secrets (set via `supabase secrets set KEY=value`):
 *   CAL_API_KEY          – Cal.com API key (Settings → Security → API Keys)
 *   CAL_EVENT_TYPE_ID    – Numeric ID of the "Cobbli Pickup & Return" event type
 *                          (visible in the URL when you open the event type in
 *                          the Cal.com dashboard, or via GET /v2/event-types)
 *
 * Request body (POST JSON):
 *   start_time  – ISO 8601 UTC string, start of the search window
 *   end_time    – ISO 8601 UTC string, end of the search window
 *
 * Response JSON:
 *   { windows: Array<{ start_time: string; end_time: string }> }
 *
 * Cal.com API version: 2024-08-13
 * Docs: https://cal.com/docs/api-reference/v2/slots/get-available-slots
 *
 * NOTE: Cal.com's real response (confirmed live, 2026-07-15) nests each slot
 * as { startTime, endTime } — NOT { start, end } as originally assumed. Fixed
 * after tracing a live 500 (Object.values(...).map(s => s.start) was reading
 * an undefined field, then .sort() crashed calling .localeCompare() on
 * undefined). Keep reading startTime/endTime here.
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
const LOOK_AHEAD_DAYS = 7;

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

    const body = await req.json().catch(() => ({}));
    const { start_time, end_time } = body as {
      start_time?: string;
      end_time?: string;
    };

    const startTime = start_time ?? new Date().toISOString();
    // +1 day buffer, matching the same fix applied in PickupScheduler.tsx —
    // this default is only used when a caller omits end_time (the front end
    // always sends one explicitly), but kept consistent for defense-in-depth.
    const endTime =
      end_time ?? new Date(Date.now() + (LOOK_AHEAD_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();

    const url = new URL(`${CAL_BASE_URL}/v2/slots/available`);
    url.searchParams.set("startTime", startTime);
    url.searchParams.set("endTime", endTime);
    url.searchParams.set("eventTypeId", String(eventTypeId));
    // slotFormat=range returns { startTime, endTime } pairs directly — no manual
    // duration computation needed (unlike Calendly which only returned start).
    url.searchParams.set("slotFormat", "range");

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "cal-api-version": CAL_API_VERSION,
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Cal.com availability error:", resp.status, text);
      return new Response(
        JSON.stringify({
          error: `Cal.com returned ${resp.status}. Check your API key and event type ID.`,
        }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const calData = await resp.json();

    // Cal.com response with slotFormat=range:
    // {
    //   status: "success",
    //   data: {
    //     slots: {
    //       "2026-07-15": [{ startTime: "...ISO...", endTime: "...ISO..." }, ...],
    //       "2026-07-16": [...],
    //       ...
    //     }
    //   }
    // }
    // Flatten all date groups into the flat windows array that PickupScheduler expects.
    const slotsMap: Record<string, { startTime: string; endTime: string }[]> =
      calData?.data?.slots ?? {};

    const windows = Object.values(slotsMap)
      .flat()
      .map((s) => ({ start_time: s.startTime, end_time: s.endTime }))
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    return new Response(JSON.stringify({ windows }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("cal-availability error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
