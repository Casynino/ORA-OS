import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";

export function dashboardPath(role?: Role | string | null): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "FINANCE":
      return "/finance";
    case "WAREHOUSE":
      return "/warehouse";
    case "SALES_REP":
      return "/rep";
    case "DEVELOPER":
      return "/developer";
    default:
      return "/partner";
  }
}

export async function getSession() {
  return auth();
}

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** For Server Components / pages: redirect unauthenticated users to login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For Server Components / pages: enforce a role, else bounce to own area. */
export async function requireRole(role: Role | Role[]) {
  const user = await requireUser();
  const roles = Array.isArray(role) ? role : [role];
  if (!roles.includes(user.role)) {
    // A Developer whose "work as" has ended is still bounced around by the old
    // browser cookie — send them through the reset so it's cleared.
    if (user.role === "DEVELOPER") redirect("/api/developer/reset");
    redirect(dashboardPath(user.role));
  }
  return user;
}

/**
 * For server actions: returns the actor or throws (caught by the action and
 * converted to an ActionResult). Never redirects.
 */
export async function requireActor(roles?: Role[]) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in to do that.");
  if (roles && !roles.includes(user.role)) {
    throw new Error("You are not authorised to perform this action.");
  }
  return user;
}

/**
 * For actions that change HOW SOMEONE SIGNS IN — passwords, login email, new
 * accounts, "sign out everywhere". Same as requireActor, but refused while a
 * Developer is working as that person: otherwise "Work as" could be used to take
 * over an account (or plant a new Admin) and keep access after Stop.
 */
export async function requireOwnIdentity(roles?: Role[]) {
  const user = await requireActor(roles);
  if (user.impersonatedBy)
    throw new Error(
      "This changes sign-in details, so it can't be done while a Developer is working as this person. They must do it themselves.",
    );
  return user;
}
