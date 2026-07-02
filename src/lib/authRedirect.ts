/**
 * Persistent return-to URL for the sign-in flow. Stored in sessionStorage so
 * it survives full-page OAuth redirects (e.g. Google) that wipe React state.
 *
 * Always store a same-origin path (path + optional search/hash). Never store
 * absolute URLs from untrusted sources.
 */

const KEY = "cobbli.auth.returnTo";

/** Sanitize to a same-origin relative path starting with "/" and not "//". */
const sanitize = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (typeof path !== "string") return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  return path;
};

export const saveReturnTo = (path: string | null | undefined) => {
  const safe = sanitize(path);
  if (!safe) return;
  try {
    window.sessionStorage.setItem(KEY, safe);
  } catch {
    /* ignore */
  }
};

export const peekReturnTo = (): string | null => {
  try {
    return sanitize(window.sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
};

export const consumeReturnTo = (): string | null => {
  const v = peekReturnTo();
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return v;
};

export const clearReturnTo = () => {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};
