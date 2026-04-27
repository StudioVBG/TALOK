/**
 * Unwrap a list payload from the standard Talok API envelope.
 *
 * The convention server-side is `{ success, data: { <key>: [...] } }` but a
 * handful of older routes return `{ success, data: [...] }` or even the raw
 * array. Consumers that called `.find` / `.map` directly on `response?.data`
 * crashed when the wrapper changed shape (see /owner/accounting/exports
 * where `H.find is not a function` tripped the owner error boundary). This
 * helper centralises the three cases so the call site is a single line and
 * regressions stay contained.
 *
 * Pass `key` when the array lives under `data.<key>` (e.g. `accesses`,
 * `exercises`). Omit it when the array is at `data` directly.
 */
export function unwrapList<T>(response: unknown, key?: string): T[] {
  if (Array.isArray(response)) return response as T[];
  if (!response || typeof response !== "object") return [];
  const data = (response as { data?: unknown }).data;
  if (Array.isArray(data)) return data as T[];
  if (key && data && typeof data === "object") {
    const inner = (data as Record<string, unknown>)[key];
    if (Array.isArray(inner)) return inner as T[];
  }
  return [];
}
