import "server-only";

/**
 * Guard for the /api/cron/* routes. The external scheduler must present the
 * shared secret either as `?secret=...` or an `Authorization: Bearer ...` header.
 * If CRON_SECRET is unset, everything is denied (fail closed).
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const qs = new URL(req.url).searchParams.get("secret");
  const auth = req.headers.get("authorization");
  return qs === secret || auth === `Bearer ${secret}`;
}
