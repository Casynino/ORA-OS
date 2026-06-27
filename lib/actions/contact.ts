"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const sendSchema = z.object({
  subject: z.string().max(120).optional(),
  body: z.string().min(3, "Write a short message.").max(2000),
});

// Partner sends a message to the ORA team.
export async function sendContactMessage(
  input: z.infer<typeof sendSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["PARTNER"]);
    const parsed = sendSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid message.");
    }
    const msg = await prisma.contactMessage.create({
      data: {
        senderId: actor.id,
        subject: parsed.data.subject?.trim() || null,
        body: parsed.data.body.trim(),
        status: "OPEN",
      },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CONTACT_MESSAGE_SENT",
      entity: "ContactMessage",
      entityId: msg.id,
      summary: `${actor.name} sent the ORA team a message${parsed.data.subject ? ` — ${parsed.data.subject.trim()}` : ""}.`,
    });
    revalidatePath("/admin/messages");
    revalidatePath("/admin");
    revalidatePath("/partner/profile");
    return ok(undefined, "Message sent to the ORA team.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const replySchema = z.object({
  id: z.string().min(1),
  reply: z.string().min(1, "Write a reply.").max(2000),
});

// Admin replies to a partner message and resolves it.
export async function replyContactMessage(
  input: z.infer<typeof replySchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = replySchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid reply.");
    }
    const msg = await prisma.contactMessage.findUnique({
      where: { id: parsed.data.id },
    });
    if (!msg) return fail("Message not found.");
    await prisma.contactMessage.update({
      where: { id: parsed.data.id },
      data: {
        reply: parsed.data.reply.trim(),
        status: "RESOLVED",
        repliedById: admin.id,
        repliedAt: new Date(),
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CONTACT_MESSAGE_REPLIED",
      entity: "ContactMessage",
      entityId: msg.id,
      summary: `ORA team replied to a partner message.`,
    });
    revalidatePath("/admin/messages");
    revalidatePath("/partner/profile");
    return ok(undefined, "Reply sent.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
