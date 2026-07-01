// Resolves the email address to pre-populate on the password reset request
// screen. The email can arrive from three places: router state (lockout or
// "Forgot password?" hand-off) or a URL parameter (expired-link bounce).
// All inputs are untrusted, so every candidate is validated before use and the
// resolver falls back to an empty string rather than ever blocking the flow.

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalize = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return emailRegex.test(trimmed) ? trimmed : null;
};

const stripPrefix = (raw: string, prefix: string): string =>
  raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;

/**
 * Extracts a valid `email` parameter from a URL search and/or hash fragment.
 * The query string wins when both carry one. Returns null when absent or
 * malformed.
 */
export const extractEmailParam = (
  search: string,
  hash: string,
): string | null => {
  const fromSearch = new URLSearchParams(stripPrefix(search, "?")).get("email");
  const fromHash = new URLSearchParams(stripPrefix(hash, "#")).get("email");
  return normalize(fromSearch) ?? normalize(fromHash);
};

interface ResolveInitialEmailInput {
  stateEmail: string | null | undefined;
  urlEmail: string | null | undefined;
}

/**
 * Picks the initial reset-form email: a valid router-state email takes
 * precedence, then a valid URL email, otherwise an empty string.
 */
export const resolveInitialEmail = ({
  stateEmail,
  urlEmail,
}: ResolveInitialEmailInput): string =>
  normalize(stateEmail) ?? normalize(urlEmail) ?? "";

/**
 * Builds the password-reset redirect URL, carrying the email as a query param
 * so an expired-link bounce can re-populate the request form. Shared by the
 * sign-in lockout flow and the reset-request form so both stay in sync.
 * Omits the param entirely when no email is supplied.
 */
export const buildResetRedirect = (origin: string, email: string): string => {
  const base = `${origin}/reset-password`;
  const trimmed = email.trim();
  return trimmed ? `${base}?email=${encodeURIComponent(trimmed)}` : base;
};
