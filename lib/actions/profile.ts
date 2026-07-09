"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// Self-service profile for the signed-in admin. Every change propagates
// instantly (the session refreshes from the DB on each request), and the
// design supports many administrators — nothing is hardcoded to one person.

const profileSchema = z.object({
  name: z.string().min(2, "Enter your full name.").max(120),
  preferredName: z.string().max(60).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email address.").max(160),
  phone: z.string().max(40).optional().or(z.literal("")),
  position: z.string().max(80).optional().or(z.literal("")),
  avatar: z.string().max(500).optional().or(z.literal("")),
});

export async function updateMyProfile(
  input: z.infer<typeof profileSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = profileSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid profile.");
    const d = parsed.data;

    const email = d.email.toLowerCase().trim();
    const emailTaken = await prisma.user.findFirst({
      where: { email, NOT: { id: actor.id } },
      select: { id: true },
    });
    if (emailTaken) return fail("That email is already used by another account.");

    await prisma.user.update({
      where: { id: actor.id },
      data: {
        name: d.name.trim(),
        preferredName: d.preferredName?.trim() || null,
        email,
        phone: d.phone?.trim() || null,
        position: d.position?.trim() || null,
        avatar: d.avatar?.trim() || null,
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: d.name.trim(),
      action: "PROFILE_UPDATED",
      entity: "User",
      entityId: actor.id,
      summary: `${d.name.trim()} updated their profile.`,
    });
    revalidatePath("/admin/profile");
    revalidatePath("/admin");
    return ok(undefined, "Profile updated — it now shows everywhere.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const passwordSchema = z.object({
  current: z.string().min(1, "Enter your current password."),
  next: z.string().min(8, "New password needs at least 8 characters.").max(100),
});

export async function changeMyPassword(
  input: z.infer<typeof passwordSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    const parsed = passwordSchema.safeParse(input);
    if (!parsed.success)
      return fail(parsed.error.issues[0]?.message ?? "Invalid password.");

    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user) return fail("Account not found.");
    const valid = await bcrypt.compare(parsed.data.current, user.passwordHash);
    if (!valid) return fail("Your current password is incorrect.");

    await prisma.user.update({
      where: { id: actor.id },
      data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "PASSWORD_CHANGED",
      entity: "User",
      entityId: actor.id,
      summary: `${actor.name} changed their password.`,
    });
    return ok(undefined, "Password changed.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

/** Invalidate every session of this account — including this one. */
export async function signOutAllDevices(): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN"]);
    await prisma.user.update({
      where: { id: actor.id },
      data: { sessionVersion: { increment: 1 } },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "SIGNED_OUT_EVERYWHERE",
      entity: "User",
      entityId: actor.id,
      summary: `${actor.name} signed out of all devices.`,
    });
    return ok(undefined, "Signed out everywhere — all sessions are now invalid.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
