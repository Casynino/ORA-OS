"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser, requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { refCode } from "@/lib/utils";
import {
  ntzsConfigured,
  normalizeTzPhone,
  ntzsCreateUser,
  ntzsCreateTreasuryDeposit,
  MIN_DONATION_TZS,
} from "@/lib/ntzs";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

// What one pad costs to fund, in TSh — used to price pad donations that have
// no preset package amount. Adjust to ORA's real per-pad cost.
const PER_PAD_TZS = 500;

const donationSchema = z.object({
  type: z.enum(["PADS", "MONEY"]),
  donorName: z.string().min(2, "Please enter your name."),
  donorEmail: z.string().email("Enter a valid email.").optional().or(z.literal("")),
  donorPhone: z.string().max(40).optional().or(z.literal("")),
  amount: z.number().int().positive().max(100000000).optional(),
  quantity: z.number().int().positive().max(1000000).optional(),
  message: z.string().max(1000).optional(),
  packageId: z.string().optional(),
});

export async function createDonation(
  input: z.infer<typeof donationSchema>,
): Promise<ActionResult<{ code: string; paymentInitiated: boolean; instructions?: string }>> {
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

    // The money to collect (TSh). Money gifts pay their amount; pad gifts pay
    // their package price, or a per-pad rate when no preset price exists.
    let priceFromPackage: number | null = null;
    if (d.packageId) {
      const pkg = await prisma.donationPackage.findUnique({
        where: { id: d.packageId },
        select: { amount: true },
      });
      priceFromPackage = pkg?.amount ?? null;
    }
    const amountTzs =
      type === "MONEY"
        ? amount ?? 0
        : priceFromPackage ?? (quantity ?? 0) * PER_PAD_TZS;

    // Optional: attach to the signed-in supporter; otherwise it's a guest gift.
    const user = await getCurrentUser();

    const donation = await prisma.donation.create({
      data: {
        code: refCode("DON"),
        type,
        donorName: d.donorName.trim(),
        donorEmail: d.donorEmail?.trim() || null,
        donorPhone: d.donorPhone?.trim() || null,
        donorId: user?.id ?? null,
        packageId: d.packageId || null,
        // `amount` always holds the money value collected for this gift.
        amount: amountTzs > 0 ? amountTzs : null,
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
      summary: `${d.donorName.trim()} started a ${
        type === "MONEY" ? "money" : `${quantity}-pad`
      } donation (${donation.code}).`,
    });

    const revalidate = () => {
      revalidatePath("/admin/donations");
      revalidatePath("/admin");
      revalidatePath("/donate");
      revalidatePath("/dashboard/donations");
      revalidatePath("/");
    };

    // ── Collect payment via NTZS (mobile money → ORA treasury) ──
    const phone = d.donorPhone ? normalizeTzPhone(d.donorPhone) : null;
    if (ntzsConfigured() && amountTzs >= MIN_DONATION_TZS) {
      if (!d.donorPhone?.trim()) {
        return fail("Enter your mobile number to complete the payment.");
      }
      if (!phone) {
        return fail("Enter a valid Tanzanian mobile number (e.g. 0752 000 000).");
      }
      try {
        const payer = await ntzsCreateUser({
          externalId: donation.code,
          name: d.donorName.trim(),
          phoneNumber: phone,
          email: d.donorEmail?.trim() || null,
        });
        const deposit = await ntzsCreateTreasuryDeposit({
          userId: payer.id,
          amountTzs,
          phoneNumber: phone,
        });
        await prisma.donation.update({
          where: { id: donation.id },
          data: { ntzsUserId: payer.id, ntzsDepositId: deposit.id },
        });
        revalidate();
        return ok(
          {
            code: donation.code,
            paymentInitiated: true,
            instructions:
              deposit.instructions ??
              "Check your phone for the mobile money prompt and enter your PIN to approve.",
          },
          "Payment request sent — approve it on your phone.",
        );
      } catch (e) {
        // Payment couldn't start — drop the placeholder so it isn't counted.
        await prisma.donation.update({
          where: { id: donation.id },
          data: { status: "CANCELLED" },
        });
        return fail(
          `Couldn't start the mobile money payment: ${errorMessage(e)}`,
        );
      }
    }

    // No payment rail configured (or below minimum) — record as a pledge.
    revalidate();
    return ok(
      { code: donation.code, paymentInitiated: false },
      "Thank you! Your donation has been recorded — our team will be in touch.",
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
