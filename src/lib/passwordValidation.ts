export const PASSWORD_HELPER_TEXT =
  "Must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number or symbol.";

export const PASSWORD_ERRORS = {
  tooShort: "Password must be at least 8 characters.",
  missingComplexity:
    "Password must include an uppercase letter, a lowercase letter, and a number or symbol.",
  breached:
    "This password has appeared in a known data breach and isn't safe to use. Please choose a different one.",
} as const;

/**
 * Returns the first validation error message, or null if password meets all rules.
 * Order: length → complexity (uppercase + lowercase + number/symbol).
 */
export function validatePassword(password: string): string | null {
  if (password.length < 8) return PASSWORD_ERRORS.tooShort;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumOrSym = /[\d\W_]/.test(password);
  if (!hasUpper || !hasLower || !hasNumOrSym) return PASSWORD_ERRORS.missingComplexity;
  return null;
}

/**
 * Maps a Supabase auth error message to a user-friendly password error.
 * Returns null if the error is not password-related.
 */
export function mapSupabasePasswordError(message: string): string | null {
  const m = message.toLowerCase();
  if (
    m.includes("pwned") ||
    m.includes("breach") ||
    m.includes("compromised") ||
    m.includes("weak") ||
    m.includes("easy to guess")
  ) {
    return PASSWORD_ERRORS.breached;
  }
  if (m.includes("at least") && m.includes("character")) return PASSWORD_ERRORS.tooShort;
  if (m.includes("short")) return PASSWORD_ERRORS.tooShort;
  if (
    m.includes("uppercase") ||
    m.includes("lowercase") ||
    m.includes("number") ||
    m.includes("digit") ||
    m.includes("symbol") ||
    m.includes("special")
  )
    return PASSWORD_ERRORS.missingComplexity;
  if (m.includes("password")) return message; // fall back to raw if clearly password-related
  return null;
}
