// GA4 event tracking helpers.
// All calls are no-ops when the user hasn't accepted cookies or when
// GA_MEASUREMENT_ID is not configured (gtag won't be on window).

export type AnalyticsEvent =
  | "start_repair"
  | "pair_confirmed"
  | "service_added"
  | "repair_added_to_bag"
  | "checkout_started"
  | "order_placed"
  | "account_created"
  | "sign_in"
  | "consultation_email_clicked";

export function trackEvent(
  event: AnalyticsEvent,
  params?: Record<string, unknown>,
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", event, params ?? {});
}
