/** Standard result shape returned by every server action. */
export type ActionResult<T = unknown> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const ok = <T>(data?: T, message?: string): ActionResult<T> => ({
  ok: true,
  data,
  message,
});

export const fail = (
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> => ({ ok: false, error, fieldErrors });

export function errorMessage(
  e: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return e instanceof Error ? e.message : fallback;
}
