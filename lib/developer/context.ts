import "server-only";
import { auth } from "@/auth";

/**
 * If the current request is a Developer working as a staff member, who is REALLY
 * behind it. Used wherever something is recorded or announced (activity log,
 * in-app alerts, WhatsApp) so it never reads as the person's own doing.
 * Returns null outside a request (cron / scripts) or when not working-as.
 */
export async function workingAsContext(): Promise<{
  developer: { id: string; name: string };
  as: { id: string; name: string };
} | null> {
  try {
    const u = (await auth())?.user;
    return u?.impersonatedBy ? { developer: u.impersonatedBy, as: { id: u.id, name: u.name ?? "" } } : null;
  } catch {
    return null;
  }
}
