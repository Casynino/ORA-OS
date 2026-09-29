import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/rbac";
import {
  getInboxFor,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/services/notifications";

// The bell polls GET here; it must never be cached (stale = missed alert). Role
// is taken from the SESSION, never the client — each user only ever sees their
// own role-scoped inbox.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "CDN-Cache-Control": "no-store",
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const inbox = await getInboxFor({ id: user.id, role: user.role });
  return NextResponse.json(inbox, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  let body: { action?: string; id?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body → bad request below */
  }
  const me = { id: user.id, role: user.role };
  if (body.action === "readAll") {
    await markAllNotificationsRead(me);
  } else if (body.action === "read" && typeof body.id === "string") {
    await markNotificationRead(me, body.id);
  } else {
    return NextResponse.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
