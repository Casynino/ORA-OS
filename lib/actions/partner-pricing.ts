"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { fail, ok, errorMessage, type ActionResult } from "@/lib/types";

const schema = z.object({
  partnerId: z.string().min(1),
  prices: z
    .array(
      z.object({
        productId: z.string().min(1),
        price: z.number().int().nonnegative().max(10000000),
      }),
    )
    .min(1),
});

/** Admin sets/updates a partner's per-product prices (their commercial terms). */
export async function setPartnerPrices(
  input: z.infer<typeof schema>,
): Promise<ActionResult> {
  try {
    const admin = await requireActor(["ADMIN", "FINANCE"]);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return fail("Invalid pricing data.");

    const partner = await prisma.user.findUnique({
      where: { id: parsed.data.partnerId },
      select: { id: true, name: true, role: true },
    });
    if (!partner || partner.role !== "PARTNER") {
      return fail("Partner not found.");
    }

    await prisma.$transaction(
      parsed.data.prices.map((p) =>
        prisma.partnerPrice.upsert({
          where: {
            partnerId_productId: {
              partnerId: parsed.data.partnerId,
              productId: p.productId,
            },
          },
          update: { price: p.price },
          create: {
            partnerId: parsed.data.partnerId,
            productId: p.productId,
            price: p.price,
          },
        }),
      ),
    );

    await logActivity({
      actorId: admin.id,
      actorName: admin.name,
      action: "PARTNER_PRICED",
      entity: "User",
      entityId: partner.id,
      summary: `Commercial pricing set for ${partner.name}.`,
    });

    revalidatePath("/admin/users");
    revalidatePath("/partner/request");
    return ok(undefined, "Partner pricing saved.");
  } catch (e) {
    return fail(errorMessage(e));
  }
}
