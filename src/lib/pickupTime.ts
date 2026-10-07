/**
 * pickupTime
 *
 * Date/time formatting + the "within 2 hours" self-service-reschedule cutoff
 * for pickup/return windows. Lifted out of OrderConfirmation.tsx (2026-10-01)
 * so the new Repair Details page can share the exact same logic rather than
 * duplicating (and risking drifting from) it.
 */

const NY_TZ = "America/New_York";

/** YYYY-MM-DD in New York local time from a UTC ISO string. */
export function toNyDateKey(isoUtc: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: NY_TZ }).format(new Date(isoUtc));
}

/** "9:00 – 10:30 AM" or "11:30 AM – 1:00 PM" from two UTC ISO strings.
 *  Mirrors PickupScheduler.tsx's formatTimeRange() and the stripe-webhook helper. */
export function formatNyTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: NY_TZ })
      .format(new Date(iso));
  const startStr = fmt(startIso);
  const endStr = fmt(endIso);
  const startPeriod = startStr.slice(-2);
  const endPeriod = endStr.slice(-2);
  return startPeriod === endPeriod ? `${startStr.slice(0, -3)} – ${endStr}` : `${startStr} – ${endStr}`;
}

/** "Mon Jul 14" from a YYYY-MM-DD date key. */
export function fmtDateKey(dateKey: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" })
    .format(new Date(`${dateKey}T12:00:00`));
}

/** Returns true when the scheduled window is within 2 hours of starting —
 *  used to lock out customer self-service reschedules. Also true once the
 *  window has started, so callers must check this ONLY for appointments
 *  they already know are upcoming (e.g. gated behind "not yet picked up" /
 *  "not yet returned") — this function alone can't distinguish "starting
 *  soon" from "already long past," it only tells you "too close to touch."
 *  Uses the browser's local time as an approximation — acceptable for a
 *  customer-facing cutoff where a few minutes of drift is not material. */
export function isWithin2Hours(dateKey: string | null, timeLabel: string | null): boolean {
  if (!dateKey || !timeLabel) return false;
  const dashIdx = timeLabel.indexOf(" – ");
  if (dashIdx === -1) return false;
  const startToken = timeLabel.slice(0, dashIdx).trim();      // "9:00" or "11:30 AM"
  const endToken = timeLabel.slice(dashIdx + 3).trim();        // "10:30 AM" or "1:00 PM"
  const startFull = /[AP]M$/i.test(startToken) ? startToken : `${startToken} ${endToken.slice(-2)}`;
  // Parse start time into hours/minutes
  const [timePart, period] = startFull.split(" ");
  const [h, m] = timePart.split(":").map(Number);
  let hour24 = h;
  if (period === "PM" && h !== 12) hour24 = h + 12;
  if (period === "AM" && h === 12) hour24 = 0;
  // Build approximate start Date in local time (fine for a 2-hour cutoff check)
  const startDt = new Date(
    `${dateKey}T${String(hour24).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}:00`,
  );
  if (isNaN(startDt.getTime())) return false;
  return Date.now() > startDt.getTime() - 2 * 60 * 60 * 1000;
}
