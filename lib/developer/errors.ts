import "server-only";
import { prisma } from "@/lib/db";

/**
 * Technical event recorder for the Developer console (server errors + failed
 * sign-ins). Hard rules:
 *  • NEVER throws and never slows the request down meaningfully,
 *  • never stores request bodies, cookies, headers or query strings,
 *  • is rate-limited so an error loop or a password-guessing bot can't flood the
 *    database (same event at most once a minute per server instance — repeats are counted and carried
 *    on the next row — and 40 rows/minute total),
 *  • does nothing (and stops trying for 45 seconds) while the SystemEvent table
 *    doesn't exist yet — tracking is switched on from the Developer console.
 */

export type SystemEventInput = {
  kind: "SERVER_ERROR" | "LOGIN_FAILED";
  message: string;
  path?: string | null;
  method?: string | null;
  digest?: string | null;
  detail?: string | null;
  ip?: string | null;
};

const seen = new Map<string, { ts: number; suppressed: number }>();
let windowStart = 0;
let windowCount = 0;
let pausedUntil = 0;

const clip = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);

/** Called right after the table is created so recording starts immediately. */
export function resumeTracking() {
  pausedUntil = 0;
}

export async function recordSystemEvent(e: SystemEventInput): Promise<void> {
  try {
    const now = Date.now();
    if (now < pausedUntil) return;
    if (now - windowStart > 60_000) {
      windowStart = now;
      windowCount = 0;
    }
    if (windowCount >= 40) return;
    const key = `${e.kind}|${e.digest ?? e.message}|${e.path ?? ""}|${e.kind === "LOGIN_FAILED" ? e.ip ?? "" : ""}`;
    const prev = seen.get(key);
    if (prev && now - prev.ts < 60_000) {
      prev.suppressed++; // counted, then carried on the next row for this event
      return;
    }
    if (seen.size > 300) seen.clear();
    const repeats = prev?.suppressed ?? 0;
    seen.set(key, { ts: now, suppressed: 0 });
    windowCount++;
    await prisma.systemEvent.create({
      data: {
        kind: e.kind,
        message: clip(e.message, 300) ?? "Unknown",
        path: clip(e.path?.split("?")[0], 200),
        method: clip(e.method, 10),
        digest: clip(e.digest, 80),
        detail: clip(e.detail, 1500),
        ip: clip(e.ip, 64),
        count: 1 + repeats,
      },
    });
  } catch {
    // Table not created yet (or DB hiccup): back off quietly.
    pausedUntil = Date.now() + 45_000;
  }
}

/** Called by Next's instrumentation hook for every unhandled server error. */
export async function recordServerError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
): Promise<void> {
  const error = err as { message?: string; digest?: string; stack?: string } | null;
  const message = error?.message ?? String(err);
  // Redirects / not-found are normal control flow, not problems.
  if (/NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR/.test(message) || error?.digest?.startsWith?.("NEXT_")) return;
  await recordSystemEvent({
    kind: "SERVER_ERROR",
    message,
    path: context.routePath || request.path,
    method: request.method,
    digest: error?.digest ?? null,
    detail: [context.routeType ? `type: ${context.routeType}` : null, error?.stack?.split("\n").slice(0, 8).join("\n")]
      .filter(Boolean)
      .join("\n"),
  });
}
