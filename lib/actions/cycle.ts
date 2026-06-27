"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const schema = z.object({
  lastPeriodDate: z.string().min(1, "Choose the start date of your last period."),
  cycleLength: z.number().int().min(15).max(60),
  periodLength: z.number().int().min(1).max(14),
  notes: z.string().max(500).optional(),
});

export async function saveCycleLog(
  input: z.infer<typeof schema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(); // any signed-in user; data is private
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid entry.");
    }
    const date = new Date(parsed.data.lastPeriodDate);
    if (Number.isNaN(date.getTime())) return fail("Invalid date.");
    if (date.getTime() > Date.now()) {
      return fail("The last period date can't be in the future.");
    }

    await prisma.cycleLog.create({
      data: {
        userId: actor.id,
        lastPeriodDate: date,
        cycleLength: parsed.data.cycleLength,
        periodLength: parsed.data.periodLength,
        notes: parsed.data.notes?.trim() || null,
      },
    });

    revalidatePath("/dashboard/tracker");
    return ok(undefined, "Cycle saved. Your prediction is updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function deleteCycleLog(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    const log = await prisma.cycleLog.findUnique({ where: { id } });
    if (!log || log.userId !== actor.id) return fail("Entry not found.");
    await prisma.cycleLog.delete({ where: { id } });
    revalidatePath("/dashboard/tracker");
    return ok(undefined, "Entry removed.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
