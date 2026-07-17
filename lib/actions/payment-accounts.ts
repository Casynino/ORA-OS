"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

function revalidateAccounts() {
  revalidatePath("/finance");
  revalidatePath("/finance/accounts");
  revalidatePath("/admin/finance/accounts");
  revalidatePath("/admin/finance");
  revalidatePath("/rep/sell");
}

const createSchema = z.object({
  name: z.string().min(2, "Give the account a name.").max(80),
  type: z.enum(["CASH", "BANK", "MOBILE_MONEY"]),
  accountName: z.string().max(120).optional().or(z.literal("")),
  accountNumber: z.string().max(60).optional().or(z.literal("")),
});

export async function createPaymentAccount(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid account.");
    }
    const d = parsed.data;
    const account = await prisma.paymentAccount.create({
      data: {
        name: d.name.trim(),
        type: d.type,
        accountName: d.accountName?.trim() || null,
        accountNumber: d.accountNumber?.trim() || null,
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PAYMENT_ACCOUNT_CREATED",
      entity: "PaymentAccount",
      entityId: account.id,
      summary: `Receiving account "${account.name}" (${d.type.toLowerCase().replace("_", " ")}) added.`,
    });
    revalidateAccounts();
    return ok(undefined, `${account.name} added.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const updateSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(2).max(80).optional(),
  accountName: z.string().max(120).optional(),
  accountNumber: z.string().max(60).optional(),
  isActive: z.boolean().optional(),
});

export async function updatePaymentAccount(
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid update.");
    const { accountId, ...rest } = parsed.data;
    const account = await prisma.paymentAccount.findUnique({ where: { id: accountId } });
    if (!account) return fail("Account not found.");

    const updated = await prisma.paymentAccount.update({
      where: { id: accountId },
      data: {
        name: rest.name?.trim() ?? account.name,
        accountName:
          rest.accountName !== undefined
            ? rest.accountName.trim() || null
            : account.accountName,
        accountNumber:
          rest.accountNumber !== undefined
            ? rest.accountNumber.trim() || null
            : account.accountNumber,
        isActive: rest.isActive ?? account.isActive,
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PAYMENT_ACCOUNT_UPDATED",
      entity: "PaymentAccount",
      entityId: account.id,
      summary:
        rest.isActive === false
          ? `Receiving account "${updated.name}" deactivated.`
          : rest.isActive === true && !account.isActive
            ? `Receiving account "${updated.name}" reactivated.`
            : `Receiving account "${updated.name}" updated.`,
    });
    revalidateAccounts();
    return ok(undefined, "Account updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
