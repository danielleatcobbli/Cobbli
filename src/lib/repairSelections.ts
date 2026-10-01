/**
 * Persists a customer's recommended-service selections for one repair
 * request across navigation (2026-10-02, Danielle's call — "verify that
 * selected alternatives and optional services survive leaving the page").
 *
 * Before this, RepairDetails.tsx / AssessmentProposal.tsx both held the
 * selection as plain component state, re-initialized to "every recommended
 * service pre-selected" every time the page's data-fetch effect ran — so
 * navigating away and back (or a sign-in redirect, which remounts the page)
 * silently reverted any service the customer had UNCHECKED back to checked.
 * Nothing was ever charged without a final explicit "accept"/"confirm"
 * click, so this never caused an unwanted charge — but it did mean a
 * customer's actual choice wasn't reliably what made it to checkout if they
 * navigated away first.
 *
 * sessionStorage (not localStorage) deliberately: this is a draft of an
 * in-progress decision for one visit, not account data to persist forever
 * or sync across devices — closing the tab and coming back later is
 * expected to start fresh, same as an unsubmitted form.
 */

const keyFor = (assessmentId: string) => `cobbli.repair.${assessmentId}.selectedRecommended`;

export const readSelectedRecommended = (assessmentId: string): Set<string> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(keyFor(assessmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : null;
  } catch {
    return null;
  }
};

export const writeSelectedRecommended = (assessmentId: string, selected: Set<string>) => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(keyFor(assessmentId), JSON.stringify(Array.from(selected)));
  } catch {
    /* ignore quota/availability errors — selection just won't survive navigation this time */
  }
};
