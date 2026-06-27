"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode } from "@/lib/utils";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const donationSchema = z.object({
  type: z.enum(["PADS", "MONEY"]),
  donorName: z.string().min(2, "Please enter your name."),
  donorEmail: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  amount: z.number().int().positive().max(100000000).optional(),
  quantity: z.number().int().positive().max(1000000).optional(),
  message: z.string().max(1000).optional(),
  packageId: z.string().optional(),
});

export async function createDonation(
  input: z.infer<typeof donationSchema>,
): Promise<ActionResult<{ code: string }>> {
  try {
    const parsed = donationSchema.safeParse(input);
    if (!parsed.success) {
      return fail(parsed.error.issues[0]?.message ?? "Invalid donation.");
    }
    const d = parsed.data;
    let type = d.type;
    let amount = d.amount;
    let quantity = d.quantity;

    if (d.packageId) {
      const pkg = await prisma.donationPackage.findUnique({
        where: { id: d.packageId },
      });
      if (!pkg || !pkg.isActive) {
        return fail("The selected package is unavailable.");
      }
      type = pkg.type;
      amount = pkg.amount ?? amount;
      quantity = pkg.padsQuantity ?? quantity;
    }

    if (type === "MONEY" && !amount) return fail("Enter a donation amount.");
    if (type === "PADS" && !quantity)
      return fail("Enter how many pads you'd like to donate.");

    // Optional: attach to the signed-in supporter; otherwise it's a guest gift.
    const user = await getCurrentUser();

    const donation = await prisma.donation.create({
      data: {
        code: refCode("DON"),
        type,
        donorName: d.donorName.trim(),
        donorEmail: d.donorEmail?.trim() || null,
        donorId: user?.id ?? null,
        packageId: d.packageId || null,
        amount: type === "MONEY" ? amount : null,
        quantity: type === "PADS" ? quantity : null,
        message: d.message?.trim() || null,
        status: "PENDING",
      },
    });

    await logActivity({
      actorId: user?.id ?? null,
      actorName: d.donorName.trim(),
      action: "DONATION_CREATED",
      entity: "Donation",
      entityId: donation.id,
      summary: `${d.donorName.trim()} pledged ${
        type === "MONEY" ? `a money donation` : `${quantity} pads`
      } (${donation.code}).`,
    });

    revalidatePath("/admin/donations");
    revalidatePath("/admin");
    revalidatePath("/donate");
    revalidatePath("/dashboard/donations");
    revalidatePath("/");
    return ok(
      { code: donation.code },
      "Thank you! Your donation has been recorded.",
    );
  } catch (e) {
    return fail(errorMessage(e));
  }
}

const updateSchema = z.object({
  donationId: z.string().min(1),
  status: z.enum([
    "PENDING",
    "RECEIVED",
    "ALLOCATED",
    "DISTRIBUTED",
    "CANCELLED",
  ]),
  allocationNote: z.string().max(1000).optional(),
  distributedTo: z.string().max(200).optional(),
});

export async function updateDonation(
  input: z.infer<typeof updateSchema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN"]);
    const parsed = updateSchema.safeParse(input);
    if (!parsed.success) return fail("Invalid update.");

    const donation = await prisma.donation.findUnique({
      where: { id: parsed.data.donationId },
    });
    if (!donation) return fail("Donation not found.");

    await prisma.donation.update({
      where: { id: donation.id },
      data: {
        status: parsed.data.status,
        allocationNote:
          parsed.data.allocationNote?.trim() ?? donation.allocationNote,
        distributedTo:
          parsed.data.distributedTo?.trim() ?? donation.distributedTo,
        handledById: admin.id,
      },
    });

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "DONATION_UPDATED",
      entity: "Donation",
      entityId: donation.id,
      summary: `Donation ${donation.code} marked ${parsed.data.status.toLowerCase()}.`,
    });

    revalidatePath("/admin/donations");
    return ok(undefined, `Donation ${donation.code} updated.`);
  } catch (e) {
    return fail(errorMessage(e));
  }
}
