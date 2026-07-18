"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { EXPENSE_CATEGORY_VALUES } from "@/lib/expense-categories";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Give the category a name.").max(40),
  // Which preset bucket it rolls up under for grouped P&L (defaults to Other).
  group: z.enum(EXPENSE_CATEGORY_VALUES).default("OTHER"),
});

/** Create a custom expense category (or re-activate/reuse a matching one). It
 *  becomes available in every category picker and the admin portal thereafter. */
export async function createExpenseCategory(
  input: z.input<typeof schema>,
): Promise<ActionResult<{ id: string; name: string; group: string }>> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid category.");
    const d = parsed.data;

    // Reuse an existing one (case-insensitive) rather than trip the unique index.
    const existing = await prisma.expenseCategoryOption.findFirst({
      where: { name: { equals: d.name, mode: "insensitive" } },
    });
    if (existing) {
      if (!existing.active)
        await prisma.expenseCategoryOption.update({ where: { id: existing.id }, data: { active: true } });
      return ok(
        { id: existing.id, name: existing.name, group: existing.group },
        `"${existing.name}" is ready to use.`,
      );
    }

    const created = await prisma.expenseCategoryOption.create({
      data: { name: d.name, group: d.group, createdById: actor.id },
    });
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "EXPENSE_CATEGORY_CREATED",
      entity: "ExpenseCategoryOption",
      entityId: created.id,
      summary: `${actor.name} created expense category "${created.name}".`,
    });
    for (const p of [
      "/admin/finance",
      "/admin/finance/operational-fund",
      "/finance",
      "/finance/operational-fund",
    ])
      revalidatePath(p);
    return ok({ id: created.id, name: created.name, group: created.group }, `Category "${created.name}" created.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
