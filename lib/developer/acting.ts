import type { Role, UserStatus } from "@prisma/client";

/**
 * "Work as" — the Developer can open a staff member's dashboard (with that
 * person's real permissions and data) without knowing their password. The rules:
 *   • only a real DEVELOPER session can start it (re-checked on every request),
 *   • any ACTIVE account — the owner (Admin), team and partners — but never
 *     another Developer and never yourself,
 *   • everything done while working-as is written to the activity log as
 *     "<Developer> (Developer) as <person>" — never as the person alone,
 *   • while working as someone you have THEIR full access: you can change, add and edit
 *     anything they can, including passwords, login emails and new accounts (the owner's
 *     decision). The only things that still apply are the audit label above, the owner being
 *     told when you start, Stop, and the automatic end after 4 hours.
 */
/** What the session token remembers while a Developer is working as someone. */
export type ActAs = {
  id: string;
  role: Role;
  name: string;
  email: string;
  /** When working-as started (ms) — for the 4h limit. */
  at: number;
  /** The DEV_ACT_START audit row that opened it. Pressing Stop (a newer START/STOP row) revokes every copy of the cookie. */
  aid: string;
  /** The target's sessionVersion at start — the person's own "sign out of all devices" ends the Developer's session too. */
  tsv: number;
};

/** Working-as ends by itself after this long (a forgotten session can't linger or resume days later). */
export const WORK_AS_MAX_MS = 4 * 60 * 60 * 1000;

export const ACTABLE_ROLES: readonly Role[] = ["ADMIN", "FINANCE", "WAREHOUSE", "SALES_REP", "PARTNER"];

export function canWorkAs(target: { id: string; role: Role; status: UserStatus }, developerId: string): boolean {
  return target.id !== developerId && target.status === "ACTIVE" && ACTABLE_ROLES.includes(target.role);
}
