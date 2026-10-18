"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { writeDevAudit, writeDevAuditSafe, requestMeta } from "@/lib/developer/audit";
import { devActivatableIds } from "@/lib/developer/eligibility";
import { canWorkAs } from "@/lib/developer/acting";
import { auth, unstable_update } from "@/auth";
import { dashboardPath } from "@/lib/rbac";
import { notifyInApp } from "@/lib/notifications/in-app";
import { sendWhatsApp } from "@/lib/notifications/whatsapp";
import { resumeTracking } from "@/lib/developer/errors";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
//  Developer console — user ACCESS management.
//
//  Every action here:
//   • is server-authorised for the DEVELOPER role only (never ADMIN/staff),
//   • needs a written reason (≥10 chars) AND the word CONFIRM typed,
//   • refuses to touch the business owner's Admin account, other Developer
//     accounts, or the Developer's own account,
//   • writes its audit row INSIDE the same transaction as the change — if the
//     audit row can't be written, the change does not happen,
//   • records failures too, always under the Developer's OWN identity,
//   • sends the business owner an in-app heads-up (her WhatsApp/CallMeBot setup
//     is untouched).
//  There is intentionally NO password-reset here: it would let the Developer
//  sign in AS another person, and their later actions would carry that person's
//  name — exactly what the audit rules forbid.
// ─────────────────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  userId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(10, "Give a reason (at least 10 characters).")
    .max(300, "Keep the reason under 300 characters."),
  confirm: z.string(),
});

const statusSchema = baseSchema.extend({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

type Target = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
};

/** Which accounts the Developer console may NOT change. null = allowed. */
function refuseTarget(actorId: string, target: Target | null): string | null {
  if (!target) return "User not found.";
  if (target.id === actorId) return "You can't change your own account here.";
  if (target.role === "ADMIN")
    return "The business owner's Admin account can't be changed from the Developer console.";
  if (target.role === "DEVELOPER") return "Developer accounts can't be changed here.";
  return null;
}

async function loadTarget(userId: string): Promise<Target | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
}

function revalidateUsers() {
  revalidatePath("/developer/users");
  revalidatePath("/developer/audit");
  revalidatePath("/admin/users");
}

/** Suspend or re-activate a (non-Admin) staff/partner account. */
export async function devSetUserStatus(
  input: z.infer<typeof statusSchema>,
): Promise<ActionResult> {
  let actor;
  try {
    actor = await requireActor(["DEVELOPER"]);
  } catch (e) {
    return fail(errorMessage(e));
  }
  const meta = requestMeta(await headers());
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
  const d = parsed.data;
  if (d.confirm.trim() !== "CONFIRM") return fail("Type CONFIRM to proceed.");

  const target = await loadTarget(d.userId);
  let refusal = refuseTarget(actor.id, target);
  // Approving applications and overruling the owner's suspensions/rejections are
  // business decisions — never the Developer's. They may only suspend, and
  // re-activate an account the Developer console itself suspended.
  if (!refusal && target?.status === "PENDING")
    refusal = "This account is awaiting approval — that decision belongs to the business owner.";
  if (!refusal && target && d.status === "ACTIVE" && !(await devActivatableIds([target.id])).has(target.id))
    refusal =
      "Only accounts suspended from the Developer console can be re-activated here. Ask the business owner to re-activate this one.";
  if (refusal || !target) {
    await writeDevAuditSafe({
      actor: { id: actor.id, name: actor.name ?? "Developer" },
      action: "DEV_USER_STATUS_CHANGED",
      entity: "User",
      entityId: d.userId,
      summary: `Refused: change account status — ${refusal}`,
      outcome: "FAILED",
      reason: d.reason,
      ...meta,
    });
    return fail(refusal ?? "User not found.");
  }
  if (target.status === d.status) return fail(`${target.name} is already ${d.status.toLowerCase()}.`);

  const verb = d.status === "SUSPENDED" ? "suspended" : "re-activated";
  try {
    await prisma.$transaction(async (tx) => {
      // Compare-and-swap on the status we showed the Developer, so a concurrent
      // change can't be silently overwritten.
      const claimed = await tx.user.updateMany({
        where: { id: target.id, status: target.status },
        data: { status: d.status },
      });
      if (claimed.count === 0)
        throw new Error("This account changed while you were reviewing it — refresh and try again.");
      await writeDevAudit(tx, {
        actor: { id: actor.id, name: actor.name ?? "Developer" },
        action: "DEV_USER_STATUS_CHANGED",
        entity: "User",
        entityId: target.id,
        summary: `Developer ${verb} ${target.name} (${target.email}, ${target.role}).`,
        outcome: "SUCCESS",
        reason: d.reason,
        before: { status: target.status },
        after: { status: d.status },
        ...meta,
      });
    });
  } catch (e) {
    await writeDevAuditSafe({
      actor: { id: actor.id, name: actor.name ?? "Developer" },
      action: "DEV_USER_STATUS_CHANGED",
      entity: "User",
      entityId: target.id,
      summary: `Failed to change ${target.name}'s status to ${d.status}: ${errorMessage(e)}`,
      outcome: "FAILED",
      reason: d.reason,
      before: { status: target.status },
      ...meta,
    });
    return fail(errorMessage(e));
  }

  // Heads-up to the business owner (in-app only; WhatsApp setup untouched).
  await notifyInApp({
    toRoles: ["ADMIN"],
    category: "INFO",
    type: "DEVELOPER_ACTION",
    title: "Developer changed an account",
    body: `${actor.name} (Developer) ${verb} ${target.name}. Reason: ${d.reason}`,
    actorName: `${actor.name} (Developer)`,
    entityType: "User",
    entityId: target.id,
    actionUrl: "/admin/activity",
    actionLabel: "View activity",
  });
  revalidateUsers();
  return ok(undefined, `${target.name} ${verb}.`);
}

const signOutSchema = baseSchema;

/** Sign a (non-Admin) account out of every device. */
export async function devForceSignOut(
  input: z.infer<typeof signOutSchema>,
): Promise<ActionResult> {
  let actor;
  try {
    actor = await requireActor(["DEVELOPER"]);
  } catch (e) {
    return fail(errorMessage(e));
  }
  const meta = requestMeta(await headers());
  const parsed = signOutSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
  const d = parsed.data;
  if (d.confirm.trim() !== "CONFIRM") return fail("Type CONFIRM to proceed.");

  const target = await loadTarget(d.userId);
  const refusal = refuseTarget(actor.id, target);
  if (refusal || !target) {
    await writeDevAuditSafe({
      actor: { id: actor.id, name: actor.name ?? "Developer" },
      action: "DEV_USER_SIGNED_OUT",
      entity: "User",
      entityId: d.userId,
      summary: `Refused: force sign-out — ${refusal}`,
      outcome: "FAILED",
      reason: d.reason,
      ...meta,
    });
    return fail(refusal ?? "User not found.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { sessionVersion: { increment: 1 } },
      });
      await writeDevAudit(tx, {
        actor: { id: actor.id, name: actor.name ?? "Developer" },
        action: "DEV_USER_SIGNED_OUT",
        entity: "User",
        entityId: target.id,
        summary: `Developer signed ${target.name} (${target.email}) out of all devices.`,
        outcome: "SUCCESS",
        reason: d.reason,
        after: { sessionsRevoked: true },
        ...meta,
      });
    });
  } catch (e) {
    await writeDevAuditSafe({
      actor: { id: actor.id, name: actor.name ?? "Developer" },
      action: "DEV_USER_SIGNED_OUT",
      entity: "User",
      entityId: target.id,
      summary: `Failed to sign ${target.name} out: ${errorMessage(e)}`,
      outcome: "FAILED",
      reason: d.reason,
      ...meta,
    });
    return fail(errorMessage(e));
  }

  await notifyInApp({
    toRoles: ["ADMIN"],
    category: "INFO",
    type: "DEVELOPER_ACTION",
    title: "Developer signed a user out",
    body: `${actor.name} (Developer) signed ${target.name} out of all devices. Reason: ${d.reason}`,
    actorName: `${actor.name} (Developer)`,
    entityType: "User",
    entityId: target.id,
    actionUrl: "/admin/activity",
    actionLabel: "View activity",
  });
  revalidateUsers();
  return ok(undefined, `${target.name} was signed out everywhere.`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Work as a staff member
//
//  The Developer opens a Finance / Warehouse / Sales Rep dashboard with that
//  person's real permissions and data — no password needed. The session becomes
//  that person (so every screen just works) but is marked as the Developer
//  behind it, and logActivity records everything as "<Developer> (Developer) as
//  <person>". Never the Admin, never a partner, never another Developer.
// ─────────────────────────────────────────────────────────────────────────────

export async function devStartActing(input: { userId: string }): Promise<ActionResult<{ redirectTo: string }>> {
  const session = await auth();
  if (session?.user?.impersonatedBy)
    return fail("You're already working as someone — stop first, then pick another account.");
  let actor;
  try {
    actor = await requireActor(["DEVELOPER"]);
  } catch (e) {
    return fail(errorMessage(e));
  }
  const meta = requestMeta(await headers());
  const me = { id: actor.id, name: actor.name ?? "Developer" };
  const target = typeof input?.userId === "string" ? await loadTarget(input.userId) : null;

  if (!target || !canWorkAs(target, actor.id)) {
    await writeDevAuditSafe({
      actor: me,
      action: "DEV_ACT_START",
      entity: "User",
      entityId: target?.id ?? null,
      summary: "Refused: work as an account that isn't active, is a Developer, or is your own.",
      outcome: "FAILED",
      ...meta,
    });
    return fail("You can only work as an active account (not another Developer, and not yourself).");
  }

  try {
    // Audit FIRST: if this row can't be written, working-as never starts.
    const auditId = await writeDevAudit(prisma, {
      actor: me,
      action: "DEV_ACT_START",
      entity: "User",
      entityId: target.id,
      summary: `Developer started working as ${target.name} (${target.email}, ${target.role}).`,
      outcome: "SUCCESS",
      after: { actingAs: target.id, role: target.role },
      ...meta,
    });
    // The session only accepts the switch when it can find THIS audit row, so
    // working-as can never begin without a record of it.
    const updated = await unstable_update({ actAs: target.id, actAuditId: auditId } as never);
    // Only report success if the session really switched.
    if (!updated?.user?.impersonatedBy) throw new Error("Couldn't switch the session — nothing was changed.");
  } catch (e) {
    await writeDevAuditSafe({
      actor: me,
      action: "DEV_ACT_START",
      entity: "User",
      entityId: target.id,
      summary: `Failed to start working as ${target.name}: ${errorMessage(e)}`,
      outcome: "FAILED",
      ...meta,
    });
    return fail(errorMessage(e));
  }

  // Heads-up to the business owner (in-app only; WhatsApp setup untouched).
  await notifyInApp({
    toRoles: ["ADMIN"],
    category: "INFO",
    type: "DEVELOPER_ACTION",
    title: target.role === "ADMIN" ? "Developer opened the Admin dashboard" : "Developer is working as a team member",
    body: `${me.name} (Developer) opened ${target.name}'s dashboard. Everything done is recorded under the Developer.`,
    actorName: `${me.name} (Developer)`,
    entityType: "User",
    entityId: target.id,
    actionUrl: "/admin/activity",
    actionLabel: "View activity",
  });
  // Working as the OWNER's own account is the most sensitive case — also tell her
  // on WhatsApp (best-effort, capped so it can never hold up the switch).
  if (target.role === "ADMIN") {
    await Promise.race([
      sendWhatsApp(`ORA security notice: Developer ${me.name} just opened the Admin dashboard (working as ${target.name}). Everything done is recorded under the Developer in Activity.`),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
  }
  return ok({ redirectTo: dashboardPath(target.role) }, `Now working as ${target.name}.`);
}

export async function devStopActing(): Promise<ActionResult> {
  const session = await auth();
  const real = session?.user?.impersonatedBy;
  if (!real || !session?.user) return fail("You're not working as anyone.");
  const meta = requestMeta(await headers());
  try {
    await writeDevAudit(prisma, {
      actor: { id: real.id, name: real.name },
      action: "DEV_ACT_STOP",
      entity: "User",
      entityId: session.user.id,
      summary: `Developer stopped working as ${session.user.name ?? "a team member"}.`,
      outcome: "SUCCESS",
      ...meta,
    });
    await unstable_update({ actAs: null } as never);
  } catch (e) {
    return fail(errorMessage(e));
  }
  return ok(undefined, "Back in your Developer console.");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Turn on error tracking
//
//  Creates the SystemEvent table (additive + idempotent — the same SQL as
//  scripts/system-events-table.sql) so the monitor can record server errors and
//  failed sign-ins. It never touches business data. Audited like everything else.
// ─────────────────────────────────────────────────────────────────────────────
export async function devEnableErrorTracking(): Promise<ActionResult> {
  let actor;
  try {
    actor = await requireActor(["DEVELOPER"]);
  } catch (e) {
    return fail(errorMessage(e));
  }
  const meta = requestMeta(await headers());
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`CREATE TABLE IF NOT EXISTS "SystemEvent" (
        "id" TEXT NOT NULL,
        "kind" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "path" TEXT,
        "method" TEXT,
        "digest" TEXT,
        "detail" TEXT,
        "ip" TEXT,
        "count" INTEGER NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
      )`;
      await tx.$executeRaw`ALTER TABLE "SystemEvent" ADD COLUMN IF NOT EXISTS "count" INTEGER NOT NULL DEFAULT 1`;
      await tx.$executeRaw`CREATE INDEX IF NOT EXISTS "SystemEvent_createdAt_idx" ON "SystemEvent"("createdAt")`;
      await tx.$executeRaw`CREATE INDEX IF NOT EXISTS "SystemEvent_kind_createdAt_idx" ON "SystemEvent"("kind", "createdAt")`;
      await writeDevAudit(tx, {
        actor: { id: actor.id, name: actor.name ?? "Developer" },
        action: "DEV_ERROR_TRACKING_ENABLED",
        entity: "System",
        summary: "Developer turned on error tracking (created the SystemEvent table).",
        outcome: "SUCCESS",
        ...meta,
      });
    });
  } catch (e) {
    await writeDevAuditSafe({
      actor: { id: actor.id, name: actor.name ?? "Developer" },
      action: "DEV_ERROR_TRACKING_ENABLED",
      entity: "System",
      summary: `Failed to turn on error tracking: ${errorMessage(e)}`,
      outcome: "FAILED",
      ...meta,
    });
    return fail(errorMessage(e));
  }
  resumeTracking();
  revalidatePath("/developer");
  return ok(undefined, "Error tracking is on. Crashes and failed sign-ins are now recorded.");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Create an account
//
//  The Developer creates the accounts (staff, partners — even the owner's Admin
//  account) the same way the owner does in Admin → Users, but under the Developer's
//  own name: the audit row is written in the SAME transaction as the new user, the
//  owner is told in-app (and on WhatsApp when an ADMIN account is created), and the
//  password is never stored or logged anywhere except as a hash. Developer accounts
//  themselves are never created from here.
// ─────────────────────────────────────────────────────────────────────────────

const createAccountSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(160),
  password: z.string().min(8, "The password needs at least 8 characters.").max(100),
  role: z.enum(["ADMIN", "FINANCE", "WAREHOUSE", "PARTNER", "SALES_REP"]),
  phone: z.string().trim().max(40).optional(),
  organization: z.string().trim().max(120).optional(),
  warehouseId: z.string().optional(),
  position: z.string().trim().max(80).optional(),
  canCreateTransfers: z.boolean().optional(),
  /** Required (true) when creating an ADMIN account. */
  confirmAdmin: z.boolean().optional(),
});

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin (owner)",
  FINANCE: "Finance",
  WAREHOUSE: "Warehouse",
  PARTNER: "Partner",
  SALES_REP: "Sales rep",
};

export async function devCreateUser(
  input: z.infer<typeof createAccountSchema>,
): Promise<ActionResult<{ id: string }>> {
  let actor;
  try {
    actor = await requireActor(["DEVELOPER"]);
  } catch (e) {
    return fail(errorMessage(e));
  }
  const me = { id: actor.id, name: actor.name ?? "Developer" };
  const meta = requestMeta(await headers());
  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the details.");
  const d = parsed.data;
  const email = d.email.toLowerCase();

  if (d.role === "ADMIN" && d.confirmAdmin !== true)
    return fail("Tick the box to confirm you are creating an Admin (owner) account.");
  if (d.role === "WAREHOUSE") {
    if (!d.warehouseId) return fail("Choose the warehouse for this staff member.");
    const wh = await prisma.warehouse.findUnique({ where: { id: d.warehouseId }, select: { id: true } });
    if (!wh) return fail("That warehouse no longer exists.");
  }

  try {
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) return fail("An account with this email already exists.");

    const passwordHash = await bcrypt.hash(d.password, 10);
    const isWarehouse = d.role === "WAREHOUSE";
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: d.name,
          email,
          passwordHash,
          role: d.role,
          status: "ACTIVE",
          phone: d.phone || null,
          organization: d.role === "PARTNER" ? d.organization || null : null,
          warehouseId: isWarehouse ? d.warehouseId || null : null,
          position: isWarehouse ? d.position || null : null,
          canRecordSales: false, // warehouse staff never record sales
          canCreateTransfers: isWarehouse ? !!d.canCreateTransfers : false,
        },
        select: { id: true, name: true },
      });
      // Audit row in the SAME transaction: no record, no account. The password is never included.
      await writeDevAudit(tx, {
        actor: me,
        action: "DEV_USER_CREATED",
        entity: "User",
        entityId: created.id,
        summary: `Developer created a ${ROLE_LABEL[d.role]} account for ${d.name} (${email}).`,
        outcome: "SUCCESS",
        after: { role: d.role, email, name: d.name },
        ...meta,
      });
      return created;
    });

    await notifyInApp({
      toRoles: ["ADMIN"],
      category: "INFO",
      type: "DEVELOPER_ACTION",
      title: d.role === "ADMIN" ? "Developer created an Admin account" : "Developer created an account",
      body: `${me.name} (Developer) created a ${ROLE_LABEL[d.role]} account for ${d.name}.`,
      actorName: `${me.name} (Developer)`,
      entityType: "User",
      entityId: user.id,
      actionUrl: "/admin/users",
      actionLabel: "View users",
    });
    // A new Admin account is the most powerful thing this can create — also tell the owner on WhatsApp
    // (best-effort, capped so it can never hold up the action).
    if (d.role === "ADMIN") {
      await Promise.race([
        sendWhatsApp(`ORA security notice: Developer ${me.name} created an Admin account for ${d.name} (${email}).`),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    }
    revalidatePath("/developer/users");
    revalidatePath("/admin/users");
    return ok({ id: user.id }, `${user.name} can now sign in.`);
  } catch (e) {
    await writeDevAuditSafe({
      actor: me,
      action: "DEV_USER_CREATED",
      entity: "User",
      summary: `Failed to create an account for ${d.name}: ${errorMessage(e)}`,
      outcome: "FAILED",
      ...meta,
    });
    return fail(errorMessage(e));
  }
}
