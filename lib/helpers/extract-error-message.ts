/**
 * Extract a human-readable message from an unknown error.
 *
 * Supabase errors are the primary offender of the historical pattern:
 *   error instanceof Error ? error.message : "Une erreur est survenue"
 * because PostgrestError objects are plain objects (not Error instances),
 * so the ternary always falls into the generic fallback and swallows the
 * real cause. This helper recognises:
 *
 *   - Native Error instances                       → error.message
 *   - Supabase PostgrestError (code/details/hint)  → combined message
 *   - Plain objects with a `message` property      → that message
 *   - Plain strings                                → themselves
 *   - Everything else                              → fallback string
 *
 * Use this helper in catch blocks where you need a user-facing message
 * but cannot delegate to handleApiError() (e.g. to build a log line, or
 * to include the cause in a NextResponse body).
 *
 * For API routes that can throw, prefer lib/helpers/api-error.ts's
 * `handleApiError()` which also picks the correct HTTP status code.
 */

export interface ErrorLike {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
}

const DEFAULT_FALLBACK = "Une erreur est survenue";

function isErrorLike(value: unknown): value is ErrorLike {
  return typeof value === "object" && value !== null;
}

function pickString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

export function extractErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK
): string {
  // 1. Strings come straight through.
  const asString = pickString(error);
  if (asString) return asString;

  // 2. Native Error instances.
  if (error instanceof Error && error.message) {
    return error.message;
  }

  // 3. Supabase PostgrestError and similar {message, code, details, hint}
  //    Use the message when present; append code/details/hint when they
  //    add signal, matching the Supabase JS client format.
  if (isErrorLike(error)) {
    const message = pickString(error.message);
    const code = pickString(error.code);
    const details = pickString(error.details);
    const hint = pickString(error.hint);

    if (message) {
      const parts = [message];
      if (code) parts.push(`(${code})`);
      if (details && details !== message) parts.push(`— ${details}`);
      if (hint) parts.push(`— ${hint}`);
      return parts.join(" ");
    }

    // Some errors only carry a code (e.g. PGRST116 without message).
    if (code) {
      return `Erreur base de données : ${code}`;
    }
  }

  // 4. Fallback.
  return fallback;
}
