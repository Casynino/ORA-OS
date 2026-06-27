import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const warehouses = await prisma.warehouse.findMany({ orderBy: { createdAt: "asc" } });
  const main = warehouses.find((w) => /main/i.test(w.name)) ?? warehouses[0];
  const second = warehouses.find((w) => w.id !== main?.id);
  const admin = await prisma.user.findUnique({ where: { email: "admin@orapads.org" } });
  if (!main || !second || !admin) throw new Error("Need 2 warehouses + admin.");

  const purple = await prisma.product.findUnique({ where: { sku: "ORA-PURPLE-360" } });
  const blue = await prisma.product.findUnique({ where: { sku: "ORA-BLUE-290" } });
  if (!purple || !blue) throw new Error("Products missing.");

  // 1) A COMPLETED transfer (stock already moved Main → Lake Zone).
  if (!(await prisma.warehouseTransfer.findUnique({ where: { code: "TRF-DEMO1" } }))) {
    const qty = 20;
    await prisma.$transaction(async (tx) => {
      await tx.warehouseTransfer.create({
        data: {
          code: "TRF-DEMO1",
          fromId: main.id,
          toId: second.id,
          status: "COMPLETED",
          note: "Rebalancing stock to the Lake Zone.",
          createdById: admin.id,
          approvedById: admin.id,
          dispatchedAt: new Date(Date.now() - 2 * DAY),
          receivedAt: new Date(Date.now() - 1 * DAY),
          createdAt: new Date(Date.now() - 3 * DAY),
          items: { create: [{ productId: purple.id, quantity: qty }] },
        },
      });
      await tx.warehouseStock.update({
        where: { warehouseId_productId: { warehouseId: main.id, productId: purple.id } },
        data: { onHand: { decrement: qty }, lastMoveAt: new Date(Date.now() - 1 * DAY) },
      });
      await tx.warehouseStock.upsert({
        where: { warehouseId_productId: { warehouseId: second.id, productId: purple.id } },
        update: { onHand: { increment: qty }, lastMoveAt: new Date(Date.now() - 1 * DAY) },
        create: { warehouseId: second.id, productId: purple.id, onHand: qty },
      });
    });
    console.log("✓ TRF-DEMO1 completed — 20 Purple moved Main → Lake Zone.");
  } else {
    console.log("• TRF-DEMO1 exists — skipped.");
  }

  // 2) A PENDING transfer (no stock moved — drive it through the UI).
  if (!(await prisma.warehouseTransfer.findUnique({ where: { code: "TRF-DEMO2" } }))) {
    await prisma.warehouseTransfer.create({
      data: {
        code: "TRF-DEMO2",
        fromId: main.id,
        toId: second.id,
        status: "PENDING",
        note: "Top up Blue for the Mwanza outreach.",
        createdById: admin.id,
        items: { create: [{ productId: blue.id, quantity: 15 }] },
      },
    });
    console.log("✓ TRF-DEMO2 pending — 15 Blue awaiting approval.");
  } else {
    console.log("• TRF-DEMO2 exists — skipped.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
