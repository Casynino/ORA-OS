import { prisma } from "@/lib/db";

// A partner can only return stock they actually hold. "Held" = everything
// ever delivered to them (FULFILLED request items). Anything already tied up in
// a live return (not rejected) is no longer available to return again.
export type ReturnableLine = {
  productId: string;
  held: number; // total units ever delivered to the partner
  inReturn: number; // units locked in pending/in-transit/completed returns
  available: number; // held − inReturn (never negative)
};

export async function getReturnableStock(
  partnerId: string,
): Promise<Map<string, ReturnableLine>> {
  const [delivered, returns] = await Promise.all([
    prisma.requestItem.groupBy({
      by: ["productId"],
      where: { request: { requesterId: partnerId, status: "FULFILLED" } },
      _sum: { quantity: true },
    }),
    prisma.returnRequest.groupBy({
      by: ["productId"],
      where: { requesterId: partnerId, status: { not: "REJECTED" } },
      _sum: { quantity: true },
    }),
  ]);

  const returned = new Map(
    returns.map((r) => [r.productId, r._sum.quantity ?? 0]),
  );

  const map = new Map<string, ReturnableLine>();
  for (const d of delivered) {
    const held = d._sum.quantity ?? 0;
    if (held <= 0) continue;
    const inReturn = returned.get(d.productId) ?? 0;
    map.set(d.productId, {
      productId: d.productId,
      held,
      inReturn,
      available: Math.max(0, held - inReturn),
    });
  }
  return map;
}
