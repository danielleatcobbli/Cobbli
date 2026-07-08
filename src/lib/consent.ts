// Cookie consent helpers. We treat analytics (GA4) as a non-essential cookie
// that requires explicit opt-in before any tracking script is loaded.

export type ConsentValue = "accepted" | "declined";
const STORAGE_KEY = "cobbli.cookie-consent.v1";
const EVENT = "cobbli:consent-change";

export const getConsent = (): ConsentValue | null => {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "accepted" || v === "declined" ? v : null;
};

export const setConsent = (v: ConsentValue) => {
  window.localStorage.setItem(STORAGE_KEY, v);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
  if (v === "accepted") loadAnalytics();
  else removeAnalytics();
};

export const onConsentChange = (cb: (v: ConsentValue) => void) => {
  const handler = (e: Event) => cb((e as CustomEvent<ConsentValue>).detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
};

// --- GA4 loader (only fires after consent === "accepted") ---
const GA_MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined) ?? "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const loadAnalytics = () => {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  if (document.getElementById("ga4-script")) return;

  const s = document.createElement("script");
  s.id = "ga4-script";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // GA4's gtag.js requires the raw `arguments` object here, not a spread
    // array — plain arrays are treated as data pushes and ignored as commands.
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    // debug_mode routes events to GA4 DebugView — dev only so it doesn't
    // pollute production reports.
    ...(import.meta.env.DEV ? { debug_mode: true } : {}),
  });
};

export const removeAnalytics = () => {
  if (typeof document === "undefined") return;
  document.getElementById("ga4-script")?.remove();
  // Best-effort: drop any GA cookies for this host
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name.startsWith("_ga") || name === "_gid") {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${window.location.hostname}`;
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  });
};

export const initConsent = () => {
  if (getConsent() === "accepted") loadAnalytics();
};
