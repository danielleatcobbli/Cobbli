/**
 * PickupScheduler
 *
 * Shows available pickup windows pulled live from Calendly.
 * – 90-minute windows; the full time range (start → end) is displayed.
 * – Date tabs: up to 7 days; only dates that have at least one window.
 * – Window data comes from the `calendly-availability` Supabase edge function.
 * – Selecting a window is a local UI state change only — no re-fetch occurs
 *   until the parent explicitly calls refresh (e.g. at checkout confirm).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

// ---------- types ----------

export type PickupWindow = {
  /** ISO 8601 UTC string */
  start_time: string;
  /** ISO 8601 UTC string (start + 90 min) */
  end_time: string;
};

type DateGroup = {
  /** YYYY-MM-DD key in the service timezone */
  key: string;
  /** "Today" | "Tomorrow" | "Mon Jul 8" */
  label: string;
  windows: PickupWindow[];
};

interface PickupSchedulerProps {
  /** Called whenever the user picks (or clears) a window. */
  onSelect: (window: PickupWindow | null) => void;
  /** Currently-selected window (controlled by parent). */
  selected: PickupWindow | null;
  /** If true, shows a "no availability" placeholder instead of fetching. */
  disabled?: boolean;
}

// ---------- constants ----------

const TZ = "America/New_York";
const LOOK_AHEAD_DAYS = 7;

// ---------- helpers ----------

function toLocalDateKey(isoUtc: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(
    new Date(isoUtc),
  );
}

function buildDateLabel(key: string): string {
  // key is "YYYY-MM-DD" in TZ
  const [y, m, d] = key.split("-").map(Number);
  // Build a Date at noon local time to avoid DST edge cases
  const dateInTz = new Date(`${key}T12:00:00`);

  const todayKey = toLocalDateKey(new Date().toISOString());
  const tomorrowKey = (() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return toLocalDateKey(t.toISOString());
  })();

  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";

  // "Mon Jul 8"
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TZ,
  }).format(dateInTz);
}

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: TZ,
    })
      .format(new Date(iso))
      .replace(":00", ":00"); // keep zero minutes explicit

  const startStr = fmt(startIso); // e.g. "9:00 AM"
  const endStr = fmt(endIso);     // e.g. "10:30 AM"

  // Compress "9:00 AM – 10:30 AM" → "9:00 – 10:30 AM" when both share period
  const startPeriod = startStr.slice(-2); // "AM" or "PM"
  const endPeriod = endStr.slice(-2);

  if (startPeriod === endPeriod) {
    const startTime = startStr.slice(0, -3); // strip " AM"
    return `${startTime} – ${endStr}`;
  }
  return `${startStr} – ${endStr}`;
}

function groupByDate(windows: PickupWindow[]): DateGroup[] {
  const map = new Map<string, PickupWindow[]>();
  for (const w of windows) {
    const key = toLocalDateKey(w.start_time);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }
  // Sort dates ascending, then sort windows within each date ascending
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ws]) => ({
      key,
      label: buildDateLabel(key),
      windows: ws.sort((a, b) =>
        a.start_time.localeCompare(b.start_time),
      ),
    }));
}

// ---------- component ----------

export function PickupScheduler({
  onSelect,
  selected,
  disabled = false,
}: PickupSchedulerProps) {
  const [loading, setLoading] = useState(!disabled);
  const [error, setError] = useState<string | null>(null);
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const fetchCountRef = useRef(0);

  const fetchAvailability = useCallback(async () => {
    if (disabled) return;
    setLoading(true);
    setError(null);
    const fetchId = ++fetchCountRef.current;

    try {
      const now = new Date();
      const endDate = new Date(
        now.getTime() + LOOK_AHEAD_DAYS * 24 * 60 * 60 * 1000,
      );

      const { data, error: fnError } = await supabase.functions.invoke(
        "calendly-availability",
        {
          body: {
            start_time: now.toISOString(),
            end_time: endDate.toISOString(),
          },
        },
      );

      if (fetchId !== fetchCountRef.current) return; // stale
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      const groups = groupByDate((data?.windows ?? []) as PickupWindow[]);
      setDateGroups(groups);

      // Default to first available date (or stay on current if still present)
      setActiveDateKey((prev) => {
        const keys = groups.map((g) => g.key);
        if (prev && keys.includes(prev)) return prev;
        return keys[0] ?? null;
      });
    } catch (err: unknown) {
      if (fetchId !== fetchCountRef.current) return;
      setError(
        err instanceof Error ? err.message : "Could not load pickup times.",
      );
    } finally {
      if (fetchId === fetchCountRef.current) setLoading(false);
    }
  }, [disabled]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  const activeGroup =
    dateGroups.find((g) => g.key === activeDateKey) ?? null;

  // ---------- render ----------

  if (disabled) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Complete the previous steps to schedule your pickup.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border p-6 flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <RefreshCw size={20} className="animate-spin opacity-60" />
        Loading available pickup times…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-5 space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={fetchAvailability}
          className="text-sm text-primary underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    );
  }

  if (dateGroups.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-6 space-y-3 text-center">
        <Calendar size={24} className="mx-auto text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          No pickup windows are available in the next {LOOK_AHEAD_DAYS} days.
          Check back soon or contact us for assistance.
        </p>
        <button
          type="button"
          onClick={fetchAvailability}
          className="text-sm text-primary underline underline-offset-4"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date tabs */}
      <div className="flex gap-2 flex-wrap">
        {dateGroups.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setActiveDateKey(g.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap",
              activeDateKey === g.key
                ? "border-primary text-primary bg-primary/5"
                : "border-border text-foreground/70 hover:border-primary/50 hover:text-foreground",
            )}
          >
            {g.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            onSelect(null);
            fetchAvailability();
          }}
          className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Refresh availability"
          title="Refresh availability"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* Time windows for the active date */}
      {activeGroup && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {activeGroup.windows.map((w) => {
            const isSelected = selected?.start_time === w.start_time;
            return (
              <button
                key={w.start_time}
                type="button"
                onClick={() => onSelect(isSelected ? null : w)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 text-primary font-medium"
                    : "border-border text-foreground hover:border-primary/50 hover:bg-accent/20",
                )}
              >
                <Clock
                  size={15}
                  className={cn(
                    "shrink-0",
                    isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                />
                {formatTimeRange(w.start_time, w.end_time)}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <p className="text-xs text-muted-foreground">
          Your selected window will be confirmed when you place your order.
        </p>
      )}
    </div>
  );
}
