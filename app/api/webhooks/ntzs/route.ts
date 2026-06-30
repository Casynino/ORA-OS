import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { verifyNtzsWebhook } from "@/lib/ntzs";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NTZS payment webhook. Fires `deposit.completed` once a donor's mobile money
 * payment settles to the ORA treasury. We verify the HMAC signature, then mark
 * the matching donation as received.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-webhook-signature");
  const timestamp = req.headers.get("x-webhook-timestamp");

  if (!verifyNtzsWebhook(raw, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    type?: string;
    data?: { depositId?: string; userId?: string; amountTzs?: number; txHash?: string };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (event.type !== "deposit.completed" || !event.data?.depositId) {
    // Acknowledge other events so NTZS doesn't retry.
    return NextResponse.json({ received: true });
  }

  const donation = await prisma.donation.findFirst({
    where: { ntzsDepositId: event.data.depositId },
  });
  if (!donation) {
    return NextResponse.json({ received: true, matched: false });
  }
  if (donation.status === "RECEIVED" || donation.paidAt) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await prisma.donation.update({
    where: { id: donation.id },
    data: {
      status: "RECEIVED",
      paidAt: new Date(),
      txHash: event.data.txHash ?? null,
      ntzsUserId: donation.ntzsUserId ?? event.data.userId ?? null,
    },
  });

  await logActivity({
    actorId: donation.donorId ?? null,
    actorName: donation.donorName,
    action: "DONATION_PAID",
    entity: "Donation",
    entityId: donation.id,
    summary: `Donation ${donation.code} received via NTZS (${(
      event.data.amountTzs ?? donation.amount ?? 0
    ).toLocaleString()} TSh) to treasury.`,
  });

  revalidatePath("/admin/donations");
  revalidatePath("/admin");
  revalidatePath("/donate");
  revalidatePath("/");
  return NextResponse.json({ received: true });
}
