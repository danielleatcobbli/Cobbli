// Decides what happens to the device-local bag when a user signs in.
//
// The bag lives in a single localStorage key shared across every user of the
// device, so signing in as a different person must not expose the previous
// user's bag. The rule:
//
//   - Same user signing in again (token refresh / return visit) -> keep.
//   - No previously authenticated user on this device -> keep (covers a fresh
//     device and the guest-who-just-created-their-account case).
//   - A different user signs in -> clear, UNLESS the sign-in email matches the
//     email captured during the guest assessment flow (guest → own account
//     migration), in which case keep.
//
// This is a pure function so the branching is unit-testable in isolation; the
// caller (AuthContext) is responsible for reading/writing the localStorage
// markers and actually clearing the bag.

export type BagAction = "keep" | "clear";

interface DecideBagActionInput {
  /** The last user id seen signing in on this device, or null if none. */
  previousUserId: string | null | undefined;
  /** The user id that just signed in. */
  newUserId: string;
  /** The email of the user that just signed in. */
  newUserEmail: string | null | undefined;
  /** Email captured during a guest assessment flow, if any. */
  guestEmail: string | null | undefined;
}

const normalizeEmail = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
};

export const decideBagAction = ({
  previousUserId,
  newUserId,
  newUserEmail,
  guestEmail,
}: DecideBagActionInput): BagAction => {
  // No previous user on this device: nothing to protect against — keep.
  if (!previousUserId) return "keep";

  // Same user returning: keep their bag.
  if (previousUserId === newUserId) return "keep";

  // Different user: keep only if this is a guest → own-account migration,
  // i.e. the sign-in email matches the email entered as a guest.
  const guest = normalizeEmail(guestEmail);
  const signInEmail = normalizeEmail(newUserEmail);
  if (guest && signInEmail && guest === signInEmail) return "keep";

  return "clear";
};

// localStorage markers backing the decision above. Kept here so BagContext and
// the guest checkout flow reference the same keys.
export const LAST_USER_ID_KEY = "cobbli.last-user-id";
export const GUEST_EMAIL_KEY = "cobbli.guest-email";

const safeGet = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota / unavailable storage */
  }
};

const safeRemove = (key: string): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

export const readLastUserId = (): string | null => safeGet(LAST_USER_ID_KEY);
export const writeLastUserId = (id: string): void => safeSet(LAST_USER_ID_KEY, id);

export const readGuestEmail = (): string | null => safeGet(GUEST_EMAIL_KEY);
/** Persist the email a guest entered so a later sign-in can migrate their bag. */
export const rememberGuestEmail = (email: string): void => {
  const trimmed = email.trim();
  if (trimmed) safeSet(GUEST_EMAIL_KEY, trimmed);
};
export const clearGuestEmail = (): void => safeRemove(GUEST_EMAIL_KEY);
