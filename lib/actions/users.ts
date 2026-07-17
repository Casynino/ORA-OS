"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { recordLimitSet } from "@/lib/services/credit";
import { formatCurrency } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

export async function approveAgent(userId: string): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return fail("User not found.");
    if (user.status === "ACTIVE") return fail("This account is already active.");

    await prisma.user.update({
      where: { id: userId },
      data: { status: "ACTIVE" },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "AGENT_APPROVED",
      entity: "User",
      entityId: userId,
      summary: `${user.name} approved and activated${
        user.organization ? ` (${user.organization})` : ""
      }.`,
    });
    revalidatePath("/admin/users");
    return ok(undefined, `${user.name} activated.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// Applications are reviewed on both /admin/applications and
// /finance/applications — revalidate both wherever one changes.
function revalidateApplications(userId?: string) {
  for (const p of [
    "/admin/applications",
    "/admin/users",
    "/admin/customers",
    "/finance",
    "/finance/applications",
    "/finance/customers",
    "/finance/partners",
  ]) {
    revalidatePath(p);
  }
  if (userId) {
    revalidatePath(`/admin/customers/${userId}`);
    revalidatePath(`/admin/applications/${userId}`);
    revalidatePath(`/finance/applications/${userId}`);
  }
}

// Approve a partner application AND set their commercial terms in one step.
const approveApplicationSchema = z.object({
  userId: z.string().min(1),
  creditLimit: z.number().int().nonnegative().max(1000000000).optional(),
  paymentTerms: z.string().max(120).optional(),
  financeNotes: z.string().max(1000).optional(),
  prices: z
    .array(
      z.object({
        productId: z.string().min(1),
        price: z.number().int().nonnegative().max(10000000),
      }),
    )
    .optional(),
});

export async function approveApplication(
  input: z.infer<typeof approveApplicationSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = approveApplicationSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid approval data.");
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
    });
    if (!user) return fail("Application not found.");
    if (user.role !== "PARTNER") return fail("Not a partner application.");
    // Guard against a second approval (e.g. admin and finance both reviewing the
    // same pending application) clobbering the terms already set on activation.
    if (user.status !== "PENDING") {
      return fail("This application has already been reviewed.");
    }

    await prisma.$transaction(async (tx) => {
      const newLimit = parsed.data.creditLimit ?? user.creditLimit ?? 0;
      await tx.user.update({
        where: { id: user.id },
        data: {
          status: "ACTIVE",
          creditLimit: newLimit,
          paymentTerms: parsed.data.paymentTerms?.trim() || user.paymentTerms,
          financeNotes: parsed.data.financeNotes?.trim() || user.financeNotes,
          applicationNote: null, // clear any outstanding info request on approval
        },
      });
      // Opening limit lands in the auditable credit history too.
      await recordLimitSet(tx, {
        partnerId: user.id,
        prevLimit: user.creditLimit ?? 0,
        newLimit,
        note: `Opening limit on approval by ${admin.name}.`,
      });
      for (const p of parsed.data.prices ?? []) {
        await tx.partnerPrice.upsert({
          where: {
            partnerId_productId: { partnerId: user.id, productId: p.productId },
          },
          update: { price: p.price },
          create: { partnerId: user.id, productId: p.productId, price: p.price },
        });
      }
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "AGENT_APPROVED",
      entity: "User",
      entityId: user.id,
      summary: `${user.name} approved & activated with commercial terms by ${admin.name}${
        user.organization ? ` (${user.organization})` : ""
      }.`,
    });
    revalidateApplications(user.id);
    return ok(undefined, `${user.name} approved and activated.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

export async function rejectApplication(
  userId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return fail("Application not found.");
    if (user.status !== "PENDING") {
      return fail("Only pending applications can be rejected.");
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "SUSPENDED",
        notes: reason?.trim()
          ? `Application rejected: ${reason.trim()}`
          : "Application rejected.",
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "AGENT_REJECTED",
      entity: "User",
      entityId: userId,
      summary: `${user.name}'s application rejected by ${admin.name}.`,
    });
    revalidateApplications(userId);
    return ok(undefined, `${user.name}'s application rejected.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const statusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED", "PENDING"]),
});

export async function setUserStatus(
  input: z.infer<typeof statusSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = statusSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid status.");
    if (parsed.data.userId === admin.id) {
      return fail("You cannot change your own account status.");
    }
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
    });
    if (!user) return fail("User not found.");

    await prisma.user.update({
      where: { id: user.id },
      data: { status: parsed.data.status },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "USER_STATUS_CHANGED",
      entity: "User",
      entityId: user.id,
      summary: `${user.name} set to ${parsed.data.status.toLowerCase()}.`,
    });
    revalidatePath("/admin/users");
    return ok(undefined, `${user.name} updated.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const creditLimitSchema = z.object({
  userId: z.string().min(1),
  creditLimit: z.number().int().nonnegative().max(100000000),
});

export async function setCreditLimit(
  input: z.infer<typeof creditLimitSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = creditLimitSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid credit limit.");
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
    });
    if (!user) return fail("User not found.");

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { creditLimit: parsed.data.creditLimit },
      });
      // Auditable credit history — every manual limit change is recorded.
      await recordLimitSet(tx, {
        partnerId: user.id,
        prevLimit: user.creditLimit ?? 0,
        newLimit: parsed.data.creditLimit,
        note: `Limit set by ${admin.name}.`,
      });
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CREDIT_LIMIT_SET",
      entity: "User",
      entityId: user.id,
      summary: `Credit limit for ${user.name} set to ${parsed.data.creditLimit}.`,
    });
    revalidatePath("/admin/users");
    revalidatePath("/finance/partners");
    return ok(undefined, "Credit limit updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const financeNotesSchema = z.object({
  userId: z.string().min(1),
  notes: z.string().max(1000),
});

/** Finance records/updates its creditworthiness notes on a partner. */
export async function setPartnerFinanceNotes(
  input: z.infer<typeof financeNotesSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = financeNotesSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid notes.");
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, name: true, role: true },
    });
    if (!user || user.role !== "PARTNER") return fail("Partner not found.");
    await prisma.user.update({
      where: { id: user.id },
      data: { financeNotes: parsed.data.notes.trim() || null },
    });
    revalidatePath("/finance/partners");
    revalidatePath("/finance/customers");
    revalidatePath(`/finance/customers/${user.id}`);
    revalidatePath("/admin/customers");
    return ok(undefined, "Financial notes saved.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "FINANCE", "WAREHOUSE", "PARTNER", "SALES_REP"]),
  organization: z.string().optional(),
  location: z.string().optional(),
  phone: z.string().optional(),
  warehouseId: z.string().optional(),
  position: z.string().optional(),
  canRecordSales: z.boolean().optional(),
  canCreateTransfers: z.boolean().optional(),
});

export async function createUserByAdmin(
  input: z.infer<typeof createSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = createSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid details.");
    }
    const email = parsed.data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return fail("A user with this email already exists.");

    const isWarehouse = parsed.data.role === "WAREHOUSE";
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name.trim(),
        email,
        passwordHash: await bcrypt.hash(parsed.data.password, 10),
        role: parsed.data.role,
        status: "ACTIVE",
        organization: parsed.data.organization?.trim() || null,
        location: parsed.data.location?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
        // Warehouse staff are tied to exactly one warehouse + a job title.
        warehouseId: isWarehouse ? parsed.data.warehouseId || null : null,
        position: isWarehouse ? parsed.data.position?.trim() || null : null,
        canRecordSales: isWarehouse ? !!parsed.data.canRecordSales : false,
        canCreateTransfers: isWarehouse ? !!parsed.data.canCreateTransfers : false,
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "USER_CREATED",
      entity: "User",
      entityId: user.id,
      summary: `${admin.name} created ${parsed.data.role.toLowerCase()} account for ${user.name}.`,
    });
    revalidatePath("/admin/users");
    return ok(undefined, `${user.name} created.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const permsSchema = z.object({
  userId: z.string().min(1),
  canRecordSales: z.boolean(),
  canCreateTransfers: z.boolean(),
});

export async function setWarehousePermissions(
  input: z.infer<typeof permsSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = permsSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid permissions.");
    const target = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { role: true, name: true },
    });
    if (!target) return fail("User not found.");
    if (target.role !== "WAREHOUSE") {
      return fail("Permissions apply to warehouse staff only.");
    }
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: {
        canRecordSales: parsed.data.canRecordSales,
        canCreateTransfers: parsed.data.canCreateTransfers,
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "WAREHOUSE_PERMISSIONS_SET",
      entity: "User",
      entityId: parsed.data.userId,
      summary: `${admin.name} updated permissions for ${target.name}.`,
    });
    revalidatePath("/admin/users");
    return ok(undefined, "Permissions updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const creditIncreaseSchema = z.object({
  requestedLimit: z.number().int().positive().max(1000000000).optional(),
  note: z.string().max(500).optional(),
});

// A partner asks the ORA team to raise their credit limit. The team actions it
// from /admin/users (credit limit modal); this records & surfaces the request.
export async function requestCreditIncrease(
  input: z.infer<typeof creditIncreaseSchema>,
): Promise<ActionResult> {
  try {
    const actor = await requireActor(["PARTNER"]);
    const parsed = creditIncreaseSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid request.");
    const me = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { creditLimit: true, organization: true },
    });
    const current = me?.creditLimit ?? 0;
    const target = parsed.data.requestedLimit;
    await logActivity({
      actorId: actor.id,
      actorName: actor.name,
      action: "CREDIT_INCREASE_REQUESTED",
      entity: "User",
      entityId: actor.id,
      summary: `${actor.name}${me?.organization ? ` (${me.organization})` : ""} requested a credit increase${
        target ? ` to ${formatCurrency(target)}` : ""
      } — current limit ${formatCurrency(current)}.${parsed.data.note ? ` Note: ${parsed.data.note.trim()}` : ""}`,
      meta: { current, requested: target ?? null },
    });
    revalidatePath("/admin/activity");
    revalidatePath("/admin");
    return ok(
      undefined,
      "Your request has been sent to the ORA team. We'll be in touch.",
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const infoSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(3, "Enter a message for the applicant.").max(1000),
});

// Finance/Admin asks an applicant for more information (keeps them PENDING).
export async function requestApplicationInfo(
  input: z.infer<typeof infoSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = infoSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid request.");
    }
    const target = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { name: true },
    });
    if (!target) return fail("Applicant not found.");
    await prisma.user.update({
      where: { id: parsed.data.userId },
      data: { applicationNote: parsed.data.message.trim() },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "APPLICATION_INFO_REQUESTED",
      entity: "User",
      entityId: parsed.data.userId,
      summary: `${admin.name} requested more information from applicant ${target.name}.`,
    });
    revalidateApplications(parsed.data.userId);
    revalidatePath("/partner");
    return ok(undefined, "Information request sent to the applicant.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

// ── Customer profile management ─────────────────────────────────────────────

const updateCustomerSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().or(z.literal("")),
  organization: z.string().max(160).optional().or(z.literal("")),
  businessType: z.string().max(60).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  region: z.string().max(120).optional().or(z.literal("")),
  district: z.string().max(120).optional().or(z.literal("")),
  street: z.string().max(200).optional().or(z.literal("")),
  expectedVolume: z.string().max(120).optional().or(z.literal("")),
  taxId: z.string().max(60).optional().or(z.literal("")),
  businessLicense: z.string().max(80).optional().or(z.literal("")),
  preferredPayment: z.string().max(40).optional().or(z.literal("")),
  paymentTerms: z.string().max(60).optional().or(z.literal("")),
  assignedWarehouse: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

/** Edit a customer/partner's business profile fields. */
export async function updateCustomer(
  input: z.infer<typeof updateCustomerSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = updateCustomerSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid details.");
    }
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
    });
    if (!user) return fail("Customer not found.");

    // Guard against email collisions with another account.
    if (parsed.data.email.toLowerCase() !== user.email.toLowerCase()) {
      const clash = await prisma.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
        select: { id: true },
      });
      if (clash && clash.id !== user.id) {
        return fail("That email is already in use by another account.");
      }
    }

    const blank = (v?: string) => (v && v.trim() ? v.trim() : null);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: parsed.data.name.trim(),
        email: parsed.data.email.toLowerCase().trim(),
        phone: blank(parsed.data.phone),
        organization: blank(parsed.data.organization),
        businessType: blank(parsed.data.businessType),
        location: blank(parsed.data.location),
        region: blank(parsed.data.region),
        district: blank(parsed.data.district),
        street: blank(parsed.data.street),
        expectedVolume: blank(parsed.data.expectedVolume),
        taxId: blank(parsed.data.taxId),
        businessLicense: blank(parsed.data.businessLicense),
        preferredPayment: blank(parsed.data.preferredPayment),
        paymentTerms: blank(parsed.data.paymentTerms),
        assignedWarehouse: blank(parsed.data.assignedWarehouse),
        notes: blank(parsed.data.notes),
      },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "CUSTOMER_UPDATED",
      entity: "User",
      entityId: user.id,
      summary: `${admin.name} updated ${parsed.data.name.trim()}'s profile.`,
    });
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${user.id}`);
    revalidatePath("/admin/users");
    return ok(undefined, "Customer profile updated.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const resetPwSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/** Set a new password for a customer/partner account. */
export async function resetPartnerPassword(
  input: z.infer<typeof resetPwSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = resetPwSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid password.");
    }
    const user = await prisma.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, name: true },
    });
    if (!user) return fail("Customer not found.");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: bcrypt.hashSync(parsed.data.password, 10) },
    });
    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PASSWORD_RESET",
      entity: "User",
      entityId: user.id,
      summary: `${admin.name} reset the password for ${user.name}.`,
    });
    revalidatePath(`/admin/customers/${user.id}`);
    return ok(undefined, `Password updated for ${user.name}.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
