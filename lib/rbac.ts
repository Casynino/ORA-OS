import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";

export function dashboardPath(role?: Role | string | null): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "WAREHOUSE":
      return "/warehouse";
    case "SALES_REP":
      return "/rep";
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
