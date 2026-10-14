import type { Role, UserStatus } from "@prisma/client";

/**
 * "Work as" — the Developer can open a staff member's dashboard (with that
 * person's real permissions and data) without knowing their password. The rules:
 *   • only a real DEVELOPER session can start it (re-checked on every request),
 *   • only these ACTIVE staff roles — never the business owner's Admin account,
 *     never partners (customers), never another Developer, never yourself,
 *   • everything done while working-as is written to the activity log as
 *     "<Developer> (Developer) as <person>" — never as the person alone,
 *   • credential / profile-security actions are blocked while working-as, so it
 *     can't be used to take over the person's account.
 */
/** What the session token remembers while a Developer is working as someone. */
export type ActAs = { id: string; role: Role; name: string; email: string; at: number };

/** Working-as ends by itself after this long (a forgotten session can't linger or resume days later). */
export const WORK_AS_MAX_MS = 4 * 60 * 60 * 1000;

export const ACTABLE_ROLES: readonly Role[] = ["FINANCE", "WAREHOUSE", "SALES_REP"];

export function canWorkAs(target: { id: string; role: Role; status: UserStatus }, developerId: string): boolean {
  return target.id !== developerId && target.status === "ACTIVE" && ACTABLE_ROLES.includes(target.role);
}
