// Next.js calls this for every unhandled server error. We forward it to the
// Developer console's error log (server runtime only; never throws).
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordServerError } = await import("@/lib/developer/errors");
    await recordServerError(err, request, context);
  } catch {
    /* error reporting must never cause errors */
  }
}
