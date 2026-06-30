import { NextResponse } from "next/server";
import { reconcilePendingDonations, getDonationFeed } from "@/lib/services/donation-feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public live-donation feed. On each poll we first confirm any pending NTZS
 * payments (so gifts appear the moment money settles, even without a webhook),
 * then return the latest counters + recent gifts.
 */
export async function GET() {
  await reconcilePendingDonations();
  const feed = await getDonationFeed();
  return NextResponse.json(feed, {
    headers: { "Cache-Control": "no-store" },
  });
}
