import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ntzsConfigured, ntzsGetDeposit, ntzsDepositPaid } from "@/lib/ntzs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAID = ["RECEIVED", "ALLOCATED", "DISTRIBUTED"];

/**
 * Live status for a single donation, by its reference code. If the gift is
 * still pending and has an NTZS deposit, we check whether the money has
 * cleared and confirm it on the spot — so the donor sees a real "thank you"
 * the moment their mobile-money payment settles (no webhook required).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const donation = await prisma.donation.findUnique({
    where: { code },
    select: {
      id: true,
      status: true,
      ntzsDepositId: true,
      amount: true,
      quantity: true,
    },
  });
  if (!donation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let status: string = donation.status;
  if (status === "PENDING" && donation.ntzsDepositId && ntzsConfigured()) {
    try {
      const dep = await ntzsGetDeposit(donation.ntzsDepositId);
      if (ntzsDepositPaid(dep.status)) {
        await prisma.donation.update({
          where: { id: donation.id },
          data: {
            status: "RECEIVED",
            paidAt: new Date(),
            txHash: dep.txHash ?? null,
          },
        });
        status = "RECEIVED";
      }
    } catch {
      /* leave pending; the client will poll again */
    }
  }

  return NextResponse.json({
    status,
    confirmed: PAID.includes(status),
    cancelled: status === "CANCELLED",
    amount: donation.amount,
    pads: donation.quantity,
  });
}
