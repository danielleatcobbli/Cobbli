/**
 * calendly-availability
 *
 * Proxies Calendly's GET /event_type_available_times endpoint so the API key
 * never reaches the browser.
 *
 * Required Supabase secrets (set via `supabase secrets set KEY=value`):
 *   CALENDLY_PAT              – Calendly Personal Access Token
 *   CALENDLY_EVENT_TYPE_URI   – e.g. https://api.calendly.com/event_types/XXXXXXXX
 *
 * Request body (POST JSON):
 *   start_time  – ISO 8601 string, start of the search window (UTC)
 *   end_time    – ISO 8601 string, end of the search window (UTC)
 *
 * Response JSON:
 *   { windows: Array<{ start_time: string; end_time: string }> }
 *   where end_time = start_time + WINDOW_DURATION_MINUTES
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WINDOW_DURATION_MS = 90 * 60 * 1000; // 90-minute pickup windows

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

    const body = await req.json().catch(() => ({}));
    const { start_time, end_time } = body as {
      start_time?: string;
      end_time?: string;
    };

    const url = new URL(
      "https://api.calendly.com/event_type_available_times",
    );
    url.searchParams.set("event_type", eventTypeUri);
    // Default: today → today + 7 days
    url.searchParams.set(
      "start_time",
      start_time ?? new Date().toISOString(),
    );
    url.searchParams.set(
      "end_time",
      end_time ??
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    );

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Calendly API error:", resp.status, text);
      return new Response(
        JSON.stringify({
          error: `Calendly returned ${resp.status}. Check your PAT and event type URI.`,
        }),
        {
          status: 502,
          headers: { ...CORS, "Content-Type": "application/json" },
        },
      );
    }

    const data = await resp.json();

    // Only include slots that Calendly marks as available.
    // end_time is computed here (Calendly only returns start_time for
    // available_times; event duration is encoded in the event type config).
    const windows = (data.collection ?? [])
      .filter((s: { status: string }) => s.status === "available")
      .map((s: { start_time: string }) => ({
        start_time: s.start_time,
        end_time: new Date(
          new Date(s.start_time).getTime() + WINDOW_DURATION_MS,
        ).toISOString(),
      }));

    return new Response(JSON.stringify({ windows }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("calendly-availability error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
