import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/rbac";
import { workingAsContext } from "@/lib/developer/context";
import { prisma } from "@/lib/db";
import {
  parseSubscription,
  pushConfigured,
  pushPublicKey,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/notifications/push";

// Phone / desktop pop-up alerts: which device wants them. The signed-in SESSION decides whose device it is
// (never the request body), exactly like /api/notifications.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
};
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE });

/** Can this server send pop-ups at all? Keys set + table present. Tells the bell whether to offer the switch. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!pushConfigured()) return json({ enabled: false });
  try {
    await prisma.pushSubscription.findFirst({ select: { id: true } }); // throws if the table is not there yet
  } catch {
    return json({ enabled: false });
  }
  // uid lets the device notice that a different person signed in on it (then it re-registers under them).
  return json({ enabled: true, publicKey: pushPublicKey(), uid: user.id });
}

/** Turn pop-ups on for this device. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  // A Developer working as someone must not hand their own phone to that person's alerts.
  if (await workingAsContext()) return json({ error: "Stop working as this account before turning on alerts." }, 409);
  if (!pushConfigured()) return json({ error: "Alerts are not set up on the server yet." }, 503);
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    /* empty body → rejected below */
  }
  const sub = parseSubscription(body);
  if (!sub) return json({ error: "That device could not be registered." }, 400);
  try {
    await savePushSubscription(user.id, sub, req.headers.get("user-agent"));
  } catch (e) {
    console.error("[push] subscribe failed", e instanceof Error ? e.message : e);
    return json({ error: "Alerts are not ready on the server yet." }, 503);
  }
  return json({ ok: true });
}

/** Turn pop-ups off for this device. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  let endpoint = "";
  try {
    const b = (await req.json()) as { endpoint?: unknown };
    endpoint = typeof b.endpoint === "string" ? b.endpoint : "";
  } catch {
    /* empty body → nothing to remove */
  }
  if (!endpoint) return json({ error: "Bad request" }, 400);
  try {
    await removePushSubscription(user.id, endpoint);
  } catch (e) {
    console.error("[push] unsubscribe failed", e instanceof Error ? e.message : e);
  }
  return json({ ok: true });
}
